import unittest

from app.schemas.events import SessionStartEvent, UiSnapshotEvent, UiSnapshotItem, UiSnapshotShell


class UiSnapshotEventTests(unittest.TestCase):
    def test_ui_snapshot_serializes_normalized_items_and_shell(self):
        event = UiSnapshotEvent(
            session_id='session-1',
            items=[
                UiSnapshotItem(
                    id='item-1',
                    kind='event',
                    title='Resposta do agente',
                    sequence=1,
                    meta='Sugestao de percurso',
                    image_url='https://images.example/evento.jpg',
                    source_url='https://events.example/evento',
                    latitude=40.203,
                    longitude=-7.501,
                )
            ],
            shell=UiSnapshotShell(brand='Way Finder', agent_label='CIM'),
            focus_item_id='item-1',
        )

        payload = event.model_dump()

        self.assertEqual(payload['type'], 'ui_snapshot')
        self.assertEqual(payload['items'][0]['kind'], 'event')
        self.assertEqual(payload['items'][0]['visual_state'], 'active')
        self.assertEqual(payload['items'][0]['image_url'], 'https://images.example/evento.jpg')
        self.assertEqual(payload['items'][0]['source_url'], 'https://events.example/evento')
        self.assertEqual(payload['items'][0]['latitude'], 40.203)
        self.assertEqual(payload['items'][0]['longitude'], -7.501)
        self.assertEqual(payload['shell']['brand'], 'Way Finder')
        self.assertEqual(payload['focus_item_id'], 'item-1')

    def test_session_start_serializes_agent_and_greeting_audio(self):
        event = SessionStartEvent(
            session_id='session-1',
            agent_id='cim',
            greeting_audio='ZmFrZS13YXY=',
        )

        payload = event.model_dump()

        self.assertEqual(payload['type'], 'session_start')
        self.assertEqual(payload['agent_id'], 'cim')
        self.assertEqual(payload['greeting_audio'], 'ZmFrZS13YXY=')


if __name__ == '__main__':
    unittest.main()