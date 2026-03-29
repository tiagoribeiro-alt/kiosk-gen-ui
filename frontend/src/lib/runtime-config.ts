type ResolveWebSocketUrlInput = {
  wsUrl?: string | null
  backendUrl?: string | null
  fallbackOrigin?: string | null
}

function withWsPath(url: URL): string {
  const normalizedPath = url.pathname.endsWith('/ws') ? url.pathname : `${url.pathname.replace(/\/$/, '')}/ws`
  url.pathname = normalizedPath
  url.search = ''
  url.hash = ''
  return url.toString()
}

function normalizeWebSocketCandidate(rawValue: string): string {
  const trimmed = rawValue.trim()

  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
    return withWsPath(new URL(trimmed))
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const url = new URL(trimmed)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return withWsPath(url)
  }

  return trimmed
}

function isLocalOrigin(origin: string): boolean {
  const url = new URL(origin)
  return ['127.0.0.1', 'localhost'].includes(url.hostname)
}

export function resolveWebSocketUrl({ wsUrl, backendUrl, fallbackOrigin }: ResolveWebSocketUrlInput): string {
  if (wsUrl?.trim()) {
    return normalizeWebSocketCandidate(wsUrl)
  }

  if (backendUrl?.trim()) {
    return normalizeWebSocketCandidate(backendUrl)
  }

  if (fallbackOrigin?.trim() && isLocalOrigin(fallbackOrigin)) {
    const fallbackUrl = new URL(fallbackOrigin)
    fallbackUrl.protocol = fallbackUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    return withWsPath(fallbackUrl)
  }

  return 'ws://localhost:8000/ws'
}