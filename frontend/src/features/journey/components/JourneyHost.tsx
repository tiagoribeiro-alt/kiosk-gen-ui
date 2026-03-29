import type { MutableRefObject } from 'react'
import { useEffect, useState } from 'react'
import type { JourneyScene } from '../types'
import type { FrequencyData } from '../../../lib/audio'
import { journeyShellClassNames } from '../theme'
import { JourneyTimeline } from './JourneyTimeline'
import { JourneyStepIndicator } from './JourneyStepIndicator'
import { JourneyWaveform } from './JourneyWaveform'
import { FAREWELL_DURATION_MS } from '../../../machines/kiosk'
import brandImageSrc from '../../../assets/way_finder.png'

type JourneyHostProps = {
  scene: JourneyScene
  inputSignalRef?: MutableRefObject<FrequencyData>
  outputSignalRef?: MutableRefObject<FrequencyData>
}

function getVoiceLabel(scene: JourneyScene): string {
  if (scene.voiceState === 'listening') {
    return 'A ouvir'
  }

  if (scene.voiceState === 'speaking') {
    return 'A falar'
  }

  if (scene.connectionState === 'connected') {
    return 'Pronto'
  }

  return 'Desligado'
}

function useFarewellCountdown(deadline: number | null): { fraction: number; secondsLeft: number } | null {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (deadline === null) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(id)
  }, [deadline])

  if (deadline === null) return null
  const remaining = Math.max(0, deadline - now)
  return {
    fraction: remaining / FAREWELL_DURATION_MS,
    secondsLeft: Math.ceil(remaining / 1000),
  }
}

export function JourneyHost({ scene, inputSignalRef, outputSignalRef }: JourneyHostProps) {
  const countdown = useFarewellCountdown(scene.farewellDeadline)

  return (
    <section className={journeyShellClassNames.container}>
      <header className={journeyShellClassNames.header}>
        <div className={journeyShellClassNames.headerCopy}>
          <p className={journeyShellClassNames.agentLabel}>{scene.agentLabel}</p>
          <img src={brandImageSrc} alt={scene.shellBrand} className={journeyShellClassNames.brandImage} />
        </div>

        <div className={journeyShellClassNames.statusRow}>
          <span
            className={[
              journeyShellClassNames.statusDotBase,
              scene.connectionState === 'connected'
                ? journeyShellClassNames.statusConnected
                : journeyShellClassNames.statusDisconnected,
            ].join(' ')}
          />
          <span>{getVoiceLabel(scene)}</span>
        </div>
      </header>

      <div className={journeyShellClassNames.stageHeader}>
        <div className={journeyShellClassNames.stageCopy}>
          <p className={journeyShellClassNames.stageEyebrow}>Passo atual</p>
          <h2 className={journeyShellClassNames.stageTitle}>{scene.title}</h2>
        </div>

        <JourneyStepIndicator step={scene.step} />
      </div>

      <div className={journeyShellClassNames.timelineRow}>
        <JourneyTimeline scene={scene} />
      </div>

      <div className={journeyShellClassNames.footer}>
        {scene.errorMessage ? <p className={journeyShellClassNames.errorBanner}>{scene.errorMessage}</p> : null}

        {countdown ? (
          <>
            <div className="mt-5 w-full max-w-[18rem]">
              <div className={journeyShellClassNames.countdownBar}>
              <div
                className={journeyShellClassNames.countdownFill}
                style={{ width: `${(countdown.fraction * 100).toFixed(1)}%` }}
              />
              </div>
            </div>
            <p className={journeyShellClassNames.countdownLabel}>
              {countdown.secondsLeft > 0
                ? `Regressa ao inicio em ${countdown.secondsLeft}s`
                : 'A reiniciar\u2026'}
            </p>
          </>
        ) : (
          <JourneyWaveform voiceState={scene.voiceState} inputSignalRef={inputSignalRef} outputSignalRef={outputSignalRef} />
        )}
      </div>
    </section>
  )
}
