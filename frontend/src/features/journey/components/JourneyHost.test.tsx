import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { JourneyScene } from '../types'
import { JourneyHost } from './JourneyHost'

function createScene(overrides: Partial<JourneyScene> = {}): JourneyScene {
  return {
    kioskState: 'idle',
    shellBrand: 'Way Finder',
    agentLabel: 'CIM',
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

describe('JourneyHost', () => {
  it('renders the empty-state message when there are no items', () => {
    const markup = renderToStaticMarkup(<JourneyHost scene={createScene()} />)

    expect(markup).toContain('data-journey-screensaver="true"')
    expect(markup).toContain('Mais Portugal para Descobrir')
    expect(markup).toContain('Falar comigo')
    expect(markup).toContain('Passo atual')
    expect(markup).toContain('data-journey-step="discover"')
    expect(markup).toContain('aria-current="step"')
    expect(markup).toContain('data-journey-waveform="true"')
  })

  it('renders stage chrome but keeps transcript copy out of the shell', () => {
    const markup = renderToStaticMarkup(
      <JourneyHost scene={createScene({ title: 'Planear', step: 'plan', transcript: 'Este e o melhor percurso para hoje.' })} />,
    )

    expect(markup).toContain('way_finder')
    expect(markup).toContain('alt="Way Finder"')
    expect(markup).toContain('Passo atual')
    expect(markup).toContain('Planear')
    expect(markup).toContain('data-journey-step="plan"')
    expect(markup).not.toContain('Este e o melhor percurso para hoje.')
  })

  it('renders at most four visible cards and focuses the requested item', () => {
    const scene = createScene({
      kioskState: 'active',
      items: [
        { id: 'poi-1', kind: 'poi', title: 'A', sequence: 1, visualState: 'active', location: 'L1' },
        { id: 'poi-2', kind: 'poi', title: 'B', sequence: 2, visualState: 'active', location: 'L2' },
        { id: 'poi-3', kind: 'poi', title: 'C', sequence: 3, visualState: 'active', location: 'L3' },
        { id: 'poi-4', kind: 'poi', title: 'D', sequence: 4, visualState: 'active', location: 'L4' },
        { id: 'poi-5', kind: 'poi', title: 'E', sequence: 5, visualState: 'active', location: 'L5' },
      ],
      focusItemId: 'poi-5',
    })

    const markup = renderToStaticMarkup(<JourneyHost scene={scene} />)

    expect(markup).not.toContain('>A<')
    expect(markup).toContain('>B<')
    expect(markup).toContain('>E<')
    expect(markup).toContain('data-focused="true"')
  })

  it('renders countdown bar and label when farewellDeadline is set', () => {
    const scene = createScene({
      kioskState: 'farewell',
      step: 'carry',
      title: 'Levar',
      farewellDeadline: Date.now() + 10_000,
    })

    const markup = renderToStaticMarkup(<JourneyHost scene={scene} />)

    expect(markup).toContain('Regressa ao inicio em')
    expect(markup).not.toContain('data-journey-waveform="true"')
  })

  it('hides countdown and shows waveform when farewellDeadline is null', () => {
    const scene = createScene({ farewellDeadline: null })

    const markup = renderToStaticMarkup(<JourneyHost scene={scene} />)

    expect(markup).toContain('data-journey-waveform="true"')
    expect(markup).not.toContain('Regressa ao inicio em')
  })

  it('renders a visible error banner when the session reports a recoverable failure', () => {
    const markup = renderToStaticMarkup(
      <JourneyHost scene={createScene({ errorMessage: 'Ligacao ao backend perdida. A tentar recuperar.' })} />,
    )

    expect(markup).toContain('Ligacao ao backend perdida. A tentar recuperar.')
  })
})