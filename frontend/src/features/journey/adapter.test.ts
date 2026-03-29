import { describe, expect, it } from 'vitest'
import { applyJourneyHandoff, createJourneyScene, createJourneySceneFromSnapshot, mapUiSnapshotItemToJourneyItem } from './adapter'
import type { JourneyItem, JourneyTranscript } from './types'
import type { UiSnapshotEvent } from '../../lib/ws-events'

function makePoi(sequence: number, title: string): JourneyItem {
  return {
    id: `poi-${sequence}`,
    kind: 'poi',
    title,
    sequence,
    visualState: 'active',
    location: 'Castelo Branco',
  }
}

describe('createJourneyScene', () => {
  it('orders items by sequence and focuses the most recent item', () => {
    const scene = createJourneyScene({
      kioskState: 'active',
      isConnected: true,
      transcripts: [],
      items: [makePoi(2, 'Monsanto'), makePoi(1, 'Castelo Branco')],
    })

    expect(scene.items.map((item) => item.id)).toEqual(['poi-1', 'poi-2'])
    expect(scene.focusItemId).toBe('poi-2')
    expect(scene.step).toBe('discover')
    expect(scene.errorMessage).toBeNull()
  })

  it('promotes the scene to plan when a map is present', () => {
    const scene = createJourneyScene({
      kioskState: 'active',
      isConnected: true,
      transcripts: [],
      items: [
        {
          id: 'map-1',
          kind: 'map',
          title: 'Rota sugerida',
          sequence: 3,
          visualState: 'active',
          location: 'Monsanto',
        },
      ],
    })

    expect(scene.step).toBe('plan')
    expect(scene.title).toBe('Planear')
  })

  it('uses carry during farewell regardless of item mix', () => {
    const scene = createJourneyScene({
      kioskState: 'farewell',
      isConnected: false,
      transcripts: [],
      items: [makePoi(1, 'Monsanto')],
    })

    expect(scene.step).toBe('carry')
    expect(scene.title).toBe('Levar')
  })

  it('uses the latest transcript and listening voice state', () => {
    const transcripts: Array<JourneyTranscript> = [
      { role: 'user', text: 'Quero monumentos' },
      { role: 'agent', text: 'Aqui tens algumas sugestões' },
    ]

    const scene = createJourneyScene({
      kioskState: 'listening',
      isConnected: true,
      transcripts,
    })

    expect(scene.transcript).toBe('Aqui tens algumas sugestões')
    expect(scene.voiceState).toBe('listening')
    expect(scene.connectionState).toBe('connected')
  })

  it('uses speaking voice state when the agent is speaking', () => {
    const scene = createJourneyScene({
      kioskState: 'active',
      isConnected: true,
      transcripts: [],
      isAgentSpeaking: true,
    })

    expect(scene.voiceState).toBe('speaking')
  })

  it('maps a raw ui_snapshot item into the Journey contract with defaults', () => {
    const item = mapUiSnapshotItemToJourneyItem({
      id: 'snapshot-1',
      kind: 'event',
      title: 'Resposta do agente',
      sequence: 3,
      meta: 'Sugestao em curso',
    })

    expect(item).toEqual({
      id: 'snapshot-1',
      kind: 'event',
      title: 'Resposta do agente',
      sequence: 3,
      visualState: 'active',
      meta: 'Sugestao em curso',
      anchor: undefined,
      subTitle: undefined,
    })
  })

  it('maps additive media and coordinate fields through to Journey items', () => {
    const item = mapUiSnapshotItemToJourneyItem({
      id: 'poi-1',
      kind: 'poi',
      title: 'Monsanto',
      sequence: 4,
      location: 'Idanha-a-Nova',
      image_url: 'https://images.example/monsanto.jpg',
      thumbnail_url: 'https://images.example/monsanto-thumb.jpg',
      image_attribution: 'Foto por Ana Silva',
      source_url: 'https://visit.example/monsanto',
      latitude: 40.0271,
      longitude: -7.1149,
    })

    expect(item).toMatchObject({
      kind: 'poi',
      imageUrl: 'https://images.example/monsanto.jpg',
      thumbnailUrl: 'https://images.example/monsanto-thumb.jpg',
      imageAttribution: 'Foto por Ana Silva',
      sourceUrl: 'https://visit.example/monsanto',
      latitude: 40.0271,
      longitude: -7.1149,
    })
  })

  it('creates a Journey scene from a raw ui_snapshot event', () => {
    const snapshot: UiSnapshotEvent = {
      type: 'ui_snapshot',
      session_id: 'session-1',
      timestamp: new Date().toISOString(),
      items: [
        {
          id: 'item-2',
          kind: 'event',
          title: 'Segundo',
          sequence: 2,
          meta: 'meta 2',
          visual_state: 'active',
        },
        {
          id: 'item-1',
          kind: 'poi',
          title: 'Primeiro',
          sequence: 1,
          location: 'Monsanto',
          visual_state: 'receding',
        },
      ],
      shell: {
        brand: 'Way Finder',
        agent_label: 'CIM',
      },
      focus_item_id: 'item-1',
      step: 'plan',
    }

    const scene = createJourneySceneFromSnapshot(snapshot, {
      kioskState: 'active',
      isConnected: true,
      transcripts: [],
    })

    expect(scene.items.map((item) => item.id)).toEqual(['item-1', 'item-2'])
    expect(scene.focusItemId).toBe('item-1')
    expect(scene.title).toBe('Planear')
    expect(scene.step).toBe('plan')
    expect(scene.shellBrand).toBe('Way Finder')
  })

  it('maps a weather snapshot into a dedicated Journey weather item', () => {
    const item = mapUiSnapshotItemToJourneyItem({
      id: 'weather-1',
      kind: 'weather',
      title: 'Meteorologia em Monsanto',
      sequence: 6,
      location: 'Monsanto',
      current_temperature_c: 24.4,
      apparent_temperature_c: 23.1,
      weather_code: 1,
      weather_label: 'Pouco nublado',
      wind_speed_kmh: 18.2,
      daily_forecast: [
        {
          date: '2025-03-10',
          label: 'Hoje',
          weather_code: 1,
          weather_label: 'Pouco nublado',
          temperature_max_c: 25,
          temperature_min_c: 14,
          precipitation_probability_max: 10,
        },
      ],
    })

    expect(item).toEqual({
      id: 'weather-1',
      kind: 'weather',
      title: 'Meteorologia em Monsanto',
      sequence: 6,
      visualState: 'active',
      anchor: undefined,
      location: 'Monsanto',
      currentTemperatureC: 24.4,
      apparentTemperatureC: 23.1,
      weatherCode: 1,
      weatherLabel: 'Pouco nublado',
      windSpeedKmh: 18.2,
      dailyForecast: [
        {
          date: '2025-03-10',
          label: 'Hoje',
          weatherCode: 1,
          weatherLabel: 'Pouco nublado',
          temperatureMaxC: 25,
          temperatureMinC: 14,
          precipitationProbabilityMax: 10,
        },
      ],
    })
  })

  it('applies session_end handoff data to the latest summary and qr items', () => {
    const scene = createJourneyScene({
      kioskState: 'active',
      isConnected: true,
      transcripts: [],
      items: [
        {
          id: 'summary-1',
          kind: 'summary',
          title: 'Resumo da visita',
          sequence: 3,
          visualState: 'active',
          description: 'Conteudo preparado.',
        },
        {
          id: 'qr-1',
          kind: 'qr',
          title: 'QR de checkout',
          sequence: 4,
          visualState: 'active',
          description: 'Leva a visita contigo.',
        },
      ],
    })

    const enriched = applyJourneyHandoff(scene, {
      summaryUrl: 'https://example.com/resumo',
      qrData: 'qr://payload',
      qrImageSrc: 'data:image/png;base64,abc123',
    })

    expect(enriched.step).toBe('carry')
    expect(enriched.title).toBe('Levar')
    expect(enriched.items[0]).toMatchObject({
      kind: 'summary',
      summaryUrl: 'https://example.com/resumo',
    })
    expect(enriched.items[1]).toMatchObject({
      kind: 'qr',
      qrData: 'qr://payload',
      qrImageSrc: 'data:image/png;base64,abc123',
    })
  })
})