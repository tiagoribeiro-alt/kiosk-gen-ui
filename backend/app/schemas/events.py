from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any, Literal

class BaseEvent(BaseModel):
    session_id: str
    turn_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)
    type: str

class AudioChunkEvent(BaseEvent):
    type: Literal["audio_chunk"] = "audio_chunk"
    data: str # base64
    sample_rate: int = 24000

class AudioInputEvent(BaseEvent):
    type: Literal["audio_input"] = "audio_input"
    data: str # base64
    mime_type: str = "audio/pcm;rate=16000"

class TranscriptInputEvent(BaseEvent):
    type: Literal["transcript_input"] = "transcript_input"
    text: str
    is_final: bool

class TranscriptOutputEvent(BaseEvent):
    type: Literal["transcript_output"] = "transcript_output"
    text: str

class TurnCompleteEvent(BaseEvent):
    type: Literal["turn_complete"] = "turn_complete"

class InterruptedEvent(BaseEvent):
    type: Literal["interrupted"] = "interrupted"

class SessionStartEvent(BaseEvent):
    type: Literal["session_start"] = "session_start"
    agent_id: str 
    greeting_audio: str

class SessionEndEvent(BaseEvent):
    type: Literal["session_end"] = "session_end"
    summary_url: Optional[str] = None
    qr_data: Optional[str] = None

class ErrorEvent(BaseEvent):
    type: Literal["error"] = "error"
    code: str
    message: str
    recoverable: bool
