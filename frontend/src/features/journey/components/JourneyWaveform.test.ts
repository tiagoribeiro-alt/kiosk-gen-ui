import { describe, expect, it } from 'vitest'

import { ZERO_FREQUENCY_DATA, type FrequencyData } from '../../../lib/audio'
import { getWaveformPalette, resolveStableVisualState, resolveWaveformMotion } from './JourneyWaveform'

function createFrequencyData(overrides: Partial<FrequencyData> = {}): FrequencyData {
  return {
    ...ZERO_FREQUENCY_DATA,
    ...overrides,
  }
}

describe('JourneyWaveform helpers', () => {
  it('uses the lighter shell palette for idle, listening, and speaking', () => {
    expect(getWaveformPalette('idle')).toMatchObject({
      primary: 'rgb(71 85 105 / 0.56)',
      targetAmplitude: 0.09,
    })
    expect(getWaveformPalette('listening')).toMatchObject({
      primary: 'rgb(14 165 233 / 0.88)',
      targetAmplitude: 0.16,
    })
    expect(getWaveformPalette('speaking')).toMatchObject({
      primary: 'rgb(8 145 178 / 0.9)',
      targetAmplitude: 0.19,
    })
  })

  it('falls back to state-driven motion when live audio is unavailable', () => {
    const motion = resolveWaveformMotion('listening')

    expect(motion.visualState).toBe('listening')
    expect(motion.targetAmplitude).toBe(0.16)
    expect(motion.lineWidthTarget).toBeGreaterThan(1)
    expect(motion.perLineIntensity.every((value) => value >= 0.36)).toBe(true)
  })

  it('switches to listening visuals when microphone energy is present during active conversation', () => {
    const motion = resolveWaveformMotion(
      'idle',
      createFrequencyData({ low: 0.08, mid: 0.22, high: 0.14, average: 0.19 }),
      ZERO_FREQUENCY_DATA,
    )

    expect(motion.visualState).toBe('listening')
    expect(motion.targetAmplitude).toBeGreaterThan(0.16)
    expect(motion.lineWidthTarget).toBeGreaterThan(1.3)
    expect(motion.perLineIntensity[0]).toBeGreaterThanOrEqual(0.22)
  })

  it('prefers playback energy over microphone energy when both are present', () => {
    const motion = resolveWaveformMotion(
      'listening',
      createFrequencyData({ low: 0.1, mid: 0.18, high: 0.12, average: 0.16 }),
      createFrequencyData({ low: 0.2, mid: 0.34, high: 0.28, average: 0.3 }),
    )

    expect(motion.visualState).toBe('speaking')
    expect(motion.targetAmplitude).toBeGreaterThan(0.22)
    expect(motion.perLineIntensity[0]).toBeGreaterThanOrEqual(0.34)
  })

  it('holds the previous visual state briefly to avoid rapid color flicker', () => {
    const visualState = resolveStableVisualState({
      voiceState: 'idle',
      inputStrength: 0,
      outputStrength: 0.03,
      previousVisualState: 'listening',
      lastVisualStateChangeAt: 2_000,
      now: 2_400,
    })

    expect(visualState).toBe('listening')
  })

  it('switches visual state after the hold window when output remains dominant', () => {
    const motion = resolveWaveformMotion(
      'idle',
      ZERO_FREQUENCY_DATA,
      createFrequencyData({ low: 0.18, mid: 0.34, high: 0.2, average: 0.27 }),
      'listening',
      1_000,
      2_100,
    )

    expect(motion.visualState).toBe('speaking')
  })
})