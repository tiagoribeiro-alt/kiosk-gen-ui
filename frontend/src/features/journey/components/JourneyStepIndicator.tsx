import type { JourneyStep } from '../types'

type JourneyStepIndicatorProps = {
  step: JourneyStep
}

const stepOrder: Array<JourneyStep> = ['discover', 'plan', 'carry']

function getStepLabel(step: JourneyStep): string {
  switch (step) {
    case 'discover':
      return 'Descobrir'
    case 'plan':
      return 'Planear'
    case 'carry':
      return 'Levar'
  }
}

export function JourneyStepIndicator({ step }: JourneyStepIndicatorProps) {
  return (
    <div className="grid grid-cols-3 gap-3" aria-label="Etapas da jornada">
      {stepOrder.map((item, index) => {
        const isActive = step === item

        return (
          <div
            key={item}
            aria-current={isActive ? 'step' : undefined}
            data-journey-step={item}
            className={[
              'rounded-[1.4rem] border px-4 py-3 text-sm font-semibold transition-colors shadow-[0_14px_26px_-22px_rgba(15,23,42,0.24)]',
              isActive
                ? 'border-[#11286c] bg-[#11286c] text-white'
                : 'border-slate-200 bg-white text-slate-500',
            ].join(' ')}
          >
            <span className="mr-2 text-xs uppercase tracking-[0.18em] opacity-75">0{index + 1}</span>
            {getStepLabel(item)}
          </div>
        )
      })}
    </div>
  )
}
