import { journeyCardClassNames } from '../theme'

type JourneyMapPreviewProps = {
  title: string
  location?: string
  latitude?: number
  longitude?: number
}

function getMapLabel(location?: string): string | null {
  if (!location) {
    return null
  }

  const trimmed = location.trim()
  if (!trimmed) {
    return null
  }

  return trimmed
}

function getMapContext(title: string, location?: string): string {
  const label = getMapLabel(location)

  if (!label) {
    return 'Sem localizacao precisa para gerar vista cartografica.'
  }

  return `Vista aproximada de ${label} para contextualizar ${title.toLowerCase()}.`
}

function hasCoordinates(latitude?: number, longitude?: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
}

function getTileUrl(latitude?: number, longitude?: number): string {
  const resolvedLatitude = Number.isFinite(latitude) ? latitude as number : 39.6945
  const resolvedLongitude = Number.isFinite(longitude) ? longitude as number : -7.9212
  const zoom = Number.isFinite(latitude) && Number.isFinite(longitude) ? 13 : 10
  const latRad = (resolvedLatitude * Math.PI) / 180
  const tilesPerAxis = 2 ** zoom
  const x = Math.floor(((resolvedLongitude + 180) / 360) * tilesPerAxis)
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * tilesPerAxis,
  )

  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`
}

export function JourneyMapPreview({ title, location, latitude, longitude }: JourneyMapPreviewProps) {
  const label = getMapLabel(location)
  const resolvedByCoordinates = hasCoordinates(latitude, longitude)
  const isRoutePreview = Boolean(label && label.includes('\u2192'))

  function renderTilePreview(mapState: 'coordinates' | 'approximate') {
    return (
      <div className={journeyCardClassNames.mediaFrame} data-map-state={mapState}>
        <div className={journeyCardClassNames.mediaMapPreview}>
          <img
            src={getTileUrl(latitude, longitude)}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className={journeyCardClassNames.mediaMapTile}
          />
          <div className={journeyCardClassNames.mediaMapBackdrop} />

          {isRoutePreview ? (
            <>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={journeyCardClassNames.mediaMapRoute} aria-hidden="true">
                <path d="M 24 68 C 41 51 56 48 76 30" className={journeyCardClassNames.mediaMapRoutePath} />
              </svg>
              <span className={journeyCardClassNames.mediaMapRouteStart} aria-hidden="true" />
              <span className={journeyCardClassNames.mediaMapRouteEnd} aria-hidden="true" />
            </>
          ) : (
            <div className={journeyCardClassNames.mediaMapMarkerCluster} aria-hidden="true">
              <span className={journeyCardClassNames.mediaMapMarkerPulse} />
              <span className={journeyCardClassNames.mediaMapMarker} />
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!resolvedByCoordinates && !label) {
    return (
      <div className={journeyCardClassNames.mediaFrame} data-map-state="fallback">
        <div className={journeyCardClassNames.mediaMapFallback}>
          <p className={journeyCardClassNames.mediaMapEyebrow}>Mapa</p>
          <div className={journeyCardClassNames.mediaMapFallbackIcon} aria-hidden="true">
            <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none">
              <path d="M 7 10 L 16 7 L 25 10 L 25 22 L 16 25 L 7 22 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M 16 7 V 25" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <p className={journeyCardClassNames.mediaMapFallbackTitle}>Localizacao por confirmar</p>
          <p className={journeyCardClassNames.mediaMapFallbackBody}>{getMapContext(title, location)}</p>
        </div>
      </div>
    )
  }

  if (resolvedByCoordinates && latitude !== undefined && longitude !== undefined) {
    return renderTilePreview('coordinates')
  }

  return renderTilePreview('approximate')
}