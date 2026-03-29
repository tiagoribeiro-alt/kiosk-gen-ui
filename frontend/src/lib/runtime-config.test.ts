import { describe, expect, it } from 'vitest'

import { resolveWebSocketUrl } from './runtime-config'

describe('resolveWebSocketUrl', () => {
  it('prefers an explicit websocket url', () => {
    expect(resolveWebSocketUrl({ wsUrl: 'wss://api.example.com' })).toBe('wss://api.example.com/ws')
  })

  it('derives websocket url from an https backend url', () => {
    expect(resolveWebSocketUrl({ backendUrl: 'https://kiosk-backend.example.run.app' })).toBe(
      'wss://kiosk-backend.example.run.app/ws',
    )
  })

  it('derives websocket url from a fallback origin', () => {
    expect(resolveWebSocketUrl({ fallbackOrigin: 'http://localhost:5173' })).toBe('ws://localhost:5173/ws')
  })

  it('uses localhost as a final fallback', () => {
    expect(resolveWebSocketUrl({})).toBe('ws://localhost:8000/ws')
  })
})