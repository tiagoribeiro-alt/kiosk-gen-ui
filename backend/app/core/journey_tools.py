from dataclasses import dataclass
from typing import Any, Optional

import httpx
from google.genai import types

from app.core.config import settings
from app.core.poi_catalog import search_curated_pois
from app.core.rag_events import fetch_event_cards
from app.core.weather import fetch_weather_snapshot
from app.schemas.events import UiSnapshotItem, UiSnapshotWeatherForecastDay


@dataclass
class JourneyToolResult:
    items: list[UiSnapshotItem]
    summary_url: Optional[str] = None
    qr_data: Optional[str] = None


VALID_POI_CATEGORIES = {'monument', 'nature', 'restaurant', 'museum', 'church', 'hotel', 'other'}


def get_journey_tool_definitions() -> list[types.Tool]:
    return [
        types.Tool(
            function_declarations=[
                types.FunctionDeclaration(
                    name='get_pois',
                    description='Add one or more POI cards to the Journey UI.',
                    parameters_json_schema={
                        'type': 'object',
                        'properties': {
                            'items': {
                                'type': 'array',
                                'items': {
                                    'type': 'object',
                                    'properties': {
                                        'title': {'type': 'string'},
                                        'location': {'type': 'string'},
                                        'category': {'type': 'string'},
                                        'description': {'type': 'string'},
                                    },
                                    'required': ['title'],
                                },
                            },
                            'title': {'type': 'string'},
                            'query': {'type': 'string'},
                            'region': {'type': 'string'},
                            'limit': {'type': 'integer'},
                            'location': {'type': 'string'},
                            'category': {'type': 'string'},
                            'description': {'type': 'string'},
                        },
                    },
                ),
                types.FunctionDeclaration(
                    name='get_events',
                    description='Add one or more event cards to the Journey UI, sourced primarily from the legacy RAG backend.',
                    parameters_json_schema={
                        'type': 'object',
                        'properties': {
                            'items': {
                                'type': 'array',
                                'items': {
                                    'type': 'object',
                                    'properties': {
                                        'title': {'type': 'string'},
                                        'sub_title': {'type': 'string'},
                                        'meta': {'type': 'string'},
                                    },
                                    'required': ['title'],
                                },
                            },
                            'query': {
                                'type': 'string',
                                'description': 'Free-text event search query when the user mentions a specific agenda or theme.',
                            },
                            'location': {
                                'type': 'string',
                                'description': 'City, town, or venue area that should anchor the event search.',
                            },
                            'date': {
                                'type': 'string',
                                'description': 'Preferred event date when the user asks for a day or period.',
                            },
                            'category': {
                                'type': 'string',
                                'description': 'Optional event category such as music, gastronomy, family, or culture.',
                            },
                            'limit': {
                                'type': 'integer',
                                'description': 'Maximum number of event cards to render.',
                            },
                            'title': {'type': 'string'},
                            'sub_title': {'type': 'string'},
                            'meta': {'type': 'string'},
                        },
                    },
                ),
                types.FunctionDeclaration(
                    name='show_destination',
                    description='Add a destination image card to the Journey UI.',
                    parameters_json_schema={
                        'type': 'object',
                        'properties': {
                            'title': {'type': 'string'},
                            'caption': {'type': 'string'},
                            'location': {'type': 'string'},
                        },
                        'required': ['title'],
                    },
                ),
                types.FunctionDeclaration(
                    name='show_gallery',
                    description='Add a gallery/image card to the Journey UI.',
                    parameters_json_schema={
                        'type': 'object',
                        'properties': {
                            'title': {'type': 'string'},
                            'caption': {'type': 'string'},
                            'location': {'type': 'string'},
                        },
                        'required': ['title'],
                    },
                ),
                types.FunctionDeclaration(
                    name='show_map',
                    description='Add a map card to the Journey UI.',
                    parameters_json_schema={
                        'type': 'object',
                        'properties': {
                            'title': {'type': 'string'},
                            'location': {'type': 'string'},
                        },
                        'required': ['title'],
                    },
                ),
                types.FunctionDeclaration(
                    name='get_weather',
                    description='Add a weather forecast card for one or more days to the Journey UI.',
                    parameters_json_schema={
                        'type': 'object',
                        'properties': {
                            'location': {'type': 'string'},
                            'days': {'type': 'integer'},
                        },
                        'required': ['location'],
                    },
                ),
                types.FunctionDeclaration(
                    name='end_session',
                    description='Prepare summary and QR handoff and end the session.',
                    parameters_json_schema={
                        'type': 'object',
                        'properties': {
                            'summary_title': {'type': 'string'},
                            'summary': {'type': 'string'},
                            'summary_url': {'type': 'string'},
                            'qr_title': {'type': 'string'},
                            'qr_data': {'type': 'string'},
                        },
                    },
                ),
            ]
        )
    ]


async def execute_journey_tool_call(
    tool_name: str,
    args: Optional[dict[str, Any]],
    next_sequence: int,
) -> JourneyToolResult:
    payload = args or {}

    if tool_name == 'get_pois':
        return JourneyToolResult(items=await _build_poi_items(payload, next_sequence))

    if tool_name == 'get_events':
        return JourneyToolResult(items=await _build_event_items(payload, next_sequence))

    if tool_name == 'get_weather':
        return await _build_weather_items(payload, next_sequence)

    if tool_name in {'show_destination', 'show_gallery'}:
        return JourneyToolResult(items=[await _build_image_item(tool_name, payload, next_sequence)])

    if tool_name == 'show_map':
        return JourneyToolResult(items=[await _build_map_item(payload, next_sequence)])

    if tool_name == 'end_session':
        summary_title = _get_text(payload, 'summary_title', fallback='Resumo da visita')
        qr_title = _get_text(payload, 'qr_title', fallback='QR de checkout')
        summary_text = _get_optional_text(payload, 'summary')
        qr_data = _get_optional_text(payload, 'qr_data')
        summary_url = _get_optional_text(payload, 'summary_url')
        return JourneyToolResult(
            items=[
                UiSnapshotItem(
                    id=f'summary-{next_sequence}',
                    kind='summary',
                    title=summary_title,
                    description=summary_text,
                    sequence=next_sequence,
                    visual_state='active',
                ),
                UiSnapshotItem(
                    id=f'qr-{next_sequence + 1}',
                    kind='qr',
                    title=qr_title,
                    description='Scan para abrir o resumo no telemovel.',
                    sequence=next_sequence + 1,
                    visual_state='active',
                ),
            ],
            summary_url=summary_url,
            qr_data=qr_data,
        )

    return JourneyToolResult(items=[])


async def _build_weather_items(payload: dict[str, Any], next_sequence: int) -> JourneyToolResult:
    location = _get_optional_text(payload, 'location')
    if not location:
        return JourneyToolResult(items=[])

    days = _get_int(payload, 'days', fallback=3)
    snapshot = await fetch_weather_snapshot(location=location, days=days)
    if snapshot is None:
        return JourneyToolResult(items=[])

    return JourneyToolResult(items=[
        UiSnapshotItem(
            id=f'weather-{next_sequence}',
            kind='weather',
            title=f'Meteorologia em {snapshot.location}',
            location=snapshot.location,
            sequence=next_sequence,
            visual_state='active',
            current_temperature_c=snapshot.current_temperature_c,
            apparent_temperature_c=snapshot.apparent_temperature_c,
            weather_code=snapshot.weather_code,
            weather_label=snapshot.weather_label,
            wind_speed_kmh=snapshot.wind_speed_kmh,
            daily_forecast=[
                UiSnapshotWeatherForecastDay(
                    date=day.date,
                    label=day.label,
                    weather_code=day.weather_code,
                    weather_label=day.weather_label,
                    temperature_max_c=day.temperature_max_c,
                    temperature_min_c=day.temperature_min_c,
                    precipitation_probability_max=day.precipitation_probability_max,
                )
                for day in snapshot.forecast_days
            ],
        )
    ])


async def _build_poi_items(payload: dict[str, Any], next_sequence: int) -> list[UiSnapshotItem]:
    raw_items = _get_array_items(payload)
    if raw_items:
        items: list[UiSnapshotItem] = []
        for index, item in enumerate(raw_items):
            items.append(_build_inline_poi_item(item, next_sequence + index))
        return items

    upstream_pois = await _fetch_upstream_pois(payload)
    if upstream_pois:
        return [
            _build_upstream_poi_item(poi, next_sequence + index)
            for index, poi in enumerate(upstream_pois)
        ]

    query = _get_optional_text(payload, 'query') or _get_optional_text(payload, 'title')
    region = _get_optional_text(payload, 'region') or _get_optional_text(payload, 'location')
    limit = _get_bounded_limit(payload, fallback=4)
    curated_matches = search_curated_pois(query=query, region=region, limit=limit)

    if curated_matches:
        return [
            UiSnapshotItem(
                id=f'poi-{next_sequence + index}',
                kind='poi',
                title=poi.title,
                description=poi.description,
                location=poi.location,
                category=poi.category,
                sequence=next_sequence + index,
                visual_state='active',
            )
            for index, poi in enumerate(curated_matches)
        ]

    if not payload:
        return []

    raw_items = [payload]

    items: list[UiSnapshotItem] = []
    for index, item in enumerate(raw_items):
        items.append(_build_inline_poi_item(item, next_sequence + index))
    return items


async def _build_event_items(payload: dict[str, Any], next_sequence: int) -> list[UiSnapshotItem]:
    raw_items = _get_array_items(payload)

    if not raw_items:
        rag_query = _get_optional_text(payload, 'query') or _get_optional_text(payload, 'title')
        rag_location = _get_optional_text(payload, 'location')
        rag_date = _get_optional_text(payload, 'date')
        rag_category = _get_optional_text(payload, 'category')
        rag_limit = _get_int(payload, 'limit', fallback=3)

        rag_cards = await fetch_event_cards(
            query=rag_query,
            location=rag_location,
            date=rag_date,
            category=rag_category,
            limit=rag_limit,
        )

        if rag_cards:
            return [
                UiSnapshotItem(
                    id=f'event-{next_sequence + index}',
                    kind='event',
                    title=card.title,
                    sub_title=card.sub_title,
                    meta=card.meta,
                    image_url=card.image_url,
                    source_url=card.source_url,
                    latitude=card.latitude,
                    longitude=card.longitude,
                    sequence=next_sequence + index,
                    visual_state='active',
                )
                for index, card in enumerate(rag_cards)
            ]

        raw_items = [payload]

    items: list[UiSnapshotItem] = []
    for index, item in enumerate(raw_items):
        items.append(
            UiSnapshotItem(
                id=f'event-{next_sequence + index}',
                kind='event',
                title=_get_text(item, 'title', fallback='Evento sugerido'),
                sub_title=_get_optional_text(item, 'sub_title'),
                meta=_get_optional_text(item, 'meta'),
                sequence=next_sequence + index,
                visual_state='active',
            )
        )
    return items


def _get_array_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    raw_items = payload.get('items')
    if not isinstance(raw_items, list):
        return []

    return [item for item in raw_items if isinstance(item, dict)]


def _get_text(payload: dict[str, Any], key: str, fallback: str) -> str:
    value = payload.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()

    return fallback


def _get_optional_text(payload: dict[str, Any], key: str) -> Optional[str]:
    value = payload.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()

    return None


def _get_int(payload: dict[str, Any], key: str, fallback: int) -> int:
    value = payload.get(key)
    if isinstance(value, int):
        return value

    return fallback


async def _build_image_item(tool_name: str, payload: dict[str, Any], next_sequence: int) -> UiSnapshotItem:
    title = _get_text(payload, 'title', fallback='Imagem sugerida')
    caption = _get_optional_text(payload, 'caption')
    location = _get_optional_text(payload, 'location')
    prefer_poi_lookup = tool_name == 'show_destination' or _looks_place_like(title)
    image = await _fetch_best_image(title=title, location=location, prefer_poi_lookup=prefer_poi_lookup)
    image_payload = image if isinstance(image, dict) else {}

    return UiSnapshotItem(
        id=f'image-{next_sequence}',
        kind='image',
        title=title,
        caption=caption,
        image_url=_clean_text(image_payload, 'url'),
        thumbnail_url=_clean_text(image_payload, 'thumbnailUrl'),
        image_attribution=_clean_text(image_payload, 'attribution'),
        source_url=_clean_text(image_payload, 'photographerUrl') or _clean_text(image_payload, 'url'),
        sequence=next_sequence,
        visual_state='active',
    )


async def _build_map_item(payload: dict[str, Any], next_sequence: int) -> UiSnapshotItem:
    title = _get_text(payload, 'title', fallback='Mapa sugerido')
    location = _get_optional_text(payload, 'location')
    resolved_poi = await _resolve_map_poi(title=title, location=location)

    return UiSnapshotItem(
        id=f'map-{next_sequence}',
        kind='map',
        title=title,
        location=_build_poi_location_label(resolved_poi) or location,
        latitude=_extract_coordinates(resolved_poi)[0] if resolved_poi else None,
        longitude=_extract_coordinates(resolved_poi)[1] if resolved_poi else None,
        sequence=next_sequence,
        visual_state='active',
    )


def _build_inline_poi_item(payload: dict[str, Any], sequence: int) -> UiSnapshotItem:
    return UiSnapshotItem(
        id=f'poi-{sequence}',
        kind='poi',
        title=_get_text(payload, 'title', fallback='Ponto de interesse'),
        description=_get_optional_text(payload, 'description'),
        location=_get_optional_text(payload, 'location'),
        category=_get_valid_category(_get_optional_text(payload, 'category')),
        image_url=_get_optional_text(payload, 'image_url') or _get_optional_text(payload, 'imageUrl'),
        thumbnail_url=_get_optional_text(payload, 'thumbnail_url') or _get_optional_text(payload, 'thumbnailUrl'),
        image_attribution=_get_optional_text(payload, 'image_attribution') or _get_optional_text(payload, 'imageAttribution'),
        source_url=_get_optional_text(payload, 'source_url') or _get_optional_text(payload, 'sourceUrl'),
        latitude=_get_optional_float(payload, 'latitude'),
        longitude=_get_optional_float(payload, 'longitude'),
        sequence=sequence,
        visual_state='active',
    )


def _build_upstream_poi_item(payload: dict[str, Any], sequence: int) -> UiSnapshotItem:
    latitude, longitude = _extract_coordinates(payload)
    return UiSnapshotItem(
        id=f'poi-{sequence}',
        kind='poi',
        title=_clean_text(payload, 'name') or _clean_text(payload, 'title') or 'Ponto de interesse',
        description=_clean_text(payload, 'description') or _clean_text(payload, 'editorialSummary'),
        location=_build_poi_location_label(payload),
        category=_get_valid_category(_clean_text(payload, 'category')),
        image_url=_clean_text(payload, 'imageUrl'),
        thumbnail_url=_clean_text(payload, 'thumbnailUrl'),
        image_attribution=_join_text_list(payload.get('photoAttributions')),
        source_url=_clean_text(payload, 'website') or _clean_text(payload, 'wikipedia'),
        latitude=latitude,
        longitude=longitude,
        sequence=sequence,
        visual_state='active',
    )


async def _fetch_upstream_pois(payload: dict[str, Any]) -> list[dict[str, Any]]:
    city = _get_optional_text(payload, 'location')
    if not city:
        city = _get_optional_text(payload, 'region')
    if not city and not _get_optional_text(payload, 'query'):
        city = _get_optional_text(payload, 'title')

    params: dict[str, Any] = {
        'limit': _get_bounded_limit(payload, fallback=4),
    }
    if city:
        params['city'] = city

    category = _get_valid_category(_get_optional_text(payload, 'category'))
    if category:
        params['category'] = category

    response = await _fetch_upstream_json('/api/pois', params)
    pois = response.get('pois') if response else None
    if not isinstance(pois, list):
        return []

    return [poi for poi in pois if isinstance(poi, dict)]


async def _fetch_best_image(title: str, location: Optional[str], prefer_poi_lookup: bool) -> Optional[dict[str, Any]]:
    request_order: list[tuple[str, dict[str, Any]]] = []
    if prefer_poi_lookup:
        request_order.append(('/api/images/poi', {'name': title, 'location': location}))
    request_order.append(('/api/images/search', {'q': title, 'location': location}))

    for path, raw_params in request_order:
        params = {key: value for key, value in raw_params.items() if value}
        response = await _fetch_upstream_json(path, params)
        image = response.get('image') if response else None
        if isinstance(image, dict) and _clean_text(image, 'url'):
            return image

    return None


async def _resolve_map_poi(title: str, location: Optional[str]) -> Optional[dict[str, Any]]:
    search_term = location or title
    if not search_term:
        return None

    response = await _fetch_upstream_json('/api/pois', {'city': search_term, 'limit': 4})
    pois = response.get('pois') if response else None
    if not isinstance(pois, list):
        return None

    candidates = [poi for poi in pois if isinstance(poi, dict)]
    if not candidates:
        return None

    normalized_title = title.lower()
    for poi in candidates:
        poi_name = (_clean_text(poi, 'name') or '').lower()
        if poi_name and (poi_name in normalized_title or normalized_title in poi_name):
            return poi

    return candidates[0]


async def _fetch_upstream_json(path: str, params: dict[str, Any]) -> Optional[dict[str, Any]]:
    base_url = settings.eventuais_backend_url.rstrip('/')
    filtered_params = {key: value for key, value in params.items() if value is not None}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f'{base_url}{path}', params=filtered_params)
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError):
        return None

    if not isinstance(payload, dict):
        return None

    return payload


def _get_bounded_limit(payload: dict[str, Any], fallback: int) -> int:
    return max(1, min(_get_int(payload, 'limit', fallback=fallback), 4))


def _get_valid_category(value: Optional[str]) -> Optional[str]:
    if not value:
        return None

    normalized = value.strip().lower()
    if normalized in VALID_POI_CATEGORIES:
        return normalized

    return None


def _get_optional_float(payload: dict[str, Any], key: str) -> Optional[float]:
    value = payload.get(key)
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _build_poi_location_label(payload: Optional[dict[str, Any]]) -> Optional[str]:
    if not payload:
        return None

    return _clean_text(payload, 'city') or _clean_text(payload, 'address') or _clean_text(payload, 'location')


def _extract_coordinates(payload: dict[str, Any]) -> tuple[Optional[float], Optional[float]]:
    raw_coordinates = payload.get('coordinates')
    if not isinstance(raw_coordinates, dict):
        return None, None

    return _to_float(raw_coordinates.get('lat')), _to_float(raw_coordinates.get('lng'))


def _join_text_list(value: Any) -> Optional[str]:
    if not isinstance(value, list):
        return None

    entries = [entry.strip() for entry in value if isinstance(entry, str) and entry.strip()]
    if not entries:
        return None

    return ' | '.join(entries)


def _clean_text(payload: dict[str, Any], key: str) -> Optional[str]:
    value = payload.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _to_float(value: Any) -> Optional[float]:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _looks_place_like(title: str) -> bool:
    normalized = title.strip().lower()
    if not normalized:
        return False

    generic_terms = ('foto', 'imagem', 'galeria', 'paisagem', 'panorama', 'sunset', 'vista')
    return not any(term in normalized for term in generic_terms)