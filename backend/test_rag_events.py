import unittest
from unittest.mock import patch

from app.core.config import settings
from app.core.rag_events import fetch_event_cards


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _FakeAsyncClient:
    responses = []
    requests = []

    def __init__(self, *args, **kwargs):
        self._responses = list(self.__class__.responses)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, params=None):
        self.__class__.requests.append((url, params))
        return self._responses.pop(0)


class RagEventsTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        _FakeAsyncClient.requests = []
        self.base_url = settings.eventuais_backend_url.rstrip('/')

    @patch('app.core.rag_events.httpx.AsyncClient', _FakeAsyncClient)
    async def test_fetch_event_cards_uses_events_search_for_query(self):
        _FakeAsyncClient.responses = [
            _FakeResponse(
                {
                    'events': [
                        {
                            'title': 'Festival da Cereja',
                            'dateStart': '2026-06-10T21:00:00Z',
                            'dateEnd': '2026-06-15T22:00:00Z',
                            'venue': 'Praca do Municipio',
                            'city': 'Fundao',
                            'description': 'Programa com musica e gastronomia regional.',
                            'imageUrl': 'https://images.example/festival.jpg',
                            'sourceUrl': 'https://events.example/festival',
                            'coordinates': {'lat': 40.1405, 'lng': -7.5012},
                        }
                    ]
                }
            )
        ]

        cards = await fetch_event_cards(query='festival cereja', location='Fundao', date='2026-06-10', category='gastronomy', limit=2)

        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0].title, 'Festival da Cereja')
        self.assertEqual(cards[0].sub_title, '2026-06-10 a 2026-06-15 • 21:00 • Praca do Municipio • Fundao')
        self.assertIn('musica e gastronomia regional', cards[0].meta or '')
        self.assertEqual(cards[0].image_url, 'https://images.example/festival.jpg')
        self.assertEqual(cards[0].source_url, 'https://events.example/festival')
        self.assertEqual(cards[0].latitude, 40.1405)
        self.assertEqual(cards[0].longitude, -7.5012)
        self.assertEqual(_FakeAsyncClient.requests[0][0], f'{self.base_url}/api/events/search')
        self.assertEqual(_FakeAsyncClient.requests[0][1], {'q': 'festival cereja', 'location': 'Fundao'})

    @patch('app.core.rag_events.httpx.AsyncClient', _FakeAsyncClient)
    async def test_fetch_event_cards_falls_back_to_structured_events(self):
        _FakeAsyncClient.responses = [
            _FakeResponse({'events': []}),
            _FakeResponse(
                {
                    'events': [
                        {
                            'title': 'Feira de Sao Tiago',
                            'date': '2026-07-25',
                            'time': '21:00',
                            'location': 'Covilha',
                            'description': 'Programa cultural com concertos e gastronomia regional.',
                            'website': 'https://feira.example/sao-tiago',
                            'coordinates': {'lat': '40.2810', 'lng': '-7.5043'},
                        }
                    ]
                }
            ),
        ]

        cards = await fetch_event_cards(query='feira sao tiago', location='Covilha', limit=1)

        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0].title, 'Feira de Sao Tiago')
        self.assertEqual(cards[0].sub_title, '2026-07-25 • 21:00 • Covilha')
        self.assertIn('concertos e gastronomia regional', cards[0].meta or '')
        self.assertEqual(cards[0].source_url, 'https://feira.example/sao-tiago')
        self.assertEqual(cards[0].latitude, 40.281)
        self.assertEqual(cards[0].longitude, -7.5043)
        self.assertEqual(_FakeAsyncClient.requests[1][0], f'{self.base_url}/api/events')
        self.assertEqual(_FakeAsyncClient.requests[1][1], {'location': 'Covilha', 'limit': 1})

    @patch('app.core.rag_events.httpx.AsyncClient', _FakeAsyncClient)
    async def test_fetch_event_cards_uses_structured_endpoint_without_query(self):
        _FakeAsyncClient.responses = [
            _FakeResponse(
                {
                    'events': [
                        {
                            'title': 'Festival de Inverno',
                            'dateStart': '2026-12-12T21:00:00Z',
                            'city': 'Guarda',
                            'description': 'Concertos e luzes de inverno no centro historico.',
                        }
                    ]
                }
            )
        ]

        cards = await fetch_event_cards(location='Guarda', date='2026-12-12', category='music', limit=2)

        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0].title, 'Festival de Inverno')
        self.assertEqual(cards[0].sub_title, '2026-12-12 • 21:00 • Guarda')
        self.assertEqual(_FakeAsyncClient.requests[0][0], f'{self.base_url}/api/events')
        self.assertEqual(
            _FakeAsyncClient.requests[0][1],
            {'location': 'Guarda', 'date': '2026-12-12', 'category': 'music', 'limit': 2},
        )

    @patch('app.core.rag_events.httpx.AsyncClient', _FakeAsyncClient)
    async def test_fetch_event_cards_normalizes_beiras_regional_label_in_location_metadata(self):
        _FakeAsyncClient.responses = [
            _FakeResponse(
                {
                    'events': [
                        {
                            'title': 'Festival da Neve',
                            'date': '2026-12-12',
                            'time': '18:00',
                            'location': 'Região Beiras e Serra da Estrela',
                            'city': 'Guarda',
                        }
                    ]
                }
            )
        ]

        cards = await fetch_event_cards(location='Guarda', limit=1)

        self.assertEqual(len(cards), 1)
        self.assertEqual(
            cards[0].sub_title,
            '2026-12-12 • 18:00 • Serra da Estrela, no Centro de Portugal • Guarda',
        )


if __name__ == '__main__':
    unittest.main()
