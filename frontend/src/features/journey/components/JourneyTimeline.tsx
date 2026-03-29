import type { JourneyScene } from '../types'
import { journeyTimelineClassNames } from '../theme'
import { JourneyCard } from './JourneyCard'
import { JourneyConnector } from './JourneyConnector'

type JourneyTimelineProps = {
  scene: JourneyScene
}

function renderIdleScreensaver() {
  return (
    <div className={journeyTimelineClassNames.screensaver} data-journey-screensaver="true">
      <div className={journeyTimelineClassNames.screensaverBackdrop} />
      <div className={journeyTimelineClassNames.screensaverHero}>
        <h1 className={journeyTimelineClassNames.screensaverHeadline}>Mais Portugal para Descobrir</h1>
        <p className={journeyTimelineClassNames.screensaverBody}>Explore novos lugares e leve consigo um itinerario personalizado.</p>
        <div className={journeyTimelineClassNames.screensaverCta}>Falar comigo</div>
        <p className={journeyTimelineClassNames.screensaverPrompt}>Aproxime-se do ecra para iniciar uma nova conversa</p>
      </div>
    </div>
  )
}

function getEmptyStateCopy(scene: JourneyScene) {
  if (scene.connectionState !== 'connected') {
    return {
      eyebrow: 'Ligacao',
      title: 'A restabelecer a ligacao.',
      description: 'O kiosk volta ja.',
      highlights: ['Journey pronta', 'Ligacao segura'],
    }
  }

  if (scene.kioskState === 'listening') {
    return {
      eyebrow: 'Boas-vindas',
      title: 'Estou a preparar a conversa.',
      description: 'Fale para comecar.',
      highlights: ['A ouvir', 'Resposta em tempo real'],
    }
  }

  return {
    eyebrow: 'Way Finder',
    title: 'Descubra lugares e eventos por voz.',
    description: 'Fale para comecar.',
    highlights: ['Natureza', 'Eventos', 'Resumo final'],
  }
}

export function JourneyTimeline({ scene }: JourneyTimelineProps) {
  const { items, focusItemId } = scene
  const visibleItems = items.slice(-4)
  const emptyState = getEmptyStateCopy(scene)
  const shouldShowScreensaver = visibleItems.length === 0 && scene.kioskState === 'idle'

  return (
    <div className={journeyTimelineClassNames.frame}>
      <JourneyConnector count={visibleItems.length} />

      {visibleItems.length > 0 ? (
        <div className={journeyTimelineClassNames.track}>
          {visibleItems.map((item, index) => (
            <div
              key={item.id}
              className={[
                index === 0 ? 'mt-6' : '',
                index === 1 ? 'mt-0' : '',
                index === 2 ? 'mt-3' : '',
                index === 3 ? 'mt-8' : '',
                'relative flex flex-1 justify-center',
              ].join(' ')}
            >
              <JourneyCard
                item={item}
                isFocused={item.id === focusItemId}
              />
            </div>
          ))}
        </div>
      ) : shouldShowScreensaver ? (
        renderIdleScreensaver()
      ) : (
        <div className={journeyTimelineClassNames.emptyState} data-journey-empty-state="true">
          <p className={journeyTimelineClassNames.emptyEyebrow}>{emptyState.eyebrow}</p>
          <h3 className={journeyTimelineClassNames.emptyTitle}>{emptyState.title}</h3>
          <p className={journeyTimelineClassNames.emptyDescription}>{emptyState.description}</p>
          <div className={journeyTimelineClassNames.emptyHighlights}>
            {emptyState.highlights.map((highlight) => (
              <span key={highlight} className={journeyTimelineClassNames.emptyHighlightChip}>{highlight}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
