from dataclasses import dataclass
import re
from typing import Any, Optional

import httpx

from app.core.config import settings


REGIONAL_NAME_REPLACEMENTS: tuple[tuple[str, str], ...] = (
    ('região beiras e serra da estrela', 'Serra da Estrela, no Centro de Portugal'),
    ('regiao beiras e serra da estrela', 'Serra da Estrela, no Centro de Portugal'),
    ('beiras e serra da estrela', 'Serra da Estrela, no Centro de Portugal'),
    ('região das beiras', 'Centro de Portugal'),
    ('regiao das beiras', 'Centro de Portugal'),
    ('das beiras', 'Centro de Portugal'),
    ('beiras', 'Centro de Portugal'),
)


@dataclass(frozen=True)
class EventCardSnapshot:
    title: str
    sub_title: Optional[str] = None
    meta: Optional[str] = None
    image_url: Optional[str] = None
    source_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


async def fetch_event_cards(
    query: Optional[str] = None,
    location: Optional[str] = None,
    date: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 3,
) -> list[EventCardSnapshot]:
    resolved_limit = max(1, min(limit, 4))
    base_url = settings.eventuais_backend_url.rstrip('/')

    async with httpx.AsyncClient(timeout=10.0) as client:
        if query and query.strip():
            search_results = await _fetch_search_events(
                client=client,
                base_url=base_url,
                query=query.strip(),
                location=location,
            )
            if search_results is None:
                return []
            if search_results:
                return search_results[:resolved_limit]

        structured_results = await _fetch_structured_events(
            client=client,
            base_url=base_url,
            location=location,
            date=date,
            category=category,
            limit=resolved_limit,
        )
        if structured_results is None:
            return []
        if structured_results:
            return structured_results[:resolved_limit]

    return []


async def _fetch_search_events(
    client: httpx.AsyncClient,
    base_url: str,
    query: str,
    location: Optional[str],
) -> Optional[list[EventCardSnapshot]]:
    params: dict[str, Any] = {'q': query}
    if location:
        params['location'] = location

    payload = await _fetch_json(client, f'{base_url}/api/events/search', params=params)
    if payload is None:
        return None

    return _normalize_event_list(payload.get('events'), fallback_location=location)


async def _fetch_structured_events(
    client: httpx.AsyncClient,
    base_url: str,
    location: Optional[str],
    date: Optional[str],
    category: Optional[str],
    limit: int,
) -> Optional[list[EventCardSnapshot]]:
    params: dict[str, Any] = {'limit': limit}
    if location:
        params['location'] = location
    if date:
        params['date'] = date
    if category:
        params['category'] = category

    payload = await _fetch_json(client, f'{base_url}/api/events', params=params)
    if payload is None:
        return None

    return _normalize_event_list(payload.get('events'), fallback_location=location)


async def _fetch_json(
    client: httpx.AsyncClient,
    url: str,
    params: dict[str, Any],
) -> Optional[dict[str, Any]]:
    try:
        response = await client.get(url, params=params)
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError):
        return None

    if not isinstance(payload, dict):
        return None

    return payload


def _normalize_event_list(raw_events: Any, fallback_location: Optional[str]) -> list[EventCardSnapshot]:
    if not isinstance(raw_events, list):
        return []

    cards: list[EventCardSnapshot] = []
    for raw_event in raw_events:
        if not isinstance(raw_event, dict):
            continue

        card = _map_structured_event_to_card(raw_event, fallback_location=fallback_location)
        if card is not None:
            cards.append(card)

    return cards


def _map_structured_event_to_card(
    raw_event: dict[str, Any],
    fallback_location: Optional[str],
) -> Optional[EventCardSnapshot]:
    title = _clean_text(raw_event.get('title'))
    if not title:
        return None

    date_phrase, time_phrase = _extract_event_date_and_time(raw_event)
    location_phrase = _extract_event_location(raw_event, fallback_location)
    coordinates = raw_event.get('coordinates')

    return EventCardSnapshot(
        title=_truncate(title, 72) or title,
        sub_title=_join_parts([date_phrase, time_phrase, location_phrase]),
        meta=_truncate(_clean_text(raw_event.get('description')), 140),
        image_url=_clean_text(raw_event.get('imageUrl')),
        source_url=_clean_text(raw_event.get('sourceUrl')) or _clean_text(raw_event.get('website')),
        latitude=_extract_coordinate(coordinates, 'lat') or _extract_numeric(raw_event.get('latitude')),
        longitude=_extract_coordinate(coordinates, 'lng') or _extract_numeric(raw_event.get('longitude')),
    )


def _extract_event_date_and_time(raw_event: dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
    explicit_date = _clean_text(raw_event.get('date'))
    explicit_time = _clean_text(raw_event.get('time'))
    if explicit_date or explicit_time:
        return explicit_date, explicit_time

    start_date = _clean_text(raw_event.get('dateStart'))
    end_date = _clean_text(raw_event.get('dateEnd'))
    if not start_date:
        return None, None

    start_day, start_time = _split_iso_like_datetime(start_date)
    end_day, _ = _split_iso_like_datetime(end_date) if end_date else (None, None)
    date_phrase = start_day
    if start_day and end_day and end_day != start_day:
        date_phrase = f'{start_day} a {end_day}'

    return date_phrase, explicit_time or start_time


def _extract_event_location(raw_event: dict[str, Any], fallback_location: Optional[str]) -> Optional[str]:
    return _normalize_regional_reference(
        _join_parts([
            _clean_text(raw_event.get('location')),
            _clean_text(raw_event.get('venue')),
            _clean_text(raw_event.get('city')),
        ]) or _clean_text(fallback_location)
    )


def _split_iso_like_datetime(value: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    cleaned = _clean_text(value)
    if not cleaned:
        return None, None

    match = re.match(r'^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}))?', cleaned)
    if not match:
        return cleaned, None

    return match.group(1), match.group(2)


def _extract_coordinate(raw_coordinates: Any, key: str) -> Optional[float]:
    if not isinstance(raw_coordinates, dict):
        return None

    return _extract_numeric(raw_coordinates.get(key))


def _extract_numeric(value: Any) -> Optional[float]:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _clean_text(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    cleaned = ' '.join(value.split())
    return cleaned or None


def _join_parts(parts: list[Optional[str]]) -> Optional[str]:
    compact = [part for part in (_clean_text(value) for value in parts) if part]
    if not compact:
        return None
    return ' • '.join(compact)


def _truncate(text: Optional[str], max_length: int) -> Optional[str]:
    cleaned = _clean_text(text)
    if not cleaned:
        return None
    if len(cleaned) <= max_length:
        return cleaned
    return f'{cleaned[: max_length - 3].rstrip()}...'


def _normalize_regional_reference(text: Optional[str]) -> Optional[str]:
    cleaned = _clean_text(text)
    if not cleaned:
        return None

    normalized_lower = cleaned.casefold()
    for source, target in REGIONAL_NAME_REPLACEMENTS:
        index = normalized_lower.find(source)
        if index == -1:
            continue

        return f'{cleaned[:index]}{target}{cleaned[index + len(source):]}'.strip(' •,')

    return cleaned
