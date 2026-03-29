export type JourneyStep = 'discover' | 'plan' | 'carry'

export type JourneyConnectionState = 'connecting' | 'connected' | 'disconnected'

export type JourneyVoiceState = 'idle' | 'listening' | 'speaking'

export type JourneyVisualState = 'entering' | 'active' | 'receding' | 'exiting'

export type JourneyWeatherForecastDay = {
  date: string
  label: string
  weatherCode: number
  weatherLabel: string
  temperatureMaxC: number
  temperatureMinC: number
  precipitationProbabilityMax: number
}

export type JourneyHandoff = {
  summaryUrl?: string
  qrData?: string
  qrImageSrc?: string
}

type JourneyItemBase = {
  id: string
  sequence: number
  visualState: JourneyVisualState
  anchor?: 'start' | 'middle' | 'end'
  imageUrl?: string
  thumbnailUrl?: string
  imageAttribution?: string
  sourceUrl?: string
  latitude?: number
  longitude?: number
}

export type JourneyPoiItem = JourneyItemBase & {
  kind: 'poi'
  title: string
  description?: string
  category?: 'monument' | 'nature' | 'restaurant' | 'museum' | 'church' | 'hotel' | 'other'
  location?: string
}

export type JourneyEventItem = JourneyItemBase & {
  kind: 'event'
  title: string
  subTitle?: string
  meta?: string
}

export type JourneyImageItem = JourneyItemBase & {
  kind: 'image'
  title: string
  caption?: string
}

export type JourneyMapItem = JourneyItemBase & {
  kind: 'map'
  title: string
  location?: string
}

export type JourneySummaryItem = JourneyItemBase & {
  kind: 'summary'
  title: string
  description?: string
  summaryUrl?: string
}

export type JourneyWeatherItem = JourneyItemBase & {
  kind: 'weather'
  title: string
  location?: string
  currentTemperatureC: number
  apparentTemperatureC: number
  weatherCode: number
  weatherLabel: string
  windSpeedKmh: number
  dailyForecast: Array<JourneyWeatherForecastDay>
}

export type JourneyQrItem = JourneyItemBase & {
  kind: 'qr'
  title: string
  description?: string
  qrData?: string
  qrImageSrc?: string
}

export type JourneyItem =
  | JourneyPoiItem
  | JourneyEventItem
  | JourneyImageItem
  | JourneyMapItem
  | JourneySummaryItem
  | JourneyWeatherItem
  | JourneyQrItem

export type JourneyScene = {
  kioskState: 'idle' | 'listening' | 'active' | 'farewell'
  shellBrand: string
  agentLabel: string
  title: string
  transcript: string | null
  errorMessage: string | null
  step: JourneyStep
  items: Array<JourneyItem>
  focusItemId: string | null
  connectionState: JourneyConnectionState
  voiceState: JourneyVoiceState
  farewellDeadline: number | null
}

export type JourneyTranscript = {
  role: 'user' | 'agent'
  text: string
}
