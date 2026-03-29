import type {
  JourneyHandoff,
  JourneyConnectionState,
  JourneyItem,
  JourneyScene,
  JourneyStep,
  JourneyTranscript,
  JourneyVoiceState,
} from './types'
import type { UiSnapshotEvent, UiSnapshotItemPayload } from '../../lib/ws-events'

export type JourneySourceState = 'idle' | 'listening' | 'active' | 'farewell'

type CreateJourneySceneInput = {
  kioskState: JourneySourceState
  isConnected: boolean
  transcripts: Array<JourneyTranscript>
  items?: Array<JourneyItem>
  shellBrand?: string
  agentLabel?: string
  isAgentSpeaking?: boolean
}

function getJourneyStep(state: JourneySourceState, items: Array<JourneyItem>): JourneyStep {
  if (state === 'farewell') {
    return 'carry'
  }

  if (items.some((item) => item.kind === 'map' || item.kind === 'summary' || item.kind === 'qr')) {
    return 'plan'
  }

  return 'discover'
}

function getVoiceState(
  state: JourneySourceState,
  isAgentSpeaking: boolean | undefined,
): JourneyVoiceState {
  if (state === 'listening') {
    return 'listening'
  }

  if (isAgentSpeaking) {
    return 'speaking'
  }

  return 'idle'
}

function getConnectionState(isConnected: boolean): JourneyConnectionState {
  return isConnected ? 'connected' : 'disconnected'
}

function getStepTitle(step: JourneyStep): string {
  switch (step) {
    case 'discover':
      return 'Descobrir'
    case 'plan':
      return 'Planear'
    case 'carry':
      return 'Levar'
  }
}

function getJourneyStepTitle(step: JourneyStep): string {
  return getStepTitle(step)
}

function getJourneyVisualState(
  visualState: UiSnapshotItemPayload['visual_state'],
): JourneyItem['visualState'] {
  return visualState ?? 'active'
}

export function mapUiSnapshotItemToJourneyItem(item: UiSnapshotItemPayload): JourneyItem {
  const baseItem = {
    id: item.id,
    sequence: item.sequence,
    visualState: getJourneyVisualState(item.visual_state),
    anchor: item.anchor ?? undefined,
    imageUrl: item.imageUrl ?? item.image_url ?? undefined,
    thumbnailUrl: item.thumbnailUrl ?? item.thumbnail_url ?? undefined,
    imageAttribution: item.imageAttribution ?? item.image_attribution ?? undefined,
    sourceUrl: item.sourceUrl ?? item.source_url ?? undefined,
    latitude: item.latitude ?? undefined,
    longitude: item.longitude ?? undefined,
  }

  switch (item.kind) {
    case 'poi':
      return {
        ...baseItem,
        kind: 'poi',
        title: item.title,
        description: item.description ?? undefined,
        category: item.category ?? undefined,
        location: item.location ?? undefined,
      }
    case 'event':
      return {
        ...baseItem,
        kind: 'event',
        title: item.title,
        subTitle: item.sub_title ?? undefined,
        meta: item.meta ?? undefined,
      }
    case 'image':
      return {
        ...baseItem,
        kind: 'image',
        title: item.title,
        caption: item.caption ?? item.description ?? undefined,
      }
    case 'map':
      return {
        ...baseItem,
        kind: 'map',
        title: item.title,
        location: item.location ?? undefined,
      }
    case 'summary':
      return {
        ...baseItem,
        kind: 'summary',
        title: item.title,
        description: item.description ?? undefined,
      }
    case 'weather':
      return {
        ...baseItem,
        kind: 'weather',
        title: item.title,
        location: item.location ?? undefined,
        currentTemperatureC: item.current_temperature_c ?? 0,
        apparentTemperatureC: item.apparent_temperature_c ?? item.current_temperature_c ?? 0,
        weatherCode: item.weather_code ?? 0,
        weatherLabel: item.weather_label ?? 'Tempo variavel',
        windSpeedKmh: item.wind_speed_kmh ?? 0,
        dailyForecast: (item.daily_forecast ?? []).map((forecastDay) => ({
          date: forecastDay.date,
          label: forecastDay.label,
          weatherCode: forecastDay.weather_code,
          weatherLabel: forecastDay.weather_label,
          temperatureMaxC: forecastDay.temperature_max_c,
          temperatureMinC: forecastDay.temperature_min_c,
          precipitationProbabilityMax: forecastDay.precipitation_probability_max,
        })),
      }
    case 'qr':
      return {
        ...baseItem,
        kind: 'qr',
        title: item.title,
        description: item.description ?? undefined,
      }
  }
}

export function createJourneySceneFromSnapshot(
  snapshot: UiSnapshotEvent,
  input: Omit<CreateJourneySceneInput, 'items' | 'shellBrand' | 'agentLabel'>,
): JourneyScene {
  const scene = createJourneyScene({
    ...input,
    items: snapshot.items.map(mapUiSnapshotItemToJourneyItem),
    shellBrand: snapshot.shell?.brand ?? undefined,
    agentLabel: snapshot.shell?.agent_label ?? undefined,
  })

  const resolvedStep = snapshot.step ?? scene.step

  return {
    ...scene,
    step: resolvedStep,
    title: getJourneyStepTitle(resolvedStep),
    focusItemId: snapshot.focus_item_id ?? scene.focusItemId,
  }
}

export function applyJourneyHandoff(scene: JourneyScene, handoff: JourneyHandoff | null): JourneyScene {
  if (!handoff) {
    return scene
  }

  let summaryApplied = false
  let qrApplied = false

  const items = [...scene.items].reverse().map((item) => {
    if (item.kind === 'summary' && handoff.summaryUrl && !summaryApplied) {
      summaryApplied = true
      return {
        ...item,
        summaryUrl: handoff.summaryUrl,
      }
    }

    if (item.kind === 'qr' && (handoff.qrData || handoff.qrImageSrc) && !qrApplied) {
      qrApplied = true
      return {
        ...item,
        qrData: handoff.qrData,
        qrImageSrc: handoff.qrImageSrc,
      }
    }

    return item
  }).reverse()

  return {
    ...scene,
    items,
    step: items.some((item) => item.kind === 'summary' || item.kind === 'qr') ? 'carry' : scene.step,
    title: items.some((item) => item.kind === 'summary' || item.kind === 'qr') ? getJourneyStepTitle('carry') : scene.title,
  }
}

export function createJourneyScene({
  kioskState,
  isConnected,
  transcripts,
  items = [],
  shellBrand = 'Way Finder',
  agentLabel = 'CIM',
  isAgentSpeaking,
}: CreateJourneySceneInput): JourneyScene {
  const orderedItems = [...items].sort((left, right) => left.sequence - right.sequence)
  const step = getJourneyStep(kioskState, orderedItems)
  const transcript = transcripts.at(-1)?.text ?? null

  return {
    kioskState,
    shellBrand,
    agentLabel,
    title: getStepTitle(step),
    transcript,
    errorMessage: null,
    step,
    items: orderedItems,
    focusItemId: orderedItems.at(-1)?.id ?? null,
    connectionState: getConnectionState(isConnected),
    voiceState: getVoiceState(kioskState, isAgentSpeaking),
    farewellDeadline: null,
  }
}
