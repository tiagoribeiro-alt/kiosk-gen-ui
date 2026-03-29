from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Literal

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


class UiSnapshotShell(BaseModel):
    brand: Optional[str] = None
    agent_label: Optional[str] = None


class UiSnapshotWeatherForecastDay(BaseModel):
    date: str
    label: str
    weather_code: int
    weather_label: str
    temperature_max_c: float
    temperature_min_c: float
    precipitation_probability_max: int


class UiSnapshotItem(BaseModel):
    id: str
    kind: Literal["poi", "event", "image", "map", "summary", "qr", "weather"]
    title: str
    sequence: int
    visual_state: Literal["entering", "active", "receding", "exiting"] = "active"
    anchor: Optional[Literal["start", "middle", "end"]] = None
    description: Optional[str] = None
    sub_title: Optional[str] = None
    meta: Optional[str] = None
    category: Optional[Literal["monument", "nature", "restaurant", "museum", "church", "hotel", "other"]] = None
    location: Optional[str] = None
    caption: Optional[str] = None
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    image_attribution: Optional[str] = None
    source_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    current_temperature_c: Optional[float] = None
    apparent_temperature_c: Optional[float] = None
    weather_code: Optional[int] = None
    weather_label: Optional[str] = None
    wind_speed_kmh: Optional[float] = None
    daily_forecast: list[UiSnapshotWeatherForecastDay] = Field(default_factory=list)


class UiSnapshotEvent(BaseEvent):
    type: Literal["ui_snapshot"] = "ui_snapshot"
    items: list[UiSnapshotItem] = Field(default_factory=list)
    shell: Optional[UiSnapshotShell] = None
    step: Optional[Literal["discover", "plan", "carry"]] = None
    focus_item_id: Optional[str] = None

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
