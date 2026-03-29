import { afterEach, describe, expect, it, vi } from 'vitest'
import { WSClient } from './ws-client'


class FakeWebSocket {
  static instances: Array<FakeWebSocket> = []
  static OPEN = 1

  readyState = FakeWebSocket.OPEN
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: ((error: Event) => void) | null = null
  onclose: (() => void) | null = null
  sentMessages: Array<string> = []
  url: string

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(payload: string) {
    this.sentMessages.push(payload)
  }

  close() {
    this.onclose?.()
  }
}


describe('WSClient', () => {
  afterEach(() => {
    vi.useRealTimers()
    FakeWebSocket.instances = []
    vi.unstubAllGlobals()
  })

  it('notifies connection listeners on open and close', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const client = new WSClient('ws://localhost:8000/ws')
    const changes: Array<boolean> = []
    client.onConnectionChange((connected) => changes.push(connected))

    const connectPromise = client.connect()
    vi.advanceTimersByTime(0)
    const socket = FakeWebSocket.instances[0]
    socket.onopen?.()
    await connectPromise

    socket.close()

    expect(changes).toEqual([true, false])
  })

  it('parses typed events and sends audio payloads', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const client = new WSClient('ws://localhost:8000/ws')
    const receivedTexts: Array<string> = []
    const receivedInputs: Array<string> = []
    const sessionStarts: Array<string> = []
    const completedTurns: Array<string> = []
    const errors: Array<string> = []
    client.on('transcript_input', (payload) => receivedInputs.push(payload.text))
    client.on('transcript_output', (payload) => receivedTexts.push(payload.text))
    client.on('session_start', (payload) => sessionStarts.push(payload.agent_id))
    client.on('turn_complete', (payload) => completedTurns.push(payload.type))
    client.on('error', (payload) => errors.push(payload.message))

    const connectPromise = client.connect()
    vi.advanceTimersByTime(0)
    const socket = FakeWebSocket.instances[0]
    socket.onopen?.()
    await connectPromise

    socket.onmessage?.({
      data: JSON.stringify({
        type: 'session_start',
        session_id: 'session-1',
        timestamp: new Date().toISOString(),
        agent_id: 'cim',
        greeting_audio: 'ZmFrZQ==',
      }),
    })

    socket.onmessage?.({
      data: JSON.stringify({
        type: 'transcript_input',
        session_id: 'session-1',
        timestamp: new Date().toISOString(),
        text: 'Quero visitar Monsanto',
        is_final: true,
      }),
    })

    socket.onmessage?.({
      data: JSON.stringify({
        type: 'transcript_output',
        session_id: 'session-1',
        timestamp: new Date().toISOString(),
        text: 'Ola mundo',
      }),
    })

    socket.onmessage?.({
      data: JSON.stringify({
        type: 'turn_complete',
        session_id: 'session-1',
        timestamp: new Date().toISOString(),
      }),
    })

    socket.onmessage?.({
      data: JSON.stringify({
        type: 'error',
        session_id: 'session-1',
        timestamp: new Date().toISOString(),
        code: 'backend_unavailable',
        message: 'Servidor indisponivel',
        recoverable: true,
      }),
    })

    client.sendAudio('abc123')

    expect(sessionStarts).toEqual(['cim'])
    expect(receivedInputs).toEqual(['Quero visitar Monsanto'])
    expect(receivedTexts).toEqual(['Ola mundo'])
    expect(completedTurns).toEqual(['turn_complete'])
    expect(errors).toEqual(['Servidor indisponivel'])
    expect(socket.sentMessages).toHaveLength(1)
    expect(socket.sentMessages[0]).toContain('"type":"audio_input"')
    expect(socket.sentMessages[0]).toContain('"data":"abc123"')
  })

  it('reconnects automatically after a close using the configured backoff', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const client = new WSClient('ws://localhost:8000/ws', { reconnectDelaysMs: [50, 100] })
    const changes: Array<boolean> = []
    client.onConnectionChange((connected) => changes.push(connected))

    const connectPromise = client.connect()
    vi.advanceTimersByTime(0)
    const firstSocket = FakeWebSocket.instances[0]
    firstSocket.onopen?.()
    await connectPromise

    firstSocket.close()
    expect(changes).toEqual([true, false])

    vi.advanceTimersByTime(49)
    expect(FakeWebSocket.instances).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(FakeWebSocket.instances).toHaveLength(2)

    const secondSocket = FakeWebSocket.instances[1]
    secondSocket.onopen?.()

    expect(changes).toEqual([true, false, true])
  })

  it('does not reconnect after an intentional disconnect', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const client = new WSClient('ws://localhost:8000/ws', { reconnectDelaysMs: [50] })

    const connectPromise = client.connect()
    vi.advanceTimersByTime(0)
    const socket = FakeWebSocket.instances[0]
    socket.onopen?.()
    await connectPromise

    client.disconnect()
    vi.advanceTimersByTime(100)

    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('cancels the deferred first connection before creating a socket', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const client = new WSClient('ws://localhost:8000/ws')

    const connectPromise = client.connect()
    client.disconnect()
    vi.advanceTimersByTime(0)

    await expect(connectPromise).rejects.toThrow('WebSocket disconnected before first successful connection')
    expect(FakeWebSocket.instances).toHaveLength(0)
  })
})