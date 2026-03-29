import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { JourneyItem } from '../types'
import { JourneyCard } from './JourneyCard'

const weatherItem: JourneyItem = {
  id: 'weather-1',
  kind: 'weather',
  title: 'Tempo em Monsanto',
  sequence: 3,
  visualState: 'active',
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
    {
      date: '2025-03-11',
      label: 'Amanha',
      weatherCode: 63,
      weatherLabel: 'Chuva',
      temperatureMaxC: 21,
      temperatureMinC: 12,
      precipitationProbabilityMax: 60,
    },
  ],
}

const eventItem: JourneyItem = {
  id: 'event-1',
  kind: 'event',
  title: 'Festival da Cereja',
  subTitle: '2026-06-10 a 2026-06-15 • Fundao',
  meta: 'Programa com musica, gastronomia regional e concertos ao ar livre.',
  sequence: 4,
  visualState: 'active',
}

const summaryItem: JourneyItem = {
  id: 'summary-1',
  kind: 'summary',
  title: 'Resumo da visita',
  description: 'Monsanto, rota sugerida e agenda preparada para levar.',
  summaryUrl: 'https://example.com/resumo',
  sequence: 5,
  visualState: 'active',
}

const qrItem: JourneyItem = {
  id: 'qr-1',
  kind: 'qr',
  title: 'QR de checkout',
  description: 'Scan para abrir o resumo no telemovel.',
  qrData: 'qr://payload',
  qrImageSrc: 'data:image/png;base64,abc123',
  sequence: 6,
  visualState: 'active',
}

const mapItem: JourneyItem = {
  id: 'map-1',
  kind: 'map',
  title: 'Castelo no mapa',
  location: 'Monsanto',
  latitude: 40.0271,
  longitude: -7.1149,
  sequence: 7,
  visualState: 'active',
}

const imageItem: JourneyItem = {
  id: 'image-1',
  kind: 'image',
  title: 'Vista de Monsanto',
  caption: 'Granito e horizonte.',
  imageUrl: 'https://images.example/monsanto.jpg',
  thumbnailUrl: 'https://images.example/monsanto-thumb.jpg',
  imageAttribution: 'Photo by Ana Silva on Pexels',
  sequence: 9,
  visualState: 'active',
}

const mapFallbackItem: JourneyItem = {
  id: 'map-2',
  kind: 'map',
  title: 'Ponto em aberto',
  sequence: 8,
  visualState: 'active',
}

const poiItem: JourneyItem = {
  id: 'poi-1',
  kind: 'poi',
  title: 'Miradouro com um nome bastante longo para validar contencao visual',
  location: 'Coimbra, margem do rio com descricao mais extensa do que o habitual',
  sequence: 2,
  visualState: 'active',
}

describe('JourneyCard', () => {
  it('renders event cards with subtitle chips and summary copy', () => {
    const markup = renderToStaticMarkup(<JourneyCard item={eventItem} isFocused={false} />)

    expect(markup).toContain('data-journey-kind="event"')
    expect(markup).toContain('data-journey-variant="tall"')
    expect(markup).toContain('Agenda')
    expect(markup).toContain('Festival da Cereja')
    expect(markup).toContain('2026-06-10 a 2026-06-15')
    expect(markup).toContain('Fundao')
    expect(markup).toContain('Programa com musica, gastronomia regional e concertos ao ar livre.')
    expect(markup).not.toContain('[active]')
  })

  it('renders dedicated summary and qr handoff layouts', () => {
    const summaryMarkup = renderToStaticMarkup(<JourneyCard item={summaryItem} isFocused={false} />)
    const qrMarkup = renderToStaticMarkup(<JourneyCard item={qrItem} isFocused />)

    expect(summaryMarkup).toContain('data-journey-variant="wide"')
    expect(summaryMarkup).toContain('Resumo')
    expect(summaryMarkup).toContain('Resumo da visita')
    expect(summaryMarkup).toContain('example.com/resumo')
    expect(qrMarkup).toContain('data-journey-variant="hero"')
    expect(qrMarkup).toContain('Levar')
    expect(qrMarkup).toContain('QR code da visita')
    expect(qrMarkup).toContain('qr://payload')
    expect(qrMarkup).toContain('data-focused="true"')
  })

  it('renders a dedicated weather layout with current conditions and forecast days', () => {
    const markup = renderToStaticMarkup(<JourneyCard item={weatherItem} isFocused />)

    expect(markup).toContain('data-journey-kind="weather"')
    expect(markup).toContain('data-journey-variant="compact"')
    expect(markup).toContain('Tempo em Monsanto')
    expect(markup).toContain('Monsanto')
    expect(markup).toContain('24°')
    expect(markup).toContain('Pouco nublado')
    expect(markup).toContain('Hoje')
    expect(markup).toContain('Amanha')
    expect(markup).toContain('data-weather-icon="partly-cloudy"')
    expect(markup).toContain('data-weather-icon="rain"')
    expect(markup).toContain('25° / 14°')
    expect(markup).not.toContain('Sensacao')
    expect(markup).not.toContain('[active]')
    expect(markup).toContain('data-focused="true"')
  })

  it('uses the base variant for scenic cards and keeps text constrained', () => {
    const markup = renderToStaticMarkup(<JourneyCard item={poiItem} isFocused={false} />)

    expect(markup).toContain('data-journey-kind="poi"')
    expect(markup).toContain('data-journey-variant="base"')
    expect(markup).toContain('[-webkit-line-clamp:2]')
    expect(markup).toContain('aspect-square')
  })

  it('renders a real image for media-backed image cards', () => {
    const markup = renderToStaticMarkup(<JourneyCard item={imageItem} isFocused={false} />)

    expect(markup).toContain('src="https://images.example/monsanto-thumb.jpg"')
    expect(markup).toContain('alt="Vista de Monsanto"')
    expect(markup).toContain('Pexels')
    expect(markup).not.toContain('Photo by Ana Silva')
    expect(markup).toContain('Granito e horizonte.')
  })

  it('renders a coordinate-backed map preview when latitude and longitude are available', () => {
    const markup = renderToStaticMarkup(<JourneyCard item={mapItem} isFocused={false} />)

    expect(markup).toContain('data-journey-kind="map"')
    expect(markup).toContain('data-map-state="coordinates"')
    expect(markup).toContain('tile.openstreetmap.org/13/')
  })

  it('renders an explicit fallback when the map location is missing', () => {
    const markup = renderToStaticMarkup(<JourneyCard item={mapFallbackItem} isFocused={false} />)

    expect(markup).toContain('data-map-state="fallback"')
    expect(markup).toContain('Localizacao por confirmar')
    expect(markup).toContain('Sem localizacao precisa para gerar vista cartografica.')
  })

  it('keeps approximate map text when only location is available', () => {
    const approximateMapItem: JourneyItem = {
      id: 'map-3',
      kind: 'map',
      title: 'Mapa de contexto',
      location: 'Coimbra',
      sequence: 10,
      visualState: 'active',
    }

    const markup = renderToStaticMarkup(<JourneyCard item={approximateMapItem} isFocused={false} />)

    expect(markup).toContain('data-map-state="approximate"')
    expect(markup).toContain('tile.openstreetmap.org/10/')
  })

  it('renders route markers when the map card represents a route', () => {
    const routeMapItem: JourneyItem = {
      id: 'map-4',
      kind: 'map',
      title: 'Trilho do castelo',
      location: 'Monsanto → Castelo',
      latitude: 40.0405,
      longitude: -7.1146,
      sequence: 11,
      visualState: 'active',
    }

    const markup = renderToStaticMarkup(<JourneyCard item={routeMapItem} isFocused={false} />)

    expect(markup).toContain('data-map-state="coordinates"')
    expect(markup).toContain('stroke-[#0f4c81]')
    expect(markup).toContain('bg-emerald-500')
    expect(markup).toContain('bg-rose-500')
  })
})
