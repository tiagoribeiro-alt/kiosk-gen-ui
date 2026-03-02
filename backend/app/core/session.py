import asyncio
import base64
import json
import logging
from typing import Optional
from fastapi import WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types

from app.core.config import settings
from app.schemas.events import (
    AudioChunkEvent,
    AudioInputEvent,
    TranscriptInputEvent,
    TranscriptOutputEvent,
    ErrorEvent,
)

logger = logging.getLogger(__name__)

class KioskSession:
    def __init__(self, websocket: WebSocket, session_id: str):
        self.websocket = websocket
        self.session_id = session_id
        self.gemini_client = genai.Client(api_key=settings.gemini_api_key)
        self.active_genai_session = None

    async def connect_to_gemini(self):
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            # You can set system instructions or tools here later (M2) 
        )
        
        # Open parallel loops: Client WS -> Gemini WS and Gemini WS -> Client WS
        try:
            async with self.gemini_client.aio.live.connect(model=settings.model_name, config=config) as session:
                self.active_genai_session = session
                logger.info(f"Session {self.session_id} connected to Gemini Live!")
                
                # Start reading from Gemini and pipelining to Frontend
                gemini_task = asyncio.create_task(self._read_from_gemini(session))
                frontend_task = asyncio.create_task(self._read_from_frontend())
                
                done, pending = await asyncio.wait(
                    [gemini_task, frontend_task],
                    return_when=asyncio.FIRST_EXCEPTION
                )
                
                for task in pending:
                    task.cancel()
                    
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
                        input_msg = types.LiveClientRealtimeInput(
                            media_chunks=[types.Blob(data=raw_bytes, mime_type="audio/pcm;rate=16000")]
                        )
                        await self.active_genai_session.send(input=input_msg)
                
        except WebSocketDisconnect:
            logger.info("Frontend disconnected")
        except Exception as e:
            logger.error(f"Error reading from frontend: {e}")

    async def _read_from_gemini(self, session):
        try:
            async for message in session.receive():
                if message.server_content is None:
                    continue
                
                model_turn = message.server_content.model_turn
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
                # For M1, we can implement basic status passthrough here.
                # if getattr(message.server_content, "turn_complete", False):
                #   await self._send_event(TurnCompleteEvent(...))
        except Exception as e:
            logger.error(f"Error reading from Gemini: {e}")

    async def _send_event(self, event):
        await self.websocket.send_text(event.model_dump_json())
