// @vitest-environment jsdom

import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FAREWELL_DURATION_MS, LISTENING_TIMEOUT_MS } from './machines/kiosk'

type MockEventMap = Record<string, Array<(payload: any) => void>>

const { MockWSClient, MockAudioCaptureManager, MockAudioPlaybackManager } = vi.hoisted(() => {
  class HoistedMockWSClient {
    static instances: Array<HoistedMockWSClient> = []

    listeners: MockEventMap = {}
    connectionListeners: Array<(connected: boolean) => void> = []
    sendAudio = vi.fn()
    disconnect = vi.fn()
    url: string

    constructor(url: string) {
      this.url = url
      HoistedMockWSClient.instances.push(this)
    }

    async connect() {
      this.emitConnection(true)
    }

    on(type: string, callback: (payload: any) => void) {
      this.listeners[type] ??= []
      this.listeners[type].push(callback)
    }

    off() {}

    onConnectionChange(callback: (connected: boolean) => void) {
      this.connectionListeners.push(callback)
    }

    offConnectionChange(callback: (connected: boolean) => void) {
      this.connectionListeners = this.connectionListeners.filter((listener) => listener !== callback)
    }

    emit(type: string, payload: any) {
      for (const listener of this.listeners[type] ?? []) {
        listener(payload)
      }
    }

    emitConnection(connected: boolean) {
      for (const listener of this.connectionListeners) {
        listener(connected)
      }
    }
  }

  class HoistedMockAudioCaptureManager {
    setOnAmplitudeChange = vi.fn()
    start = vi.fn(async () => {})
    stop = vi.fn()
  }

  class HoistedMockAudioPlaybackManager {
    initialize = vi.fn(async () => {})
    setOnPlaybackStateChange = vi.fn()
    setOnOutputAmplitudeChange = vi.fn()
    playBase64Wav = vi.fn(async () => {})
    playChunk = vi.fn()
    clear = vi.fn()
    stop = vi.fn()
  }

  return {
    MockWSClient: HoistedMockWSClient,
    MockAudioCaptureManager: HoistedMockAudioCaptureManager,
    MockAudioPlaybackManager: HoistedMockAudioPlaybackManager,
  }
})

vi.mock('./lib/ws-client', () => ({
  WSClient: MockWSClient,
}))

vi.mock('./lib/audio', () => ({
  AudioCaptureManager: MockAudioCaptureManager,
  AudioPlaybackManager: MockAudioPlaybackManager,
  ZERO_FREQUENCY_DATA: {
    low: 0,
    mid: 0,
    high: 0,
    average: 0,
  },
}))

vi.mock('qrcode', () => ({
  toDataURL: vi.fn(async () => 'data:image/png;base64,fake-qr'),
}))

import App from './App'

function getLastWSClient(): InstanceType<typeof MockWSClient> {
  const instance = MockWSClient.instances.at(-1)
  if (!instance) {
    throw new Error('Expected a MockWSClient instance to exist')
  }
  return instance
}

describe('App integration flow', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/?devControls=1')
    MockWSClient.instances = []
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      setTransform: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      globalCompositeOperation: 'source-over',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      lineCap: 'round',
      lineJoin: 'round',
    } as unknown as CanvasRenderingContext2D)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('starts in idle screensaver and progresses to active and farewell through mocked websocket events', async () => {
    render(<App />)

    expect(await screen.findByText('Mais Portugal para Descobrir')).toBeTruthy()
    expect(screen.getByText('Iniciar interacao')).toBeTruthy()

    fireEvent.click(screen.getByText('Iniciar interacao'))

    await waitFor(() => {
      expect(screen.getByText('Terminar interacao')).toBeTruthy()
      expect(screen.getByText('Estou a preparar a conversa.')).toBeTruthy()
    })

    const wsClient = getLastWSClient()
    wsClient.emit('ui_snapshot', {
      type: 'ui_snapshot',
      session_id: 'session-1',
      timestamp: new Date().toISOString(),
      items: [
        {
          id: 'poi-1',
          kind: 'poi',
          title: 'Monsanto',
          sequence: 1,
          visual_state: 'active',
          location: 'Idanha-a-Nova',
        },
      ],
      shell: { brand: 'Way Finder', agent_label: 'CIM' },
      step: 'discover',
      focus_item_id: 'poi-1',
    })

    await waitFor(() => {
      expect(screen.getByText('Monsanto')).toBeTruthy()
      expect(screen.queryByText('Mais Portugal para Descobrir')).toBeNull()
    })

    wsClient.emit('transcript_input', {
      type: 'transcript_input',
      session_id: 'session-1',
      timestamp: new Date().toISOString(),
      text: 'Quero um trilho',
      is_final: false,
    })

    wsClient.emit('transcript_input', {
      type: 'transcript_input',
      session_id: 'session-1',
      timestamp: new Date().toISOString(),
      text: 'Quero um trilho com vista',
      is_final: true,
    })

    await waitFor(() => {
      expect(screen.getByText('Monsanto')).toBeTruthy()
      expect(screen.queryByText('Quero um trilho com vista')).toBeNull()
    })

    wsClient.emit('session_end', {
      type: 'session_end',
      session_id: 'session-1',
      timestamp: new Date().toISOString(),
      qr_data: 'qr://visit',
      summary_url: 'https://example.com/resumo',
    })

    await waitFor(() => {
      expect(screen.getByText(/Regressa ao inicio em/i)).toBeTruthy()
    })
  })

  it('shows and clears the recovery error across a disconnect and reconnect', async () => {
    render(<App />)

    fireEvent.click(screen.getByText('Iniciar interacao'))

    const wsClient = getLastWSClient()
    await waitFor(() => {
      expect(screen.getByText('Terminar interacao')).toBeTruthy()
    })

    wsClient.emitConnection(false)

    await waitFor(() => {
      expect(screen.getByText('Ligacao ao backend perdida. A tentar recuperar.')).toBeTruthy()
    })

    wsClient.emitConnection(true)

    await waitFor(() => {
      expect(screen.queryByText('Ligacao ao backend perdida. A tentar recuperar.')).toBeNull()
    })
  })

  it('returns to the idle screensaver after the farewell timeout elapses', async () => {
    vi.useFakeTimers()
    render(<App />)

    fireEvent.click(screen.getByText('Iniciar interacao'))

    const wsClient = getLastWSClient()
    await act(async () => {
      wsClient.emit('session_end', {
        type: 'session_end',
        session_id: 'session-1',
        timestamp: new Date().toISOString(),
        qr_data: 'qr://visit',
        summary_url: 'https://example.com/resumo',
      })
      await Promise.resolve()
    })

    expect(screen.getByText(/Regressa ao inicio em/i)).toBeTruthy()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FAREWELL_DURATION_MS + 50)
    })

    expect(screen.getByText('Mais Portugal para Descobrir')).toBeTruthy()
  })

  it('renders the summary and qr handoff when session_end follows a carry snapshot', async () => {
    render(<App />)

    fireEvent.click(screen.getByText('Iniciar interacao'))

    const wsClient = getLastWSClient()
    await waitFor(() => {
      expect(screen.getByText('Terminar interacao')).toBeTruthy()
    })

    await act(async () => {
      wsClient.emit('ui_snapshot', {
        type: 'ui_snapshot',
        session_id: 'session-1',
        timestamp: new Date().toISOString(),
        items: [
          {
            id: 'summary-1',
            kind: 'summary',
            title: 'Resumo da visita',
            description: 'Monsanto, rota sugerida e agenda preparada para levar.',
            sequence: 3,
            visual_state: 'active',
          },
          {
            id: 'qr-1',
            kind: 'qr',
            title: 'QR de checkout',
            description: 'Scan para abrir o resumo no telemovel.',
            sequence: 4,
            visual_state: 'active',
          },
        ],
        shell: { brand: 'Way Finder', agent_label: 'CIM' },
        step: 'carry',
        focus_item_id: 'qr-1',
      })
      await Promise.resolve()
    })

    expect(screen.getByText('Resumo da visita')).toBeTruthy()
    expect(screen.getByText('QR de checkout')).toBeTruthy()

    await act(async () => {
      wsClient.emit('session_end', {
        type: 'session_end',
        session_id: 'session-1',
        timestamp: new Date().toISOString(),
        qr_data: 'qr://visit',
        summary_url: 'https://example.com/resumo',
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByText(/Regressa ao inicio em/i)).toBeTruthy()
      expect(screen.getByText('example.com/resumo')).toBeTruthy()
      expect(screen.getByText('qr://visit')).toBeTruthy()
      expect(screen.getByAltText('QR code da visita')).toBeTruthy()
    })
  })

  it('shows a sensor simulation toggle when requested by query string', async () => {
    window.history.pushState({}, '', '/?sensorToggle=1')

    render(<App />)

    const toggle = await screen.findByLabelText('Simular sensor de presenca')
    expect(toggle).toBeTruthy()
    expect(screen.getByText('Teste de sensor')).toBeTruthy()

    fireEvent.click(toggle)

    await waitFor(() => {
      expect(screen.getByText('Terminar interacao')).toBeTruthy()
      expect(screen.getByText('Estou a preparar a conversa.')).toBeTruthy()
    })

    fireEvent.click(toggle)

    await waitFor(() => {
      expect(screen.getByText('Iniciar interacao')).toBeTruthy()
      expect(screen.getByText('Mais Portugal para Descobrir')).toBeTruthy()
    })
  })

  it('disconnects the websocket when the kiosk returns to idle after the listening timeout', async () => {
    vi.useFakeTimers()
    render(<App />)

    await act(async () => {
      fireEvent.click(screen.getByText('Iniciar interacao'))
      await Promise.resolve()
      await Promise.resolve()
    })

    const wsClient = getLastWSClient()
    expect(screen.getByText('Terminar interacao')).toBeTruthy()

    await act(async () => {
      vi.advanceTimersByTime(LISTENING_TIMEOUT_MS + 50)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('Mais Portugal para Descobrir')).toBeTruthy()
    expect(wsClient.disconnect).toHaveBeenCalled()
  })

  it('lets the control panel collapse and expand without leaving the page', async () => {
    render(<App />)

    const collapseButton = await screen.findByLabelText('Minimizar painel de controlo')
    fireEvent.click(collapseButton)

    expect(screen.queryByLabelText('Simular sensor de presenca')).toBeNull()
    expect(screen.getByLabelText('Expandir painel de controlo')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Expandir painel de controlo'))

    expect(await screen.findByLabelText('Simular sensor de presenca')).toBeTruthy()
  })
})