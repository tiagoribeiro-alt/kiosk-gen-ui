import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { JourneyItem, JourneyScene } from '../types'
import { JourneyTimeline } from './JourneyTimeline'

function makeItem(sequence: number, title: string): JourneyItem {
  return {
    id: `poi-${sequence}`,
    kind: 'poi',
    title,
    location: `L${sequence}`,
    sequence,
    visualState: 'active',
  }
}

function makeScene(overrides: Partial<JourneyScene> = {}): JourneyScene {
  return {
    kioskState: 'active',
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
    ...overrides,
  }
}

describe('JourneyTimeline', () => {
  it('renders the connector when items exist', () => {
    const markup = renderToStaticMarkup(
      <JourneyTimeline scene={makeScene({ items: [makeItem(1, 'Monsanto'), makeItem(2, 'Idanha')], focusItemId: 'poi-2' })} />,
    )

    expect(markup).toContain('data-journey-connector="true"')
    expect(markup).toContain('data-journey-footprints="true"')
    expect(markup).toContain('<svg')
    expect(markup).toContain('stroke="transparent"')
  })

  it('does not render the connector when the timeline is empty', () => {
    const markup = renderToStaticMarkup(
      <JourneyTimeline scene={makeScene({ kioskState: 'idle', items: [], focusItemId: null })} />,
    )

    expect(markup).not.toContain('data-journey-connector="true"')
    expect(markup).toContain('data-journey-screensaver="true"')
    expect(markup).toContain('Mais Portugal para Descobrir')
    expect(markup).toContain('Falar comigo')
    expect(markup).toContain('Aproxime-se do ecra para iniciar uma nova conversa')
  })

  it('uses the same visual family for the listening empty state', () => {
    const markup = renderToStaticMarkup(
      <JourneyTimeline scene={makeScene({ kioskState: 'listening', items: [], focusItemId: null, voiceState: 'listening' })} />,
    )

    expect(markup).toContain('data-journey-empty-state="true"')
    expect(markup).toContain('Estou a preparar a conversa.')
    expect(markup).toContain('text-[#11286c]')
    expect(markup).not.toContain('rounded-[2.1rem]')
  })

  it('limits the visible timeline to the latest four items', () => {
    const markup = renderToStaticMarkup(
      <JourneyTimeline
        scene={makeScene({
          items: [
            makeItem(1, 'A'),
            makeItem(2, 'B'),
            makeItem(3, 'C'),
            makeItem(4, 'D'),
            makeItem(5, 'E'),
          ],
          focusItemId: 'poi-5',
        })}
      />,
    )

    expect(markup).not.toContain('>A<')
    expect(markup).toContain('>B<')
    expect(markup).toContain('>E<')
    expect(markup).not.toContain('[active]')
    expect(markup).toContain('mt-6')
    expect(markup).toContain('mt-8')
  })
})