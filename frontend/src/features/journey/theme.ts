import type { JourneyItem } from './types'

type JourneyCardTone = {
  surfaceClassName: string
  accentClassName: string
}

export type JourneyCardVariant = 'base' | 'compact' | 'tall' | 'wide' | 'hero'

export const journeyShellClassNames = {
  container:
    'grid h-full w-full min-h-0 grid-rows-[10fr_10fr_60fr_20fr] overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_56%,#f8fafc_100%)]',
  header: 'flex min-h-0 items-start justify-between px-12 pt-8 pb-2',
  headerIdle: 'pointer-events-none opacity-0',
  headerCopy: 'flex flex-col',
  brandImage: 'h-auto w-[8.5rem] object-contain',
  agentLabel: 'text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400',
  statusRow: 'inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/90 px-4 py-2 text-[0.95rem] font-medium text-emerald-700 shadow-[0_12px_26px_-22px_rgba(22,163,74,0.45)]',
  statusDotBase: 'inline-flex h-2.5 w-2.5 rounded-full transition-colors',
  statusConnected: 'bg-emerald-500',
  statusDisconnected: 'bg-slate-300',
  stageHeader: 'grid min-h-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-5 px-12 py-1',
  stageCopy: 'min-w-0',
  stageEyebrow: 'text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-slate-300',
  stageTitle: 'mt-2 text-[1.85rem] font-semibold leading-none tracking-[-0.03em] text-[#11286c]',
  timelineRow: 'relative min-h-0',
  footer: 'flex min-h-0 flex-col items-center justify-center bg-transparent px-12 pb-9 pt-3',
  transcriptLabel: 'text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-300',
  errorBanner: 'mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700',
  transcriptText: 'mt-2 max-w-[40rem] text-center text-[0.95rem] leading-7 text-slate-500',
  countdownBar: 'relative mt-5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100',
  countdownFill: 'absolute inset-y-0 left-0 rounded-full bg-sky-500 transition-[width] duration-150 ease-linear',
  countdownLabel: 'mt-3 text-center text-[0.82rem] font-medium tabular-nums text-slate-400',
} as const

export const journeyTimelineClassNames = {
  frame: 'relative flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden px-12 py-2',
  track: 'relative flex h-full min-h-0 items-center gap-6 overflow-visible px-4 py-5 w-full',
  emptyState:
    'flex h-full w-full max-w-[68rem] flex-col items-center justify-center bg-white px-8 pb-10 pt-2 text-center',
  emptyEyebrow: 'text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-slate-400',
  emptyTitle: 'mt-4 max-w-[18ch] text-balance font-sans text-[4.2rem] font-semibold leading-[0.92] tracking-[-0.06em] text-[#11286c]',
  emptyDescription: 'mt-6 max-w-[32rem] text-[1.08rem] leading-[1.45] text-slate-700',
  emptyHighlights: 'mt-8 flex flex-wrap items-center justify-center gap-3',
  emptyHighlightChip: 'inline-flex rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[0.82rem] font-medium text-slate-700 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.18)]',
  screensaver: 'relative flex h-full w-full items-center justify-center overflow-hidden bg-white',
  screensaverBackdrop: 'absolute inset-0 bg-white',
  screensaverTexture: 'absolute inset-0 opacity-[0.22] [background-image:radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.08)_1px,transparent_0)] [background-size:18px_18px]',
  screensaverBlocks: 'absolute inset-0',
  screensaverBlock: 'absolute rounded-[0.4rem] bg-white/78 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.12)]',
  screensaverHero: 'relative z-10 flex h-full w-full max-w-[68rem] flex-col items-center justify-center px-8 pb-10 pt-2 text-center',
  screensaverLogoWrap: 'absolute inset-x-0 top-0 z-20 flex justify-start px-12 pt-8',
  screensaverLogoImage: 'h-auto w-[8.5rem] object-contain',
  screensaverHeadline: 'max-w-[18ch] text-balance font-sans text-[4.2rem] font-semibold leading-[0.92] tracking-[-0.06em] text-[#11286c] sm:text-[4.8rem] lg:text-[5.4rem]',
  screensaverBody: 'mt-7 max-w-[32rem] text-[1.1rem] leading-[1.4] text-slate-700 sm:text-[1.3rem]',
  screensaverCta: 'mt-8 inline-flex rounded-full bg-[#11286c] px-9 py-3.5 font-sans text-[1.05rem] font-semibold uppercase tracking-[0.04em] text-white shadow-[0_18px_34px_-24px_rgba(17,40,108,0.45)]',
  screensaverPrompt: 'mt-10 max-w-[26rem] text-[1.05rem] leading-[1.25] text-slate-800 sm:text-[1.25rem]',
} as const

export const journeyTimelineOffsets = ['mt-8', 'mt-0', 'mt-4', 'mt-10'] as const

export const journeyCardClassNames = {
  base:
    'relative w-full rounded-[1.15rem] border border-slate-200/75 bg-white/90 px-4 py-4 shadow-[0_16px_34px_-26px_rgba(15,23,42,0.2)] backdrop-blur-sm transition-[transform,box-shadow,border-color,opacity] duration-200',
  baseSize: 'min-w-[13.4rem] max-w-[13.9rem] min-h-[13.6rem]',
  compactSize: 'min-w-[11.9rem] max-w-[12.3rem] min-h-[12.35rem]',
  tallSize: 'min-w-[13.25rem] max-w-[13.75rem] min-h-[14.3rem]',
  wideSize: 'min-w-[16.5rem] max-w-[17rem] min-h-[14.2rem]',
  heroSize: 'min-w-[17rem] max-w-[18.5rem] min-h-[20rem]',
  eventBase: 'justify-between',
  summaryBase: 'justify-between',
  qrBase: 'justify-between',
  weatherBase: 'justify-between',
  focused: 'scale-[1.015] border-slate-300/90 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.22)]',
  idle: 'opacity-95',
  title: 'overflow-hidden text-[1rem] font-medium leading-tight text-slate-900 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]',
  meta: 'mt-1 overflow-hidden text-[0.88rem] leading-5 text-slate-500 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]',
  state: 'hidden',
  eventEyebrow: 'mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-400',
  eventTokens: 'mt-3 flex flex-wrap gap-2',
  eventToken:
    'inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[0.75rem] font-medium leading-none text-amber-900',
  eventSummary: 'mt-4 overflow-hidden text-[0.94rem] leading-6 text-slate-600 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4]',
  summaryEyebrow: 'mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-400',
  summaryBody: 'mt-4 overflow-hidden text-[0.96rem] leading-6 text-slate-600 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4]',
  summaryLink: 'mt-5 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[0.78rem] font-medium text-slate-700',
  qrEyebrow: 'mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-400',
  qrWrap: 'mt-5 flex flex-col items-center rounded-[0.95rem] border border-slate-200/80 bg-slate-50/90 px-4 py-4',
  qrImage: 'h-48 w-48 rounded-[1.35rem] bg-white object-contain p-3 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.26)]',
  qrFallback: 'grid h-44 w-44 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white text-sm font-medium text-slate-400',
  qrCaption: 'mt-4 overflow-hidden text-center text-[0.95rem] leading-6 text-slate-600 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]',
  qrCodeText: 'mt-3 text-center text-[0.78rem] leading-5 text-slate-400',
  weatherCurrent: 'mt-1 flex flex-col items-center gap-2 text-center text-slate-900',
  weatherCurrentMain: 'flex items-center gap-3 text-left',
  weatherIcon: 'flex h-10 w-10 flex-none items-center justify-center text-slate-700',
  weatherTemp: 'text-[2.15rem] font-normal leading-none tracking-[-0.04em]',
  weatherSummaryWrap: 'flex flex-col items-start gap-0.5',
  weatherSummary: 'text-[0.96rem] font-medium leading-tight text-slate-900',
  weatherLocation: 'text-[0.82rem] leading-5 text-slate-500',
  weatherRange: 'text-[0.85rem] leading-5 text-slate-500',
  weatherFeelsLike: 'mt-1 text-center text-[0.78rem] text-slate-500',
  weatherGrid: 'mt-4 grid grid-cols-3 gap-2 border-t border-slate-200/80 pt-4',
  weatherDay: 'px-0 py-0 text-center',
  weatherDayLabel: 'text-[0.78rem] font-medium text-slate-700',
  weatherDayIcon: 'mt-2 flex items-center justify-center text-slate-700',
  weatherDayTemps: 'mt-1 text-[0.78rem] leading-4 text-slate-900',
  weatherDayMeta: 'hidden',
  mediaFrame: 'mb-3 overflow-hidden rounded-[0.95rem] border border-white/80 bg-slate-50/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]',
  mediaImage: 'aspect-square h-auto w-full object-cover',
  mediaScenic: 'relative aspect-square bg-[linear-gradient(180deg,#e0f2fe_0%,#f0fdf4_52%,#dcfce7_100%)]',
  mediaScenicGlow: 'absolute inset-x-0 bottom-0 h-[48%] bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.18),rgba(255,255,255,0)_72%)]',
  mediaScenicHill: 'absolute bottom-0 left-[-6%] h-[42%] w-[112%] rounded-t-[100%] bg-[linear-gradient(180deg,rgba(34,197,94,0.12),rgba(21,128,61,0.28))]',
  mediaMap: 'relative aspect-square bg-[linear-gradient(180deg,#f8fafc_0%,#fefce8_100%)]',
  mediaMapPreview: 'relative aspect-square overflow-hidden bg-slate-100',
  mediaMapBackdrop: 'absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(15,23,42,0.16)_100%)]',
  mediaMapTile: 'absolute inset-0 h-full w-full object-cover',
  mediaMapContourPrimary: 'absolute left-[-4%] top-[20%] h-[34%] w-[112%] rounded-[100%] border border-slate-300/50',
  mediaMapContourSecondary: 'absolute left-[-10%] top-[44%] h-[38%] w-[124%] rounded-[100%] border border-slate-300/35',
  mediaMapGrid: 'absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:18px_18px]',
  mediaMapTopRow: 'absolute inset-x-3 top-3 flex items-start justify-between gap-2',
  mediaMapBottomRow: 'absolute inset-x-3 bottom-3',
  mediaMapEyebrow: 'text-[0.64rem] font-semibold uppercase tracking-[0.24em] text-slate-500',
  mediaMapScale: 'inline-flex rounded-full border border-white/80 bg-white/88 px-2.5 py-1 text-[0.64rem] font-medium text-slate-500 shadow-[0_8px_18px_-16px_rgba(15,23,42,0.24)]',
  mediaMapMarkerCluster: 'absolute inset-0 flex items-center justify-center',
  mediaMapMarkerPulse: 'absolute h-10 w-10 rounded-full bg-sky-200/55 blur-[1px]',
  mediaMapMarker: 'relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-sky-700 shadow-[0_8px_18px_-10px_rgba(15,23,42,0.55)]',
  mediaMapRoute: 'absolute inset-0 h-full w-full',
  mediaMapRoutePath: 'fill-none stroke-[#0f4c81] stroke-[3] [stroke-dasharray:6_5] [stroke-linecap:round]',
  mediaMapRouteStart: 'absolute left-[26%] top-[64%] inline-flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-500 shadow-[0_8px_18px_-10px_rgba(15,23,42,0.45)]',
  mediaMapRouteEnd: 'absolute left-[74%] top-[34%] inline-flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-rose-500 shadow-[0_8px_18px_-10px_rgba(15,23,42,0.45)]',
  mediaMapLabel: 'text-[0.86rem] font-medium leading-tight text-slate-800',
  mediaMapHint: 'mt-1 overflow-hidden text-[0.72rem] leading-4 text-slate-500 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]',
  mediaMapFallback: 'grid aspect-square place-items-center bg-[linear-gradient(180deg,#f8fafc_0%,#f3f6f9_100%)] px-4 text-center',
  mediaMapFallbackIcon: 'grid h-14 w-14 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-[0_10px_20px_-16px_rgba(15,23,42,0.24)]',
  mediaMapFallbackTitle: 'mt-3 text-[0.9rem] font-medium leading-tight text-slate-800',
  mediaMapFallbackBody: 'mt-2 max-w-[10rem] text-[0.76rem] leading-5 text-slate-500',
  mediaCaption: 'mt-1 overflow-hidden text-[0.82rem] leading-5 text-slate-500 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]',
  mediaAttribution: 'mt-1 overflow-hidden text-[0.72rem] leading-4 text-slate-400 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]',
} as const

export const journeyConnectorClassNames = {
  canvas: 'absolute inset-x-0 top-1/2 hidden h-36 -translate-y-1/2 lg:block',
  footprintFill: 'rgb(51 65 85 / 0.9)',
  footprintDivider: 'rgb(255 255 255 / 0.94)',
} as const

export const journeyWaveformClassNames = {
  container: 'pointer-events-none mt-2 flex justify-center transition-[opacity,transform] duration-700',
  idle: 'opacity-70',
  listening: 'opacity-100 animate-[pulse_2200ms_ease-in-out_infinite]',
  speaking: 'translate-y-[-1px] opacity-100 animate-[pulse_1800ms_ease-in-out_infinite]',
  canvas: 'h-24 w-[30rem]',
} as const

const mutedCardTones: Record<JourneyItem['kind'], JourneyCardTone> = {
  poi: {
    surfaceClassName: 'border-slate-200 bg-white',
    accentClassName: 'text-slate-900',
  },
  event: {
    surfaceClassName: 'border-slate-200 bg-white',
    accentClassName: 'text-slate-900',
  },
  image: {
    surfaceClassName: 'border-slate-200 bg-white',
    accentClassName: 'text-slate-900',
  },
  map: {
    surfaceClassName: 'border-slate-200 bg-white',
    accentClassName: 'text-slate-900',
  },
  weather: {
    surfaceClassName: 'border-slate-200 bg-white',
    accentClassName: 'text-slate-900',
  },
  summary: {
    surfaceClassName: 'border-slate-200 bg-white',
    accentClassName: 'text-slate-800',
  },
  qr: {
    surfaceClassName: 'border-slate-200 bg-white',
    accentClassName: 'text-slate-900',
  },
}

export function getJourneyCardTone(item: JourneyItem): JourneyCardTone {
  return mutedCardTones[item.kind]
}

export function getJourneyCardVariant(item: JourneyItem): JourneyCardVariant {
  switch (item.kind) {
    case 'weather':
      return 'compact'
    case 'event':
      return 'tall'
    case 'summary':
      return 'wide'
    case 'qr':
      return 'hero'
    case 'poi':
    case 'image':
    case 'map':
      return 'base'
  }
}