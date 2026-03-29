import unittest
from unittest.mock import AsyncMock, patch

from app.core.rag_events import EventCardSnapshot
from app.core.journey_tools import execute_journey_tool_call, get_journey_tool_definitions


class JourneyToolsTests(unittest.IsolatedAsyncioTestCase):
    def test_tool_definitions_expose_minimal_function_set(self):
        tools = get_journey_tool_definitions()

        function_names = [declaration.name for declaration in tools[0].function_declarations]

        self.assertIn('get_pois', function_names)
        self.assertIn('get_events', function_names)
        self.assertIn('get_weather', function_names)
        self.assertIn('show_map', function_names)
        self.assertIn('end_session', function_names)

    async def test_get_pois_builds_multiple_poi_items(self):
        result = await execute_journey_tool_call(
            'get_pois',
            {
                'items': [
                    {'title': 'Monsanto', 'location': 'Idanha-a-Nova', 'category': 'monument'},
                    {'title': 'Idanha-a-Velha', 'location': 'Idanha-a-Nova', 'category': 'museum'},
                ]
            },
            next_sequence=4,
        )

        self.assertEqual(len(result.items), 2)
        self.assertEqual(result.items[0].kind, 'poi')
        self.assertEqual(result.items[0].sequence, 4)
        self.assertEqual(result.items[1].sequence, 5)

    @patch('app.core.journey_tools._fetch_upstream_json', new_callable=AsyncMock)
    async def test_get_pois_uses_real_upstream_data_when_available(self, fetch_upstream_json_mock: AsyncMock):
        fetch_upstream_json_mock.return_value = {
            'pois': [
                {
                    'name': 'Castelo de Monsanto',
                    'description': 'Fortificacao historica sobre a aldeia.',
                    'city': 'Idanha-a-Nova',
                    'category': 'monument',
                    'imageUrl': 'https://images.example/monsanto.jpg',
                    'thumbnailUrl': 'https://images.example/monsanto-thumb.jpg',
                    'photoAttributions': ['Foto: Turismo Centro'],
                    'website': 'https://visit.example/monsanto',
                    'coordinates': {'lat': 40.0271, 'lng': -7.1149},
                }
            ]
        }

        result = await execute_journey_tool_call(
            'get_pois',
            {
                'location': 'Monsanto',
                'category': 'monument',
                'limit': 2,
            },
            next_sequence=3,
        )

        fetch_upstream_json_mock.assert_awaited_once_with(
            '/api/pois',
            {'city': 'Monsanto', 'category': 'monument', 'limit': 2},
        )
        self.assertEqual(len(result.items), 1)
        self.assertEqual(result.items[0].title, 'Castelo de Monsanto')
        self.assertEqual(result.items[0].thumbnail_url, 'https://images.example/monsanto-thumb.jpg')
        self.assertEqual(result.items[0].image_attribution, 'Foto: Turismo Centro')
        self.assertEqual(result.items[0].source_url, 'https://visit.example/monsanto')
        self.assertEqual(result.items[0].latitude, 40.0271)
        self.assertEqual(result.items[0].longitude, -7.1149)

    @patch('app.core.journey_tools._fetch_upstream_json', new_callable=AsyncMock)
    async def test_get_pois_can_resolve_from_query_and_region(self, fetch_upstream_json_mock: AsyncMock):
        fetch_upstream_json_mock.return_value = None

        result = await execute_journey_tool_call(
            'get_pois',
            {
                'query': 'aldeia historica',
                'region': 'Castelo Branco',
                'limit': 2,
            },
            next_sequence=10,
        )

        self.assertEqual(len(result.items), 2)
        self.assertEqual(result.items[0].title, 'Monsanto')
        self.assertEqual(result.items[0].location, 'Idanha-a-Nova')
        self.assertEqual(result.items[0].sequence, 10)

    @patch('app.core.journey_tools._fetch_upstream_json', new_callable=AsyncMock)
    async def test_get_pois_falls_back_to_single_payload_item_when_catalog_has_no_match(self, fetch_upstream_json_mock: AsyncMock):
        fetch_upstream_json_mock.return_value = None

        result = await execute_journey_tool_call(
            'get_pois',
            {
                'title': 'Destino personalizado',
                'description': 'Sugestao livre do modelo',
            },
            next_sequence=2,
        )

        self.assertEqual(len(result.items), 1)
        self.assertEqual(result.items[0].title, 'Destino personalizado')
        self.assertEqual(result.items[0].description, 'Sugestao livre do modelo')

    @patch('app.core.journey_tools._fetch_upstream_json', new_callable=AsyncMock)
    async def test_show_destination_uses_real_image_metadata_when_available(self, fetch_upstream_json_mock: AsyncMock):
        fetch_upstream_json_mock.return_value = {
            'image': {
                'url': 'https://images.example/destino.jpg',
                'thumbnailUrl': 'https://images.example/destino-thumb.jpg',
                'attribution': 'Foto por Ana Silva',
                'photographerUrl': 'https://images.example/ana-silva',
            }
        }

        result = await execute_journey_tool_call(
            'show_destination',
            {
                'title': 'Monsanto',
                'location': 'Idanha-a-Nova',
                'caption': 'Aldeia historica em granito.',
            },
            next_sequence=6,
        )

        fetch_upstream_json_mock.assert_awaited_once_with(
            '/api/images/poi',
            {'name': 'Monsanto', 'location': 'Idanha-a-Nova'},
        )
        self.assertEqual(result.items[0].kind, 'image')
        self.assertEqual(result.items[0].image_url, 'https://images.example/destino.jpg')
        self.assertEqual(result.items[0].thumbnail_url, 'https://images.example/destino-thumb.jpg')
        self.assertEqual(result.items[0].image_attribution, 'Foto por Ana Silva')
        self.assertEqual(result.items[0].source_url, 'https://images.example/ana-silva')

    @patch('app.core.journey_tools._fetch_upstream_json', new_callable=AsyncMock)
    async def test_show_map_includes_coordinates_when_upstream_data_exists(self, fetch_upstream_json_mock: AsyncMock):
        fetch_upstream_json_mock.return_value = {
            'pois': [
                {
                    'name': 'Monsanto',
                    'city': 'Idanha-a-Nova',
                    'address': 'Monsanto, Idanha-a-Nova',
                    'coordinates': {'lat': 40.0271, 'lng': -7.1149},
                }
            ]
        }

        result = await execute_journey_tool_call(
            'show_map',
            {
                'title': 'Monsanto',
                'location': 'Idanha-a-Nova',
            },
            next_sequence=9,
        )

        fetch_upstream_json_mock.assert_awaited_once_with('/api/pois', {'city': 'Idanha-a-Nova', 'limit': 4})
        self.assertEqual(result.items[0].kind, 'map')
        self.assertEqual(result.items[0].location, 'Idanha-a-Nova')
        self.assertEqual(result.items[0].latitude, 40.0271)
        self.assertEqual(result.items[0].longitude, -7.1149)

    async def test_end_session_builds_summary_and_qr_items(self):
        result = await execute_journey_tool_call(
            'end_session',
            {
                'summary': 'Resumo preparado',
                'summary_url': 'https://example.com/summary',
                'qr_data': 'qr://payload',
            },
            next_sequence=7,
        )

        self.assertEqual([item.kind for item in result.items], ['summary', 'qr'])
        self.assertEqual(result.summary_url, 'https://example.com/summary')
        self.assertEqual(result.qr_data, 'qr://payload')

    @patch('app.core.journey_tools.fetch_event_cards', new_callable=AsyncMock)
    async def test_get_events_prefers_rag_backed_cards(self, fetch_event_cards_mock: AsyncMock):
        fetch_event_cards_mock.return_value = [
            EventCardSnapshot(
                title='Festival da Cereja',
                sub_title='2026-06-10 • Fundao',
                meta='Programa com musica e gastronomia regional.',
            )
        ]

        result = await execute_journey_tool_call(
            'get_events',
            {
                'location': 'Fundao',
                'date': '2026-06-10',
                'category': 'gastronomy',
                'limit': 2,
            },
            next_sequence=5,
        )

        fetch_event_cards_mock.assert_awaited_once_with(
            query=None,
            location='Fundao',
            date='2026-06-10',
            category='gastronomy',
            limit=2,
        )
        self.assertEqual(len(result.items), 1)
        self.assertEqual(result.items[0].kind, 'event')
        self.assertEqual(result.items[0].title, 'Festival da Cereja')
        self.assertEqual(result.items[0].sub_title, '2026-06-10 • Fundao')

    @patch('app.core.journey_tools.fetch_event_cards', new_callable=AsyncMock)
    async def test_get_events_falls_back_to_inline_payload_when_rag_returns_nothing(self, fetch_event_cards_mock: AsyncMock):
        fetch_event_cards_mock.return_value = []

        result = await execute_journey_tool_call(
            'get_events',
            {
                'title': 'Mercado de Primavera',
                'sub_title': 'Castelo Branco',
                'meta': 'Artesanato e produtos locais',
            },
            next_sequence=12,
        )

        self.assertEqual(len(result.items), 1)
        self.assertEqual(result.items[0].title, 'Mercado de Primavera')
        self.assertEqual(result.items[0].sub_title, 'Castelo Branco')
        self.assertEqual(result.items[0].meta, 'Artesanato e produtos locais')

    @patch('app.core.journey_tools.fetch_weather_snapshot', new_callable=AsyncMock)
    async def test_get_weather_builds_weather_item(self, fetch_weather_snapshot_mock: AsyncMock):
        fetch_weather_snapshot_mock.return_value = type('WeatherSnapshotStub', (), {
            'location': 'Monsanto',
            'current_temperature_c': 24.4,
            'apparent_temperature_c': 23.1,
            'weather_code': 1,
            'weather_label': 'Pouco nublado',
            'wind_speed_kmh': 18.2,
            'forecast_days': [
                type('WeatherForecastDayStub', (), {
                    'date': '2025-03-10',
                    'label': 'Hoje',
                    'weather_code': 1,
                    'weather_label': 'Pouco nublado',
                    'temperature_max_c': 25.0,
                    'temperature_min_c': 14.0,
                    'precipitation_probability_max': 10,
                })(),
            ],
        })()

        result = await execute_journey_tool_call(
            'get_weather',
            {
                'location': 'Monsanto',
                'days': 2,
            },
            next_sequence=8,
        )

        fetch_weather_snapshot_mock.assert_awaited_once_with(location='Monsanto', days=2)
        self.assertEqual(len(result.items), 1)
        self.assertEqual(result.items[0].kind, 'weather')
        self.assertEqual(result.items[0].title, 'Meteorologia em Monsanto')
        self.assertEqual(result.items[0].daily_forecast[0].label, 'Hoje')


if __name__ == '__main__':
    unittest.main()