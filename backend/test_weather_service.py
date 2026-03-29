import unittest
from unittest.mock import patch

from app.core.weather import fetch_weather_snapshot, get_weather_label


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _FakeAsyncClient:
    def __init__(self, *args, **kwargs):
        self.responses = [
            _FakeResponse(
                {
                    'results': [
                        {
                            'name': 'Monsanto',
                            'latitude': 40.04,
                            'longitude': -7.11,
                            'timezone': 'Europe/Lisbon',
                        }
                    ]
                }
            ),
            _FakeResponse(
                {
                    'timezone': 'Europe/Lisbon',
                    'current': {
                        'temperature_2m': 24.4,
                        'apparent_temperature': 23.1,
                        'weather_code': 1,
                        'wind_speed_10m': 18.2,
                    },
                    'daily': {
                        'time': ['2025-03-10', '2025-03-11'],
                        'weather_code': [1, 63],
                        'temperature_2m_max': [25.0, 21.0],
                        'temperature_2m_min': [14.0, 12.0],
                        'precipitation_probability_max': [10, 60],
                    },
                }
            ),
        ]

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, params=None):
        return self.responses.pop(0)


class WeatherServiceTests(unittest.IsolatedAsyncioTestCase):
    @patch('app.core.weather.httpx.AsyncClient', _FakeAsyncClient)
    async def test_fetch_weather_snapshot_maps_open_meteo_payload(self):
        snapshot = await fetch_weather_snapshot('Monsanto', days=2)

        self.assertIsNotNone(snapshot)
        assert snapshot is not None
        self.assertEqual(snapshot.location, 'Monsanto')
        self.assertEqual(snapshot.timezone, 'Europe/Lisbon')
        self.assertEqual(snapshot.weather_label, 'Pouco nublado')
        self.assertEqual(len(snapshot.forecast_days), 2)
        self.assertEqual(snapshot.forecast_days[0].label, 'Hoje')
        self.assertEqual(snapshot.forecast_days[1].label, 'Amanha')
        self.assertEqual(snapshot.forecast_days[1].weather_label, 'Chuva')

    def test_get_weather_label_maps_known_wmo_codes(self):
        self.assertEqual(get_weather_label(0), 'Ceu limpo')
        self.assertEqual(get_weather_label(63), 'Chuva')
        self.assertEqual(get_weather_label(95), 'Trovoada')
        self.assertEqual(get_weather_label(999), 'Tempo variavel')


if __name__ == '__main__':
    unittest.main()
