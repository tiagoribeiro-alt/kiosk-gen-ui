import type { JourneyItem } from '../types'
import { getJourneyCardTone, getJourneyCardVariant, journeyCardClassNames } from '../theme'
import { JourneyMapPreview } from './JourneyMapPreview'

type JourneyCardProps = {
  item: JourneyItem
  isFocused: boolean
}

function getItemMeta(item: JourneyItem): string | null {
  switch (item.kind) {
    case 'poi':
      return item.location ?? item.category ?? null
    case 'event':
      return null
    case 'image':
      return null
    case 'map':
      return item.location ?? null
    case 'summary':
      return null
    case 'weather':
      return item.location ?? item.weatherLabel
    case 'qr':
      return null
  }
}

function getEventTokens(subTitle?: string): Array<string> {
  if (!subTitle) {
    return []
  }

  return subTitle
    .split('•')
    .map((token) => token.trim())
    .filter(Boolean)
}

function renderEventContent(item: Extract<JourneyItem, { kind: 'event' }>) {
  const tokens = getEventTokens(item.subTitle)

  return (
    <>
      <p className={journeyCardClassNames.eventEyebrow}>Agenda</p>
      <h3 className={journeyCardClassNames.title}>{item.title}</h3>
      {tokens.length ? (
        <div className={journeyCardClassNames.eventTokens}>
          {tokens.map((token) => (
            <span key={token} className={journeyCardClassNames.eventToken}>
              {token}
            </span>
          ))}
        </div>
      ) : null}
      {item.meta ? <p className={journeyCardClassNames.eventSummary}>{item.meta}</p> : null}
    </>
  )
}

function getWeatherIconKind(weatherCode: number, weatherLabel: string): 'sun' | 'partly-cloudy' | 'cloud' | 'rain' | 'snow' | 'storm' | 'fog' | 'variable' {
  if (weatherCode === 0) {
    return 'sun'
  }

  if (weatherCode >= 1 && weatherCode <= 2) {
    return 'partly-cloudy'
  }

  if (weatherCode === 3) {
    return 'cloud'
  }

  if (weatherCode === 45 || weatherCode === 48) {
    return 'fog'
  }

  if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) {
    return 'rain'
  }

  if ((weatherCode >= 71 && weatherCode <= 77) || weatherCode === 85 || weatherCode === 86) {
    return 'snow'
  }

  if (weatherCode >= 95) {
    return 'storm'
  }

  const loweredLabel = weatherLabel.toLowerCase()

  if (loweredLabel.includes('limpo') || loweredLabel.includes('sol')) {
    return 'sun'
  }

  if (loweredLabel.includes('nublado')) {
    return 'cloud'
  }

  if (loweredLabel.includes('chuva') || loweredLabel.includes('chuvisco')) {
    return 'rain'
  }

  if (loweredLabel.includes('neve')) {
    return 'snow'
  }

  if (loweredLabel.includes('trovoada')) {
    return 'storm'
  }

  if (loweredLabel.includes('nevoeiro')) {
    return 'fog'
  }

  return 'variable'
}

function renderWeatherIcon(iconKind: ReturnType<typeof getWeatherIconKind>) {
  switch (iconKind) {
    case 'sun':
      return (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5V5" />
          <path d="M12 19V21.5" />
          <path d="M2.5 12H5" />
          <path d="M19 12h2.5" />
          <path d="M5.2 5.2l1.8 1.8" />
          <path d="M17 17l1.8 1.8" />
          <path d="M5.2 18.8L7 17" />
          <path d="M17 7l1.8-1.8" />
        </>
      )
    case 'partly-cloudy':
      return (
        <>
          <circle cx="9" cy="9" r="3.25" />
          <path d="M9 3.2v1.9" />
          <path d="M9 12.9v1.9" />
          <path d="M3.2 9h1.9" />
          <path d="M12.9 9h1.9" />
          <path d="M6 16.5h9.5a3.5 3.5 0 0 0 0-7 4.9 4.9 0 0 0-9-1.9A3.6 3.6 0 0 0 6 16.5Z" />
        </>
      )
    case 'cloud':
      return <path d="M6 17h10.5a4 4 0 0 0 .2-8A5.8 5.8 0 0 0 6.3 7.2 4.2 4.2 0 0 0 6 17Z" />
    case 'rain':
      return (
        <>
          <path d="M6 15.5h10.5a4 4 0 0 0 .2-8A5.8 5.8 0 0 0 6.3 5.7 4.2 4.2 0 0 0 6 15.5Z" />
          <path d="M8 17.5v3" />
          <path d="M12 18.5v3" />
          <path d="M16 17.5v3" />
        </>
      )
    case 'snow':
      return (
        <>
          <path d="M6 15.5h10.5a4 4 0 0 0 .2-8A5.8 5.8 0 0 0 6.3 5.7 4.2 4.2 0 0 0 6 15.5Z" />
          <path d="M8 18h.01" />
          <path d="M12 20h.01" />
          <path d="M16 18h.01" />
        </>
      )
    case 'storm':
      return (
        <>
          <path d="M6 15.5h10.5a4 4 0 0 0 .2-8A5.8 5.8 0 0 0 6.3 5.7 4.2 4.2 0 0 0 6 15.5Z" />
          <path d="M12.5 15.5L9.5 20h2.7l-1 3.5 4.3-6h-3Z" />
        </>
      )
    case 'fog':
      return (
        <>
          <path d="M6 13.5h10.5a4 4 0 0 0 .2-8A5.8 5.8 0 0 0 6.3 3.7 4.2 4.2 0 0 0 6 13.5Z" />
          <path d="M5 17h14" />
          <path d="M7 20h10" />
        </>
      )
    case 'variable':
      return (
        <>
          <path d="M6 15.5h10.5a4 4 0 0 0 .2-8A5.8 5.8 0 0 0 6.3 5.7 4.2 4.2 0 0 0 6 15.5Z" />
          <path d="M9 18.2v2.4" />
          <path d="M12 17v4" />
          <path d="M15 18.2v2.4" />
        </>
      )
  }
}

function WeatherIcon({ weatherCode, weatherLabel, size }: { weatherCode: number; weatherLabel: string; size: number }) {
  const iconKind = getWeatherIconKind(weatherCode, weatherLabel)

  return (
    <svg
      aria-hidden="true"
      data-weather-icon={iconKind}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {renderWeatherIcon(iconKind)}
    </svg>
  )
}

function getShortAttribution(imageAttribution?: string): string | null {
  if (!imageAttribution) {
    return null
  }

  const shortAttribution = imageAttribution
    .replace(/^.*\bon\s+/i, '')
    .replace(/^.*via\s+/i, '')
    .trim()

  return shortAttribution || imageAttribution
}

function renderWeatherContent(item: Extract<JourneyItem, { kind: 'weather' }>) {
  const forecastDays = item.dailyForecast.slice(0, 3)

  return (
    <>
      <div className={journeyCardClassNames.weatherCurrent}>
        <div className={journeyCardClassNames.weatherCurrentMain}>
          <span className={journeyCardClassNames.weatherIcon}>
            <WeatherIcon weatherCode={item.weatherCode} weatherLabel={item.weatherLabel} size={36} />
          </span>
          <div className={journeyCardClassNames.weatherSummaryWrap}>
            <span className={journeyCardClassNames.weatherSummary}>{item.weatherLabel}</span>
            {item.location ? <span className={journeyCardClassNames.weatherLocation}>{item.location}</span> : null}
          </div>
        </div>
        <span className={journeyCardClassNames.weatherTemp}>{Math.round(item.currentTemperatureC)}°</span>
      </div>
      <div className={journeyCardClassNames.weatherGrid}>
        {forecastDays.map((forecastDay) => (
          <div key={forecastDay.date} className={journeyCardClassNames.weatherDay}>
            <p className={journeyCardClassNames.weatherDayLabel}>{forecastDay.label}</p>
            <div className={journeyCardClassNames.weatherDayIcon}>
              <WeatherIcon weatherCode={forecastDay.weatherCode} weatherLabel={forecastDay.weatherLabel} size={22} />
            </div>
            <p className={journeyCardClassNames.weatherDayTemps}>
              {Math.round(forecastDay.temperatureMaxC)}° / {Math.round(forecastDay.temperatureMinC)}°
            </p>
          </div>
        ))}
      </div>
    </>
  )
}

function getSummaryUrlLabel(summaryUrl?: string): string | null {
  if (!summaryUrl) {
    return null
  }

  try {
    const parsed = new URL(summaryUrl)
    return parsed.host + parsed.pathname
  } catch {
    return summaryUrl
  }
}

function renderScenicMedia() {
  return (
    <div className={journeyCardClassNames.mediaFrame}>
      <div className={journeyCardClassNames.mediaScenic}>
        <div className={journeyCardClassNames.mediaScenicGlow} />
        <div className={journeyCardClassNames.mediaScenicHill} />
      </div>
    </div>
  )
}

function renderImageMedia(item: Extract<JourneyItem, { kind: 'poi' | 'image' }>) {
  const src = item.thumbnailUrl ?? item.imageUrl
  if (!src) {
    return renderScenicMedia()
  }

  return (
    <div className={journeyCardClassNames.mediaFrame}>
      <img src={src} alt={item.title} className={journeyCardClassNames.mediaImage} />
    </div>
  )
}

function renderMapMedia(item: Extract<JourneyItem, { kind: 'map' }>) {
  return (
    <JourneyMapPreview
      title={item.title}
      location={item.location}
      latitude={item.latitude}
      longitude={item.longitude}
    />
  )
}

function renderSummaryContent(item: Extract<JourneyItem, { kind: 'summary' }>) {
  const summaryUrlLabel = getSummaryUrlLabel(item.summaryUrl)

  return (
    <>
      <p className={journeyCardClassNames.summaryEyebrow}>Resumo</p>
      <h3 className={journeyCardClassNames.title}>{item.title}</h3>
      {item.description ? <p className={journeyCardClassNames.summaryBody}>{item.description}</p> : null}
      {summaryUrlLabel ? <p className={journeyCardClassNames.summaryLink}>{summaryUrlLabel}</p> : null}
    </>
  )
}

function renderQrContent(item: Extract<JourneyItem, { kind: 'qr' }>) {
  return (
    <>
      <p className={journeyCardClassNames.qrEyebrow}>Levar</p>
      <h3 className={journeyCardClassNames.title}>{item.title}</h3>
      <div className={journeyCardClassNames.qrWrap}>
        {item.qrImageSrc ? (
          <img src={item.qrImageSrc} alt="QR code da visita" className={journeyCardClassNames.qrImage} />
        ) : (
          <div aria-hidden="true" className={journeyCardClassNames.qrFallback}>QR</div>
        )}
        {item.description ? <p className={journeyCardClassNames.qrCaption}>{item.description}</p> : null}
        {item.qrData ? <p className={journeyCardClassNames.qrCodeText}>{item.qrData}</p> : null}
      </div>
    </>
  )
}

export function JourneyCard({ item, isFocused }: JourneyCardProps) {
  const meta = getItemMeta(item)
  const tone = getJourneyCardTone(item)
  const variant = getJourneyCardVariant(item)

  const variantClassName = {
    base: journeyCardClassNames.baseSize,
    compact: journeyCardClassNames.compactSize,
    tall: journeyCardClassNames.tallSize,
    wide: journeyCardClassNames.wideSize,
    hero: journeyCardClassNames.heroSize,
  }[variant]

  return (
    <article
      data-focused={isFocused ? 'true' : 'false'}
      data-journey-kind={item.kind}
      data-journey-variant={variant}
      className={[
        journeyCardClassNames.base,
        variantClassName,
        item.kind === 'event' ? journeyCardClassNames.eventBase : '',
        item.kind === 'summary' ? journeyCardClassNames.summaryBase : '',
        item.kind === 'qr' ? journeyCardClassNames.qrBase : '',
        item.kind === 'weather' ? journeyCardClassNames.weatherBase : '',
        tone.surfaceClassName,
        tone.accentClassName,
        isFocused ? journeyCardClassNames.focused : journeyCardClassNames.idle,
      ].join(' ')}
    >
      {item.kind === 'event' ? renderEventContent(item) : null}
      {item.kind === 'summary' ? renderSummaryContent(item) : null}
      {item.kind === 'qr' ? renderQrContent(item) : null}
      {item.kind === 'poi' || item.kind === 'image' ? renderImageMedia(item) : null}
      {item.kind === 'map' ? renderMapMedia(item) : null}
      {item.kind !== 'event' && item.kind !== 'summary' && item.kind !== 'qr' ? <h3 className={journeyCardClassNames.title}>{item.title}</h3> : null}
      {item.kind === 'event' || item.kind === 'weather' || item.kind === 'summary' || item.kind === 'qr' ? null : meta ? <p className={journeyCardClassNames.meta}>{meta}</p> : null}
      {item.kind === 'image' && item.caption ? <p className={journeyCardClassNames.mediaCaption}>{item.caption}</p> : null}
      {(item.kind === 'poi' || item.kind === 'image') && item.imageAttribution ? (
        <p className={journeyCardClassNames.mediaAttribution}>{getShortAttribution(item.imageAttribution)}</p>
      ) : null}
      {item.kind === 'weather' ? renderWeatherContent(item) : null}
    </article>
  )
}
