import type { MutableRefObject } from 'react'
import { useEffect, useRef } from 'react'
import type { JourneyVoiceState } from '../types'
import type { FrequencyData } from '../../../lib/audio'
import { ZERO_FREQUENCY_DATA } from '../../../lib/audio'
import { journeyWaveformClassNames } from '../theme'

type JourneyWaveformProps = {
  voiceState: JourneyVoiceState
  inputSignalRef?: MutableRefObject<FrequencyData>
  outputSignalRef?: MutableRefObject<FrequencyData>
}

type WaveformVisualState = JourneyVoiceState

type WaveformMotion = {
  visualState: WaveformVisualState
  targetAmplitude: number
  lineWidthTarget: number
  fillOpacityBase: number
  perLineIntensity: Array<number>
}

type StableVisualStateInput = {
  voiceState: JourneyVoiceState
  inputStrength: number
  outputStrength: number
  previousVisualState: WaveformVisualState
  lastVisualStateChangeAt: number
  now: number
}

const WAVE_CONFIG = {
  lineCount: 4,
  baseAmplitude: 0.1,
  maxAmplitude: 0.25,
  baseSpeeds: [0.018, 0.028, 0.04, 0.055],
  speedMultipliers: [0.8, 1.5, 2.5, 3.5],
  accelerationFactors: [0.08, 0.12, 0.16, 0.2],
  phaseOffset: Math.PI / 3,
  frequencyOffset: 0.3,
  baseLineWidths: [2.5, 2, 1.5, 1],
  activeLineWidthMultiplier: 1.8,
  lineOpacities: [0.8, 0.5, 0.3, 0.15],
} as const

const AUDIO_ACTIVITY_ENTER_THRESHOLD = 0.022
const AUDIO_ACTIVITY_EXIT_THRESHOLD = 0.01
const VISUAL_STATE_MIN_HOLD_MS = 900

function clamp01(value: number): number {
  return Math.max(0, Math.min(value, 1))
}

function getSignalStrength(signal: FrequencyData | null | undefined): number {
  return clamp01(signal?.average ?? 0)
}

function getSignalBands(signal: FrequencyData | null | undefined): Array<number> {
  return [
    clamp01(signal?.mid ?? 0),
    clamp01(signal?.low ?? 0),
    clamp01(signal?.high ?? 0),
    clamp01(signal?.average ?? 0),
  ]
}

export function getWaveformPalette(visualState: WaveformVisualState) {
  if (visualState === 'listening') {
    return {
      primary: 'rgb(14 165 233 / 0.88)',
      secondary: 'rgb(125 211 252 / 0.48)',
      containerClassName: journeyWaveformClassNames.listening,
      targetAmplitude: 0.16,
    }
  }

  if (visualState === 'speaking') {
    return {
      primary: 'rgb(8 145 178 / 0.9)',
      secondary: 'rgb(103 232 249 / 0.5)',
      containerClassName: journeyWaveformClassNames.speaking,
      targetAmplitude: 0.19,
    }
  }

  return {
    primary: 'rgb(71 85 105 / 0.56)',
    secondary: 'rgb(148 163 184 / 0.34)',
    containerClassName: journeyWaveformClassNames.idle,
    targetAmplitude: 0.09,
  }
}

export function resolveStableVisualState({
  voiceState,
  inputStrength,
  outputStrength,
  previousVisualState,
  lastVisualStateChangeAt,
  now,
}: StableVisualStateInput): WaveformVisualState {
  let candidateState: WaveformVisualState = voiceState

  if (outputStrength >= AUDIO_ACTIVITY_ENTER_THRESHOLD) {
    candidateState = 'speaking'
  } else if (previousVisualState === 'speaking' && outputStrength > AUDIO_ACTIVITY_EXIT_THRESHOLD) {
    candidateState = 'speaking'
  } else if (inputStrength >= AUDIO_ACTIVITY_ENTER_THRESHOLD) {
    candidateState = 'listening'
  } else if (previousVisualState === 'listening' && inputStrength > AUDIO_ACTIVITY_EXIT_THRESHOLD) {
    candidateState = 'listening'
  }

  if (candidateState === previousVisualState) {
    return previousVisualState
  }

  if (now - lastVisualStateChangeAt < VISUAL_STATE_MIN_HOLD_MS) {
    return previousVisualState
  }

  return candidateState
}

export function resolveWaveformMotion(
  voiceState: JourneyVoiceState,
  inputSignal: FrequencyData = ZERO_FREQUENCY_DATA,
  outputSignal: FrequencyData = ZERO_FREQUENCY_DATA,
  previousVisualState: WaveformVisualState = voiceState,
  lastVisualStateChangeAt = 0,
  now = Date.now(),
): WaveformMotion {
  const inputStrength = getSignalStrength(inputSignal)
  const outputStrength = getSignalStrength(outputSignal)

  const visualState = resolveStableVisualState({
    voiceState,
    inputStrength,
    outputStrength,
    previousVisualState,
    lastVisualStateChangeAt,
    now,
  })

  const palette = getWaveformPalette(visualState)
  const dominantSignal = visualState === 'speaking' ? outputSignal : inputSignal
  const dominantStrength = visualState === 'speaking' ? outputStrength : inputStrength
  const targetAmplitude = Math.min(
    WAVE_CONFIG.maxAmplitude,
    palette.targetAmplitude + dominantStrength * (visualState === 'speaking' ? 0.12 : 0.1),
  )
  const lineWidthTarget = Math.min(
    WAVE_CONFIG.activeLineWidthMultiplier,
    Math.max(visualState === 'idle' ? 1 : 1.22, 1.1 + dominantStrength * 1.2),
  )
  const fillOpacityBase = visualState === 'speaking' ? 0.28 + dominantStrength * 0.18 : visualState === 'listening' ? 0.24 + dominantStrength * 0.16 : 0.18
  const stateIntensity = visualState === 'speaking' ? 0.48 : visualState === 'listening' ? 0.36 : 0
  const perLineIntensity = getSignalBands(dominantSignal).map((bandValue) => Math.max(stateIntensity, bandValue))

  return {
    visualState,
    targetAmplitude,
    lineWidthTarget,
    fillOpacityBase,
    perLineIntensity,
  }
}

function calculateAmplitudeTaper(x: number, width: number): number {
  const normalizedX = x / width
  const distFromCenter = Math.abs(normalizedX - 0.5) * 2
  const taper = Math.cos((distFromCenter * Math.PI) / 2)
  return Math.pow(Math.max(0, taper), 4)
}

function drawWaveLine(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lineIndex: number,
  phase: number,
  baseAmplitude: number,
  lineWidthMultiplier: number,
  fillOpacityBase: number,
  color: string,
) {
  const centerY = height / 2
  const linePhase = phase + lineIndex * WAVE_CONFIG.phaseOffset
  const lineFreq = 2 + lineIndex + baseAmplitude * 5 * WAVE_CONFIG.frequencyOffset
  const baseWidth = WAVE_CONFIG.baseLineWidths[lineIndex] ?? 1
  const lineWidth = baseWidth * lineWidthMultiplier
  const lineOpacity = WAVE_CONFIG.lineOpacities[lineIndex] ?? 0.2
  const steps = Math.ceil(width / 2)
  const points: Array<{ x: number; y: number }> = []

  for (let i = 0; i <= steps; i += 1) {
    const x = (i / steps) * width
    const taper = calculateAmplitudeTaper(x, width)
    const primaryWave = Math.sin(lineFreq * (x / width) * Math.PI * 2 + linePhase)
    const secondaryWave = Math.sin(lineFreq * 1.5 * (x / width) * Math.PI * 2 + linePhase * 1.3) * 0.3
    const tertiaryWave = Math.sin(lineFreq * 0.5 * (x / width) * Math.PI * 2 - linePhase * 0.7) * 0.15
    const combinedWave = primaryWave + secondaryWave + tertiaryWave
    const y = centerY + combinedWave * baseAmplitude * height * taper
    points.push({ x, y })
  }

  const fillOpacity = Math.min(0.55, lineOpacity * fillOpacityBase)

  ctx.beginPath()
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i]
    if (i === 0) {
      ctx.moveTo(point.x, point.y)
    } else {
      ctx.lineTo(point.x, point.y)
    }
  }
  ctx.lineTo(width, centerY)
  ctx.lineTo(0, centerY)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.globalAlpha = fillOpacity
  ctx.fill()

  ctx.beginPath()
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i]
    if (i === 0) {
      ctx.moveTo(point.x, point.y)
    } else {
      ctx.lineTo(point.x, point.y)
    }
  }

  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.globalAlpha = lineOpacity
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.globalAlpha = 1
}

export function JourneyWaveform({ voiceState, inputSignalRef, outputSignalRef }: JourneyWaveformProps) {
  const initialMotion = resolveWaveformMotion(voiceState, inputSignalRef?.current, outputSignalRef?.current)
  const palette = getWaveformPalette(initialMotion.visualState)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const phasesRef = useRef<Array<number>>([0, 0, 0, 0])
  const speedsRef = useRef<Array<number>>([...WAVE_CONFIG.baseSpeeds])
  const targetSpeedsRef = useRef<Array<number>>([...WAVE_CONFIG.baseSpeeds])
  const amplitudeRef = useRef<number>(WAVE_CONFIG.baseAmplitude)
  const lineWidthMultiplierRef = useRef<number>(1)
  const visualStateRef = useRef<WaveformVisualState>(initialMotion.visualState)
  const lastVisualStateChangeAtRef = useRef<number>(Date.now())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const setCanvasSize = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(rect.width * ratio))
      canvas.height = Math.max(1, Math.floor(rect.height * ratio))
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    setCanvasSize()
    window.addEventListener('resize', setCanvasSize)

    let frameId = 0

    const animate = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      ctx.clearRect(0, 0, width, height)

      const now = Date.now()
      const motion = resolveWaveformMotion(
        voiceState,
        inputSignalRef?.current,
        outputSignalRef?.current,
        visualStateRef.current,
        lastVisualStateChangeAtRef.current,
        now,
      )
      if (motion.visualState !== visualStateRef.current) {
        visualStateRef.current = motion.visualState
        lastVisualStateChangeAtRef.current = now
      }
      const nextPalette = getWaveformPalette(motion.visualState)
      const amplitudeDiff = motion.targetAmplitude - amplitudeRef.current
      amplitudeRef.current += amplitudeDiff * 0.12

      lineWidthMultiplierRef.current += (motion.lineWidthTarget - lineWidthMultiplierRef.current) * 0.1

      const stateIntensity = motion.visualState === 'speaking' ? 1 : motion.visualState === 'listening' ? 0.72 : 0
      for (let i = 0; i < WAVE_CONFIG.lineCount; i += 1) {
        const baseSpeed = WAVE_CONFIG.baseSpeeds[i] ?? 0.015
        const multiplier = WAVE_CONFIG.speedMultipliers[i] ?? 1
        const bandIntensity = motion.perLineIntensity[i] ?? 0
        targetSpeedsRef.current[i] = baseSpeed + Math.max(stateIntensity * 0.012, bandIntensity * 0.1 * multiplier)
        const acceleration = WAVE_CONFIG.accelerationFactors[i] ?? 0.05
        speedsRef.current[i] += (targetSpeedsRef.current[i] - speedsRef.current[i]) * acceleration
        phasesRef.current[i] += speedsRef.current[i]
      }

      for (let i = WAVE_CONFIG.lineCount - 1; i >= 0; i -= 1) {
        drawWaveLine(
          ctx,
          width,
          height,
          i,
          phasesRef.current[i],
          amplitudeRef.current,
          lineWidthMultiplierRef.current,
          motion.fillOpacityBase,
          nextPalette.primary,
        )
      }

      ctx.globalCompositeOperation = 'destination-in'
      const maskGradient = ctx.createLinearGradient(0, 0, width, 0)
      maskGradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
      maskGradient.addColorStop(0.18, 'rgba(0, 0, 0, 1)')
      maskGradient.addColorStop(0.82, 'rgba(0, 0, 0, 1)')
      maskGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = maskGradient
      ctx.fillRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'source-over'

      frameId = window.requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', setCanvasSize)
      window.cancelAnimationFrame(frameId)
    }
  }, [inputSignalRef, outputSignalRef, voiceState])

  return (
    <div
      aria-hidden="true"
      data-journey-waveform="true"
      data-voice-state={voiceState}
      className={[journeyWaveformClassNames.container, palette.containerClassName].join(' ')}
    >
      <canvas ref={canvasRef} className={journeyWaveformClassNames.canvas} />
    </div>
  )
}