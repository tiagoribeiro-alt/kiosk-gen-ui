import type { JourneyItem, JourneyScene } from './types'

type JourneyMockState = 'idle' | 'listening' | 'active' | 'farewell'

function createItem(item: JourneyItem): JourneyItem {
  return item
}

const activeItems: Array<JourneyItem> = [
  createItem({
    id: 'event-1',
    kind: 'event',
    title: 'Festival da Cereja',
    subTitle: '2026-06-10 a 2026-06-15 • Fundao',
    meta: 'Musica, provas regionais e experiencias ao ar livre no centro da vila.',
    sequence: 1,
    visualState: 'receding',
    anchor: 'start',
  }),
  createItem({
    id: 'poi-1',
    kind: 'poi',
    title: 'Monsanto',
    location: 'Idanha-a-Nova',
    category: 'monument',
    sequence: 2,
    visualState: 'active',
    anchor: 'middle',
  }),
  createItem({
    id: 'image-1',
    kind: 'image',
    title: 'Galeria da Aldeia Histórica',
    caption: 'Vista panorâmica e ruas em granito',
    sequence: 3,
    visualState: 'active',
    anchor: 'middle',
  }),
  createItem({
    id: 'map-1',
    kind: 'map',
    title: 'Rota sugerida',
    location: 'Monsanto -> Idanha-a-Velha',
    sequence: 4,
    visualState: 'entering',
    anchor: 'end',
  }),
]

const midConversationItems: Array<JourneyItem> = [
  createItem({
    id: 'weather-10',
    kind: 'weather',
    title: 'Hoje em Monsanto',
    location: 'Monsanto',
    weatherCode: 2,
    weatherLabel: 'Sol com nuvens',
    currentTemperatureC: 16,
    apparentTemperatureC: 14,
    windSpeedKmh: 18,
    dailyForecast: [
      { date: '2026-03-17', label: 'Hoje', weatherCode: 2, weatherLabel: 'Sol a tarde', temperatureMaxC: 16, temperatureMinC: 8, precipitationProbabilityMax: 10 },
      { date: '2026-03-18', label: 'Amanha', weatherCode: 3, weatherLabel: 'Nublado', temperatureMaxC: 14, temperatureMinC: 7, precipitationProbabilityMax: 25 },
      { date: '2026-03-19', label: 'Quinta', weatherCode: 51, weatherLabel: 'Chuva fraca', temperatureMaxC: 12, temperatureMinC: 6, precipitationProbabilityMax: 60 },
    ],
    sequence: 10,
    visualState: 'receding',
    anchor: 'start',
  }),
  createItem({
    id: 'poi-10',
    kind: 'poi',
    title: 'Castelo de Monsanto',
    location: 'Idanha-a-Nova',
    category: 'monument',
    sequence: 11,
    visualState: 'active',
    anchor: 'middle',
  }),
  createItem({
    id: 'event-10',
    kind: 'event',
    title: 'Festival do Fumeiro',
    subTitle: '22 Mar • Sabugal • 10:00',
    meta: 'Enchidos DOP, broa e chourico artesanal com animacao folclorica e artesanato local.',
    sequence: 12,
    visualState: 'active',
    anchor: 'middle',
  }),
  createItem({
    id: 'map-10',
    kind: 'map',
    title: 'Trilha do Castelo',
    location: 'Entrada -> Muralhas -> Miradouro',
    sequence: 13,
    visualState: 'entering',
    anchor: 'end',
  }),
]

export function createJourneyMockScene(state: JourneyMockState): JourneyScene {
  if (state === 'idle') {
    return {
      kioskState: 'idle',
      shellBrand: 'Way Finder',
      agentLabel: '',
      title: 'Descobrir',
      transcript: null,
      errorMessage: null,
      step: 'discover',
      items: [],
      focusItemId: null,
      connectionState: 'connected',
      voiceState: 'idle',
      farewellDeadline: null,
    }
  }

  if (state === 'listening') {
    return {
      kioskState: 'listening',
      shellBrand: 'Way Finder',
      agentLabel: '',
      title: 'Descobrir',
      transcript: null,
      errorMessage: null,
      step: 'discover',
      items: activeItems.slice(0, 2),
      focusItemId: 'poi-1',
      connectionState: 'connected',
      voiceState: 'listening',
      farewellDeadline: null,
    }
  }

  if (state === 'farewell') {
    return {
      kioskState: 'farewell',
      shellBrand: 'Way Finder',
      agentLabel: '',
      title: 'Levar',
      transcript: null,
      errorMessage: null,
      step: 'carry',
      items: [
        ...activeItems.slice(1),
        createItem({
          id: 'summary-1',
          kind: 'summary',
          title: 'Resumo da visita',
          description: 'Monsanto, rota sugerida e galeria preparada para levar.',
          sequence: 5,
          visualState: 'active',
          anchor: 'middle',
        }),
        createItem({
          id: 'qr-1',
          kind: 'qr',
          title: 'QR de checkout',
          description: 'Scan para abrir o resumo no telemóvel.',
          sequence: 6,
          visualState: 'entering',
          anchor: 'end',
        }),
      ],
      focusItemId: 'qr-1',
      connectionState: 'connected',
      voiceState: 'speaking',
      farewellDeadline: null,
    }
  }

  return {
    kioskState: 'active',
    shellBrand: 'Way Finder',
    agentLabel: '',
    title: 'Planear',
    transcript: null,
    errorMessage: null,
    step: 'plan',
    items: midConversationItems,
    focusItemId: 'map-10',
    connectionState: 'connected',
    voiceState: 'speaking',
    farewellDeadline: null,
  }
}
