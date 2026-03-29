import asyncio
import base64
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.core.journey_tools import JourneyToolResult
from app.core.session import KioskSession
from app.schemas.events import UiSnapshotItem


class _FakeWebSocket:
    def __init__(self):
        self.sent_payloads: list[dict] = []
        self.client_state = SimpleNamespace(DISCONNECTED='disconnected')
        self.application_state = SimpleNamespace(DISCONNECTED='disconnected')

    @property
    def client_state(self):
        return self._client_state

    @client_state.setter
    def client_state(self, value):
        self._client_state = value

    @property
    def application_state(self):
        return self._application_state

    @application_state.setter
    def application_state(self, value):
        self._application_state = value

    async def send_text(self, payload: str):
        self.sent_payloads.append(json.loads(payload))


class _ClosedFakeWebSocket(_FakeWebSocket):
    async def send_text(self, payload: str):
        raise RuntimeError("Unexpected ASGI message 'websocket.send', after sending 'websocket.close'")


class _FakeReceiveSession:
    def __init__(self, messages):
        self._messages = iter(messages)

    def receive(self):
        async def generator():
            for message in self._messages:
                yield message

        return generator()


class _FailingReceiveSession:
    def receive(self):
        async def generator():
            raise RuntimeError('upstream unavailable')
            yield

        return generator()


class _FakeLiveConnectContext:
    def __init__(self, session):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb):
        return False


class SessionToolCallTests(unittest.IsolatedAsyncioTestCase):
    def _build_session(self) -> KioskSession:
        websocket = _FakeWebSocket()
        with patch('app.core.session.genai.Client', autospec=True):
            session = KioskSession(websocket=websocket, session_id='session-1')
        session.active_genai_session = SimpleNamespace(send=AsyncMock())
        session.websocket.client_state = 'connected'
        session.websocket.application_state = 'connected'
        return session

    async def test_send_session_start_emits_agent_id_and_base64_greeting_audio(self):
        session = self._build_session()

        with tempfile.TemporaryDirectory() as temp_dir:
            greeting_path = Path(temp_dir) / 'greeting.wav'
            greeting_path.write_bytes(b'RIFFdemo-wave')

            with patch('app.core.session.settings.greeting_audio_path', str(greeting_path)), patch(
                'app.core.session.settings.agent_id',
                'cim',
            ):
                await session._send_session_start()

        self.assertEqual(len(session.websocket.sent_payloads), 1)
        self.assertEqual(session.websocket.sent_payloads[0]['type'], 'session_start')
        self.assertEqual(session.websocket.sent_payloads[0]['agent_id'], 'cim')
        self.assertTrue(session.websocket.sent_payloads[0]['greeting_audio'])

    async def test_send_session_start_generates_fallback_greeting_when_file_is_missing(self):
        session = self._build_session()

        with patch.object(session, '_resolve_greeting_audio_candidates', return_value=[]), patch(
            'app.core.session.settings.agent_id',
            'cim',
        ):
            await session._send_session_start()

        payload = session.websocket.sent_payloads[0]
        self.assertEqual(payload['type'], 'session_start')
        self.assertTrue(payload['greeting_audio'])
        self.assertEqual(base64.b64decode(payload['greeting_audio'])[:4], b'RIFF')

    @patch('app.core.session.execute_journey_tool_call', new_callable=AsyncMock)
    async def test_handle_tool_call_emits_ui_snapshot_and_function_response(self, execute_tool_call_mock: AsyncMock):
        session = self._build_session()
        session._ui_snapshot_items = [
            UiSnapshotItem(
                id='event-1',
                kind='event',
                title='Resposta anterior',
                sequence=1,
                visual_state='active',
            )
        ]
        session._ui_snapshot_sequence = 1

        execute_tool_call_mock.return_value = JourneyToolResult(
            items=[
                UiSnapshotItem(
                    id='event-2',
                    kind='event',
                    title='Festival da Cereja',
                    sub_title='2026-06-10 a 2026-06-15 • Fundao',
                    sequence=2,
                    visual_state='active',
                )
            ]
        )

        tool_call = SimpleNamespace(
            function_calls=[
                SimpleNamespace(
                    id='call-1',
                    name='get_events',
                    args={'location': 'Fundao', 'limit': 1},
                )
            ]
        )

        await session._handle_tool_call(tool_call)

        execute_tool_call_mock.assert_awaited_once_with(
            tool_name='get_events',
            args={'location': 'Fundao', 'limit': 1},
            next_sequence=2,
        )
        self.assertEqual(session._ui_snapshot_items[0].visual_state, 'receding')
        self.assertEqual(session._ui_snapshot_items[1].title, 'Festival da Cereja')
        self.assertEqual(session._ui_snapshot_sequence, 2)
        self.assertEqual(len(session.websocket.sent_payloads), 1)
        self.assertEqual(session.websocket.sent_payloads[0]['type'], 'ui_snapshot')
        self.assertEqual(session.websocket.sent_payloads[0]['focus_item_id'], 'event-2')
        self.assertEqual(session.websocket.sent_payloads[0]['items'][0]['visual_state'], 'receding')
        self.assertEqual(session.websocket.sent_payloads[0]['items'][1]['visual_state'], 'active')

        session.active_genai_session.send.assert_awaited_once()
        sent_input = session.active_genai_session.send.await_args.kwargs['input']
        self.assertEqual(len(sent_input), 1)
        self.assertEqual(sent_input[0].name, 'get_events')
        self.assertEqual(sent_input[0].response['rendered_items'], 1)
        self.assertFalse(sent_input[0].response['ended_session'])

    @patch('app.core.session.execute_journey_tool_call', new_callable=AsyncMock)
    async def test_handle_tool_call_emits_session_end_when_tool_requests_handoff(self, execute_tool_call_mock: AsyncMock):
        session = self._build_session()
        session._last_input_transcript = ('adeus', True)
        execute_tool_call_mock.return_value = JourneyToolResult(
            items=[
                UiSnapshotItem(
                    id='summary-1',
                    kind='summary',
                    title='Resumo da visita',
                    sequence=1,
                    visual_state='active',
                ),
                UiSnapshotItem(
                    id='qr-2',
                    kind='qr',
                    title='QR de checkout',
                    sequence=2,
                    visual_state='active',
                ),
            ],
            summary_url='https://example.com/summary',
            qr_data='qr://payload',
        )

        tool_call = SimpleNamespace(
            function_calls=[
                SimpleNamespace(
                    id='call-2',
                    name='end_session',
                    args={'summary': 'Resumo preparado'},
                )
            ]
        )

        await session._handle_tool_call(tool_call)

        self.assertEqual(len(session.websocket.sent_payloads), 2)
        self.assertEqual(session.websocket.sent_payloads[0]['type'], 'ui_snapshot')
        self.assertEqual(session.websocket.sent_payloads[0]['step'], 'carry')
        self.assertEqual(session.websocket.sent_payloads[0]['focus_item_id'], 'qr-2')
        self.assertEqual(session.websocket.sent_payloads[1]['type'], 'session_end')
        self.assertEqual(session.websocket.sent_payloads[1]['summary_url'], 'https://example.com/summary')
        self.assertEqual(session.websocket.sent_payloads[1]['qr_data'], 'qr://payload')

        sent_input = session.active_genai_session.send.await_args.kwargs['input']
        self.assertEqual(sent_input[0].name, 'end_session')
        self.assertTrue(sent_input[0].response['ended_session'])

    @patch('app.core.session.execute_journey_tool_call', new_callable=AsyncMock)
    async def test_handle_tool_call_emits_session_end_for_end_session_without_handoff_payload(self, execute_tool_call_mock: AsyncMock):
        session = self._build_session()
        session._last_input_transcript = ('ate logo', True)
        execute_tool_call_mock.return_value = JourneyToolResult(
            items=[
                UiSnapshotItem(
                    id='summary-1',
                    kind='summary',
                    title='Resumo da visita',
                    sequence=1,
                    visual_state='active',
                ),
                UiSnapshotItem(
                    id='qr-2',
                    kind='qr',
                    title='QR de checkout',
                    sequence=2,
                    visual_state='active',
                ),
            ]
        )

        tool_call = SimpleNamespace(
            function_calls=[
                SimpleNamespace(
                    id='call-3',
                    name='end_session',
                    args={'summary': 'Resumo preparado'},
                )
            ]
        )

        await session._handle_tool_call(tool_call)

        self.assertEqual(session.websocket.sent_payloads[1]['type'], 'session_end')
        self.assertIsNone(session.websocket.sent_payloads[1]['summary_url'])
        self.assertIsNone(session.websocket.sent_payloads[1]['qr_data'])
        self.assertTrue(session._session_end_requested)

    @patch('app.core.session.execute_journey_tool_call', new_callable=AsyncMock)
    async def test_handle_tool_call_ignores_end_session_without_explicit_farewell(self, execute_tool_call_mock: AsyncMock):
        session = self._build_session()
        session._last_input_transcript = ('obrigado', True)

        tool_call = SimpleNamespace(
            function_calls=[
                SimpleNamespace(
                    id='call-4',
                    name='end_session',
                    args={'summary': 'Resumo preparado'},
                )
            ]
        )

        await session._handle_tool_call(tool_call)

        execute_tool_call_mock.assert_not_awaited()
        self.assertEqual(session.websocket.sent_payloads, [])
        self.assertFalse(session._session_end_requested)

        sent_input = session.active_genai_session.send.await_args.kwargs['input']
        self.assertEqual(sent_input[0].response['status'], 'ignored')
        self.assertEqual(sent_input[0].response['reason'], 'farewell_not_confirmed')
        self.assertFalse(sent_input[0].response['ended_session'])

    @patch('app.core.session.execute_journey_tool_call', new_callable=AsyncMock)
    async def test_handle_tool_call_emits_error_event_and_error_response_when_tool_execution_fails(self, execute_tool_call_mock: AsyncMock):
        session = self._build_session()
        execute_tool_call_mock.side_effect = RuntimeError('upstream timeout')

        tool_call = SimpleNamespace(
            function_calls=[
                SimpleNamespace(
                    id='call-5',
                    name='get_events',
                    args={'location': 'Fundao', 'limit': 1},
                )
            ]
        )

        await session._handle_tool_call(tool_call)

        self.assertEqual(len(session.websocket.sent_payloads), 1)
        self.assertEqual(session.websocket.sent_payloads[0]['type'], 'error')
        self.assertEqual(session.websocket.sent_payloads[0]['code'], 'tool_call_error')
        self.assertTrue(session.websocket.sent_payloads[0]['recoverable'])

        session.active_genai_session.send.assert_awaited_once()
        sent_input = session.active_genai_session.send.await_args.kwargs['input']
        self.assertEqual(sent_input[0].name, 'get_events')
        self.assertEqual(sent_input[0].response['status'], 'error')
        self.assertEqual(sent_input[0].response['reason'], 'tool_execution_failed')
        self.assertEqual(sent_input[0].response['rendered_items'], 0)
        self.assertFalse(sent_input[0].response['ended_session'])

    @patch('app.core.session.execute_journey_tool_call', new_callable=AsyncMock)
    async def test_handle_tool_call_marks_websocket_closed_when_ui_snapshot_send_fails(self, execute_tool_call_mock: AsyncMock):
        with patch('app.core.session.genai.Client', autospec=True):
            session = KioskSession(websocket=_ClosedFakeWebSocket(), session_id='session-closed-tool')

        session.active_genai_session = SimpleNamespace(send=AsyncMock())
        session.websocket.client_state = 'connected'
        session.websocket.application_state = 'connected'
        execute_tool_call_mock.return_value = JourneyToolResult(
            items=[
                UiSnapshotItem(
                    id='event-9',
                    kind='event',
                    title='Festival da Cereja',
                    sequence=9,
                    visual_state='active',
                )
            ]
        )

        tool_call = SimpleNamespace(
            function_calls=[
                SimpleNamespace(
                    id='call-6',
                    name='get_events',
                    args={'location': 'Fundao'},
                )
            ]
        )

        await session._handle_tool_call(tool_call)

        self.assertTrue(session._websocket_closed)
        session.active_genai_session.send.assert_awaited_once()
        sent_input = session.active_genai_session.send.await_args.kwargs['input']
        self.assertEqual(sent_input[0].response['status'], 'ok')

    @patch('app.core.session.execute_journey_tool_call', new_callable=AsyncMock)
    async def test_handle_tool_call_emits_specific_error_when_function_response_send_fails(self, execute_tool_call_mock: AsyncMock):
        session = self._build_session()
        session.active_genai_session = SimpleNamespace(send=AsyncMock(side_effect=RuntimeError('gemini send failed')))
        execute_tool_call_mock.return_value = JourneyToolResult(
            items=[
                UiSnapshotItem(
                    id='event-10',
                    kind='event',
                    title='Festival da Cereja',
                    sequence=10,
                    visual_state='active',
                )
            ]
        )

        tool_call = SimpleNamespace(
            function_calls=[
                SimpleNamespace(
                    id='call-7',
                    name='get_events',
                    args={'location': 'Fundao'},
                )
            ]
        )

        with self.assertRaisesRegex(RuntimeError, 'gemini send failed'):
            await session._handle_tool_call(tool_call)

        self.assertEqual(session.websocket.sent_payloads[0]['type'], 'ui_snapshot')
        self.assertEqual(session.websocket.sent_payloads[1]['type'], 'error')
        self.assertEqual(session.websocket.sent_payloads[1]['code'], 'gemini_tool_response_error')
        self.assertFalse(session.websocket.sent_payloads[1]['recoverable'])

    async def test_connect_to_gemini_restarts_receive_loop_when_gemini_reader_returns_cleanly(self):
        session = self._build_session()
        fake_live_session = SimpleNamespace()
        gemini_reads: list[str] = []

        async def fake_read_from_gemini(_session):
            gemini_reads.append('read')
            if len(gemini_reads) == 2:
                session._websocket_closed = True
            return 1

        async def fake_read_from_frontend():
            try:
                await asyncio.sleep(3600)
            except asyncio.CancelledError:
                return

        session.gemini_client = SimpleNamespace(
            aio=SimpleNamespace(
                live=SimpleNamespace(
                    connect=lambda **kwargs: _FakeLiveConnectContext(fake_live_session)
                )
            )
        )

        with patch.object(session, '_send_session_start', AsyncMock()), patch.object(
            session,
            '_read_from_gemini',
            side_effect=fake_read_from_gemini,
        ), patch.object(session, '_read_from_frontend', side_effect=fake_read_from_frontend):
            await session.connect_to_gemini()

        self.assertEqual(len(gemini_reads), 2)

    async def test_read_from_gemini_emits_turn_complete_event(self):
        session = self._build_session()
        fake_session = _FakeReceiveSession(
            [
                SimpleNamespace(
                    server_content=SimpleNamespace(
                        model_turn=SimpleNamespace(parts=[]),
                        turn_complete=True,
                    )
                )
            ]
        )

        await session._read_from_gemini(fake_session)

        self.assertEqual(len(session.websocket.sent_payloads), 1)
        self.assertEqual(session.websocket.sent_payloads[0]['type'], 'turn_complete')
        self.assertEqual(session.websocket.sent_payloads[0]['session_id'], 'session-1')

    async def test_read_from_gemini_does_not_create_ui_snapshot_from_plain_model_text(self):
        session = self._build_session()
        fake_session = _FakeReceiveSession(
            [
                SimpleNamespace(
                    server_content=SimpleNamespace(
                        model_turn=SimpleNamespace(
                            parts=[
                                SimpleNamespace(text='Offering Assistance I am ready to greet the user.')
                            ]
                        ),
                        turn_complete=False,
                    )
                )
            ]
        )

        await session._read_from_gemini(fake_session)

        self.assertEqual(len(session.websocket.sent_payloads), 1)
        self.assertEqual(session.websocket.sent_payloads[0]['type'], 'transcript_output')
        self.assertEqual(session.websocket.sent_payloads[0]['text'], 'Offering Assistance I am ready to greet the user.')
        self.assertEqual(session._ui_snapshot_items, [])

    async def test_read_from_gemini_emits_input_transcription_partial_and_final(self):
        session = self._build_session()
        fake_session = _FakeReceiveSession(
            [
                SimpleNamespace(
                    server_content=SimpleNamespace(
                        input_transcription=SimpleNamespace(text='Quero visitar', finished=False),
                        model_turn=None,
                        turn_complete=False,
                    )
                ),
                SimpleNamespace(
                    server_content=SimpleNamespace(
                        input_transcription=SimpleNamespace(text='Quero visitar', finished=False),
                        model_turn=None,
                        turn_complete=False,
                    )
                ),
                SimpleNamespace(
                    server_content=SimpleNamespace(
                        input_transcription=SimpleNamespace(text='Quero visitar Monsanto', finished=True),
                        model_turn=None,
                        turn_complete=False,
                    )
                ),
            ]
        )

        await session._read_from_gemini(fake_session)

        self.assertEqual(len(session.websocket.sent_payloads), 2)
        self.assertEqual(session.websocket.sent_payloads[0]['type'], 'transcript_input')
        self.assertEqual(session.websocket.sent_payloads[0]['text'], 'Quero visitar')
        self.assertFalse(session.websocket.sent_payloads[0]['is_final'])
        self.assertEqual(session.websocket.sent_payloads[1]['text'], 'Quero visitar Monsanto')
        self.assertTrue(session.websocket.sent_payloads[1]['is_final'])

    async def test_read_from_gemini_ignores_error_event_when_websocket_is_already_closed(self):
        with patch('app.core.session.genai.Client', autospec=True):
            session = KioskSession(websocket=_ClosedFakeWebSocket(), session_id='session-closed')

        session._websocket_closed = False
        session.websocket.client_state = 'connected'
        session.websocket.application_state = 'connected'

        await session._read_from_gemini(_FailingReceiveSession())

        self.assertTrue(session._websocket_closed)
        self.assertTrue(session._gemini_stream_failed)


if __name__ == '__main__':
    unittest.main()