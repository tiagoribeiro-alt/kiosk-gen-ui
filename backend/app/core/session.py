import asyncio
import base64
import io
import json
import logging
import math
from pathlib import Path
import struct
from typing import Optional
import wave
from fastapi import WebSocket, WebSocketDisconnect
from google import genai
from starlette.websockets import WebSocketState

from app.core.config import settings
from app.core.journey_tools import execute_journey_tool_call
from app.core.live_config import build_live_connect_config
from app.schemas.events import (
    AudioChunkEvent,
    AudioInputEvent,
    ErrorEvent,
    SessionStartEvent,
    SessionEndEvent,
    TranscriptInputEvent,
    TurnCompleteEvent,
    TranscriptOutputEvent,
    UiSnapshotEvent,
    UiSnapshotItem,
    UiSnapshotShell,
)

logger = logging.getLogger(__name__)


EXPLICIT_FAREWELL_PHRASES: tuple[str, ...] = (
    'adeus',
    'até logo',
    'ate logo',
    'até já',
    'ate ja',
    'tchau',
    'xau',
    'bye',
    'goodbye',
    'vou andando',
    'vou me embora',
    'vou-me embora',
    'tenho de ir',
    'tenho que ir',
)


class KioskSession:
    def __init__(self, websocket: WebSocket, session_id: str):
        self.websocket = websocket
        self.session_id = session_id
        self.gemini_client = genai.Client(api_key=settings.gemini_api_key)
        self.active_genai_session = None
        self._ui_snapshot_sequence = 0
        self._ui_snapshot_items: list[UiSnapshotItem] = []
        self._last_input_transcript: Optional[tuple[str, bool]] = None
        self._websocket_closed = False
        self._session_end_requested = False
        self._gemini_stream_failed = False

    def _resolve_greeting_audio_candidates(self) -> list[Path]:
        repo_root = Path(__file__).resolve().parents[3]
        legacy_root = repo_root.parent / 'eventuais-frontend'
        configured_path = Path(settings.greeting_audio_path) if settings.greeting_audio_path else None

        return [
            candidate
            for candidate in [
                configured_path,
                repo_root / 'frontend' / 'public' / 'audio' / 'greetings' / 'greeting-01.wav',
                legacy_root / 'public' / 'audio' / 'greetings' / 'greeting-01.wav',
            ]
            if candidate is not None
        ]

    def _load_greeting_audio_b64(self) -> str:
        for candidate in self._resolve_greeting_audio_candidates():
            try:
                if candidate.exists() and candidate.is_file():
                    return base64.b64encode(candidate.read_bytes()).decode('utf-8')
            except OSError as error:
                logger.warning('Failed to read greeting audio %s: %s', candidate, error)

        logger.warning('No greeting audio file available for agent %s', settings.agent_id)
        return self._build_fallback_greeting_audio_b64()

    def _build_fallback_greeting_audio_b64(self) -> str:
        sample_rate = 24_000
        duration_seconds = 0.35
        total_samples = int(sample_rate * duration_seconds)
        amplitude = 0.12
        frames = bytearray()

        for index in range(total_samples):
            envelope = 1.0 - (index / total_samples)
            sample = amplitude * envelope * math.sin((2.0 * math.pi * 523.25 * index) / sample_rate)
            frames.extend(struct.pack('<h', int(max(-1.0, min(1.0, sample)) * 32767)))

        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(bytes(frames))

        return base64.b64encode(buffer.getvalue()).decode('utf-8')

    async def _send_session_start(self):
        await self._send_event(
            SessionStartEvent(
                session_id=self.session_id,
                agent_id=settings.agent_id,
                greeting_audio=self._load_greeting_audio_b64(),
            )
        )

    async def connect_to_gemini(self):
        config = build_live_connect_config()
        self._session_end_requested = False
        self._gemini_stream_failed = False

        # Open parallel loops: Client WS -> Gemini WS and Gemini WS -> Client WS
        try:
            async with self.gemini_client.aio.live.connect(model=settings.model_name, config=config) as session:
                self.active_genai_session = session
                logger.info(f"Session {self.session_id} connected to Gemini Live!")
                await self._send_session_start()

                frontend_task = asyncio.create_task(self._read_from_frontend())
                try:
                    while not self._websocket_closed and not self._session_end_requested:
                        gemini_task = asyncio.create_task(self._read_from_gemini(session))

                        done, pending = await asyncio.wait(
                            [gemini_task, frontend_task],
                            return_when=asyncio.FIRST_COMPLETED,
                        )

                        if frontend_task in done:
                            if gemini_task in pending:
                                gemini_task.cancel()
                                await asyncio.gather(gemini_task, return_exceptions=True)

                            exception = frontend_task.exception()
                            if exception is not None:
                                raise exception
                            break

                        message_count = gemini_task.result()

                        if self._session_end_requested or self._websocket_closed:
                            break

                        if self._gemini_stream_failed:
                            break

                        if message_count == 0:
                            await self._send_event(
                                ErrorEvent(
                                    session_id=self.session_id,
                                    code="gemini_stream_closed",
                                    message="A ligacao ao modelo terminou inesperadamente.",
                                    recoverable=False,
                                )
                            )
                            break

                        logger.warning(
                            "Gemini receive loop ended without explicit shutdown for session %s after %s messages; restarting.",
                            self.session_id,
                            message_count,
                        )
                finally:
                    if not frontend_task.done():
                        frontend_task.cancel()
                    await asyncio.gather(frontend_task, return_exceptions=True)

        except Exception as e:
            logger.error(f"Gemini connection error: {e}")
            await self._send_event(ErrorEvent(
                session_id=self.session_id,
                code="gemini_error",
                message=str(e),
                recoverable=False
            ))

    async def _read_from_frontend(self):
        try:
            while True:
                data = await self.websocket.receive_text()
                message = json.loads(data)
                
                # Only processing audio_input for M1
                if message.get("type") == "audio_input":
                    event = AudioInputEvent(**message)
                    if self.active_genai_session:
                        raw_bytes = base64.b64decode(event.data)
                        input_msg = genai.types.LiveClientRealtimeInput(
                            media_chunks=[genai.types.Blob(data=raw_bytes, mime_type="audio/pcm;rate=16000")]
                        )
                        await self.active_genai_session.send(input=input_msg)
                
        except WebSocketDisconnect:
            logger.info("Frontend disconnected")
            self._websocket_closed = True
        except Exception as e:
            logger.error(f"Error reading from frontend: {e}")
            await self._send_event(ErrorEvent(
                session_id=self.session_id,
                code="frontend_read_error",
                message=str(e),
                recoverable=True,
            ))

    async def _read_from_gemini(self, session):
        message_count = 0
        try:
            async for message in session.receive():
                message_count += 1
                if message.server_content is None:
                    tool_call = getattr(message, "tool_call", None)
                    if tool_call is not None:
                        await self._handle_tool_call(tool_call)
                        if self._session_end_requested:
                            return message_count
                    continue

                server_content = message.server_content
                await self._emit_input_transcript(getattr(server_content, 'input_transcription', None))

                model_turn = getattr(server_content, 'model_turn', None)
                if model_turn:
                    for part in model_turn.parts:
                        # Forward audio back to frontend
                        if getattr(part, "inline_data", None) and getattr(part.inline_data, "data", None):
                            audio_b64 = base64.b64encode(part.inline_data.data).decode("utf-8")
                            await self._send_event(AudioChunkEvent(
                                session_id=self.session_id,
                                data=audio_b64,
                                sample_rate=24000
                            ))
                            
                        # Forward transcriptions if available
                        if getattr(part, "text", None):
                            await self._send_event(TranscriptOutputEvent(
                                session_id=self.session_id,
                                text=part.text
                            ))

                # Handle turn complete / interrupted (if needed for UX state)
                if getattr(server_content, "turn_complete", False):
                    await self._send_event(TurnCompleteEvent(session_id=self.session_id))
        except Exception as e:
            self._gemini_stream_failed = True
            logger.exception(f"Error reading from Gemini: {e}")
            await self._send_event(ErrorEvent(
                session_id=self.session_id,
                code="gemini_stream_error",
                message=str(e),
                recoverable=True,
            ))

        return message_count

    async def _emit_input_transcript(self, input_transcription):
        text = getattr(input_transcription, 'text', None)
        if not text:
            return

        normalized_text = self._normalize_ui_text(text)
        if not normalized_text:
            return

        is_final = bool(getattr(input_transcription, 'finished', False))
        current_transcript = (normalized_text, is_final)
        if current_transcript == self._last_input_transcript:
            return

        self._last_input_transcript = current_transcript
        await self._send_event(
            TranscriptInputEvent(
                session_id=self.session_id,
                text=normalized_text,
                is_final=is_final,
            )
        )

    def _normalize_ui_text(self, text: str) -> str:
        return " ".join(text.split())

    def _is_explicit_session_end_request(self) -> bool:
        if self._last_input_transcript is None:
            return False

        last_text, is_final = self._last_input_transcript
        if not is_final:
            return False

        normalized = last_text.casefold()
        return any(phrase in normalized for phrase in EXPLICIT_FAREWELL_PHRASES)

    def _build_function_response(self, function_call, tool_name: str, response_payload: dict):
        response_kwargs = {
            'name': tool_name,
            'response': response_payload,
        }
        function_call_id = getattr(function_call, 'id', None)
        if function_call_id:
            response_kwargs['id'] = function_call_id
        else:
            logger.warning(
                'Gemini tool call %s for session %s arrived without an id; sending FunctionResponse without correlation id.',
                tool_name,
                self.session_id,
            )

        return genai.types.FunctionResponse(**response_kwargs)

    async def _handle_tool_call(self, tool_call):
        function_calls = getattr(tool_call, "function_calls", None) or []
        function_responses: list[genai.types.FunctionResponse] = []
        handled_tool_names: list[str] = []

        for function_call in function_calls:
            tool_name = getattr(function_call, "name", None)
            if not tool_name:
                continue

            handled_tool_names.append(tool_name)

            session_should_end = tool_name == 'end_session'

            if session_should_end and not self._is_explicit_session_end_request():
                logger.info(
                    'Ignoring premature end_session for session %s because the last user utterance was not an explicit farewell.',
                    self.session_id,
                )
                function_responses.append(
                    self._build_function_response(
                        function_call=function_call,
                        tool_name=tool_name,
                        response_payload={
                            "status": "ignored",
                            "rendered_items": 0,
                            "ended_session": False,
                            "reason": "farewell_not_confirmed",
                        },
                    )
                )
                continue

            try:
                result = await execute_journey_tool_call(
                    tool_name=tool_name,
                    args=getattr(function_call, "args", None),
                    next_sequence=self._ui_snapshot_sequence + 1,
                )
            except Exception as error:
                logger.exception('Tool call %s failed for session %s', tool_name, self.session_id)
                await self._send_event(
                    ErrorEvent(
                        session_id=self.session_id,
                        code='tool_call_error',
                        message=f'A ferramenta {tool_name} falhou. Tente novamente.',
                        recoverable=True,
                    )
                )
                function_responses.append(
                    self._build_function_response(
                        function_call=function_call,
                        tool_name=tool_name,
                        response_payload={
                            'status': 'error',
                            'rendered_items': 0,
                            'ended_session': False,
                            'reason': 'tool_execution_failed',
                            'message': str(error),
                        },
                    )
                )
                continue

            if result.items:
                if self._ui_snapshot_items:
                    self._ui_snapshot_items[-1].visual_state = "receding"

                self._ui_snapshot_items.extend(result.items)
                self._ui_snapshot_sequence = self._ui_snapshot_items[-1].sequence

                await self._send_event(
                    UiSnapshotEvent(
                        session_id=self.session_id,
                        items=list(self._ui_snapshot_items),
                        shell=UiSnapshotShell(brand="Way Finder", agent_label="CIM"),
                        focus_item_id=self._ui_snapshot_items[-1].id,
                        step="carry" if session_should_end or result.qr_data or result.summary_url else None,
                    )
                )

            if session_should_end:
                self._session_end_requested = True
                await self._send_event(
                    SessionEndEvent(
                        session_id=self.session_id,
                        summary_url=result.summary_url,
                        qr_data=result.qr_data,
                    )
                )

            function_responses.append(
                self._build_function_response(
                    function_call=function_call,
                    tool_name=tool_name,
                    response_payload={
                        "status": "ok",
                        "rendered_items": len(result.items),
                        "ended_session": session_should_end,
                    },
                )
            )

            if session_should_end:
                break

        if function_responses and self.active_genai_session:
            try:
                await self.active_genai_session.send(input=function_responses)
            except Exception:
                logger.exception(
                    'Failed to send FunctionResponse to Gemini for session %s after tools %s',
                    self.session_id,
                    ', '.join(handled_tool_names) if handled_tool_names else '<unknown>',
                )
                await self._send_event(
                    ErrorEvent(
                        session_id=self.session_id,
                        code='gemini_tool_response_error',
                        message='Nao foi possivel concluir a resposta da ferramenta.',
                        recoverable=False,
                    )
                )
                raise

    async def _send_event(self, event):
        if self._websocket_closed:
            return False

        if self.websocket.client_state is WebSocketState.DISCONNECTED:
            self._websocket_closed = True
            return False

        if self.websocket.application_state is WebSocketState.DISCONNECTED:
            self._websocket_closed = True
            return False

        try:
            await self.websocket.send_text(event.model_dump_json())
            return True
        except (RuntimeError, WebSocketDisconnect) as error:
            self._websocket_closed = True
            logger.info('Skipping websocket send for closed session %s: %s', self.session_id, error)
        except Exception:
            logger.exception(
                'Failed to serialize or send %s for session %s',
                getattr(event, 'type', event.__class__.__name__),
                self.session_id,
            )

        return False
