export type WSBaseEvent = {
  session_id: string
  turn_id?: string | null
  timestamp: string
  type: string
}

export type AudioChunkEvent = WSBaseEvent & {
  type: 'audio_chunk'
  data: string
  sample_rate: number
}

export type TranscriptOutputEvent = WSBaseEvent & {
  type: 'transcript_output'
  text: string
}

export type TranscriptInputEvent = WSBaseEvent & {
  type: 'transcript_input'
  text: string
  is_final: boolean
}

export type TurnCompleteEvent = WSBaseEvent & {
  type: 'turn_complete'
}

export type SessionStartEvent = WSBaseEvent & {
  type: 'session_start'
  agent_id: string
  greeting_audio: string
}

export type UiSnapshotItemPayload = {
  id: string
  kind: 'poi' | 'event' | 'image' | 'map' | 'summary' | 'qr' | 'weather'
  title: string
  sequence: number
  visual_state?: 'entering' | 'active' | 'receding' | 'exiting'
  anchor?: 'start' | 'middle' | 'end'
  description?: string | null
  sub_title?: string | null
  meta?: string | null
  category?: 'monument' | 'nature' | 'restaurant' | 'museum' | 'church' | 'hotel' | 'other' | null
  location?: string | null
  caption?: string | null
  image_url?: string | null
  imageUrl?: string | null
  thumbnail_url?: string | null
  thumbnailUrl?: string | null
  image_attribution?: string | null
  imageAttribution?: string | null
  source_url?: string | null
  sourceUrl?: string | null
  latitude?: number | null
  longitude?: number | null
  current_temperature_c?: number | null
  apparent_temperature_c?: number | null
  weather_code?: number | null
  weather_label?: string | null
  wind_speed_kmh?: number | null
  daily_forecast?: Array<{
    date: string
    label: string
    weather_code: number
    weather_label: string
    temperature_max_c: number
    temperature_min_c: number
    precipitation_probability_max: number
  }> | null
}

export type UiSnapshotShellPayload = {
  brand?: string | null
  agent_label?: string | null
}

export type UiSnapshotEvent = WSBaseEvent & {
  type: 'ui_snapshot'
  items: Array<UiSnapshotItemPayload>
  shell?: UiSnapshotShellPayload | null
  step?: 'discover' | 'plan' | 'carry' | null
  focus_item_id?: string | null
}

export type SessionEndEvent = WSBaseEvent & {
  type: 'session_end'
  summary_url?: string | null
  qr_data?: string | null
}

export type ErrorEvent = WSBaseEvent & {
  type: 'error'
  code: string
  message: string
  recoverable: boolean
}

export type WSEventMap = {
  audio_chunk: AudioChunkEvent
  session_start: SessionStartEvent
  transcript_input: TranscriptInputEvent
  transcript_output: TranscriptOutputEvent
  ui_snapshot: UiSnapshotEvent
  session_end: SessionEndEvent
  turn_complete: TurnCompleteEvent
  error: ErrorEvent
}