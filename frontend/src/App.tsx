import { useEffect, useRef, useState } from 'react'
import { useMachine } from '@xstate/react'
import { toDataURL } from 'qrcode'
import { kioskMachine, FAREWELL_DURATION_MS, getLifecycleTimeoutMs } from './machines/kiosk'
import { WSClient } from './lib/ws-client'
import type { UiSnapshotEvent } from './lib/ws-events'
import { AudioCaptureManager, AudioPlaybackManager, ZERO_FREQUENCY_DATA, type FrequencyData } from './lib/audio'
import { resolveWebSocketUrl } from './lib/runtime-config'
import { ChevronDown, ChevronUp, Mic, MicOff } from 'lucide-react'
import { JourneyHost, applyJourneyHandoff, createJourneyMockScene, createJourneyScene, createJourneySceneFromSnapshot, type JourneyHandoff } from './features/journey'

type TranscriptEntry = {
  id: string
  role: 'user' | 'agent'
  text: string
}

// Convert ArrayBuffer to Base64
function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export default function App() {
  const searchParams = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search)
  const mockSceneParam = searchParams?.get('mockScene') ?? null
  const showMockMidConversation = mockSceneParam === 'mid'
  const websocketUrl = resolveWebSocketUrl({
    wsUrl: import.meta.env.VITE_WS_URL,
    backendUrl: import.meta.env.VITE_BACKEND_URL,
    fallbackOrigin: typeof window === 'undefined' ? null : window.location.origin,
  })
  const [state, send] = useMachine(kioskMachine)
  const wsClientRef = useRef<WSClient | null>(null)
  const captureManagerRef = useRef<AudioCaptureManager | null>(null)
  const playbackManagerRef = useRef<AudioPlaybackManager | null>(null)
  
  const [isConnected, setIsConnected] = useState(false)
  const [transcripts, setTranscripts] = useState<Array<TranscriptEntry>>([])
  const [journeySnapshot, setJourneySnapshot] = useState<UiSnapshotEvent | null>(null)
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false)
  const [journeyHandoff, setJourneyHandoff] = useState<JourneyHandoff | null>(null)
  const [farewellDeadline, setFarewellDeadline] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const agentSpeechTimeoutRef = useRef<number | null>(null)
  const pendingGreetingAudioRef = useRef<string | null>(null)
  const audioReadyRef = useRef(false)
  const sessionRequestedRef = useRef(false)
  const expectedDisconnectRef = useRef(false)
  const inputSignalRef = useRef<FrequencyData>(ZERO_FREQUENCY_DATA)
  const outputSignalRef = useRef<FrequencyData>(ZERO_FREQUENCY_DATA)
  const showDevControls = import.meta.env.DEV && searchParams?.get('devControls') === '1'
  const showSensorToggle = searchParams?.get('sensorToggle') === '1'
  const showControlPanel = showDevControls || showSensorToggle
  const isSensorActive = state.value === 'listening' || state.value === 'active'
  const [isControlPanelCollapsed, setIsControlPanelCollapsed] = useState(false)

  const resetWaveformSignals = () => {
    inputSignalRef.current = ZERO_FREQUENCY_DATA
    outputSignalRef.current = ZERO_FREQUENCY_DATA
  }

  const playGreetingAudio = async (playbackManager: AudioPlaybackManager, greetingAudio: string) => {
    if (!greetingAudio) {
      return
    }

    try {
      await playbackManager.playBase64Wav(greetingAudio)
      pendingGreetingAudioRef.current = null
    } catch (error) {
      console.error('Failed to play greeting audio', error)
      setErrorMessage('A ligacao iniciou, mas o audio de boas-vindas falhou.')
    }
  }

  const markAgentSpeaking = () => {
    setIsAgentSpeaking(true)
    send({ type: 'ACTIVITY_DETECTED' })
    if (agentSpeechTimeoutRef.current !== null) {
      window.clearTimeout(agentSpeechTimeoutRef.current)
    }
    agentSpeechTimeoutRef.current = window.setTimeout(() => {
      setIsAgentSpeaking(false)
      agentSpeechTimeoutRef.current = null
    }, 900)
  }

  const liveJourneyScene = journeySnapshot
    ? createJourneySceneFromSnapshot(journeySnapshot, {
        kioskState: state.value as 'idle' | 'listening' | 'active' | 'farewell',
        isConnected,
        transcripts,
        isAgentSpeaking,
      })
    : createJourneyScene({
        kioskState: state.value as 'idle' | 'listening' | 'active' | 'farewell',
        isConnected,
        transcripts,
        isAgentSpeaking,
      })
  const journeyScene = showMockMidConversation
    ? createJourneyMockScene('active')
    : { ...applyJourneyHandoff(liveJourneyScene, journeyHandoff), farewellDeadline, errorMessage }

  useEffect(() => {
    if (showMockMidConversation) {
      return
    }

    let isDisposed = false

    // Initialize WebSockets and Audio Managers
    const ws = new WSClient(websocketUrl)
    wsClientRef.current = ws
    
    const playbackManager = new AudioPlaybackManager()
    playbackManagerRef.current = playbackManager
    playbackManager.setOnOutputAmplitudeChange((data) => {
      outputSignalRef.current = data
    })

    const captureManager = new AudioCaptureManager()
    captureManagerRef.current = captureManager
    captureManager.setOnAmplitudeChange((data) => {
      inputSignalRef.current = data
    })

    const handleConnectionChange = (connected: boolean) => {
      setIsConnected(connected)
      if (!connected) {
        setIsAgentSpeaking(false)
        resetWaveformSignals()
        if (expectedDisconnectRef.current) {
          expectedDisconnectRef.current = false
          setErrorMessage(null)
          return
        }

        if (sessionRequestedRef.current) {
          setErrorMessage('Ligacao ao backend perdida. A tentar recuperar.')
        }
      } else {
        expectedDisconnectRef.current = false
        setErrorMessage(null)
      }
    }

    ws.onConnectionChange(handleConnectionChange)

    playbackManager.setOnPlaybackStateChange((playing) => {
      setIsAgentSpeaking(playing)
      if (playing) {
        send({ type: 'ACTIVITY_DETECTED' })
      }
    })

    // Listen to WS events
    ws.on('session_start', async (data) => {
      if (isDisposed) {
        return
      }

      setErrorMessage(null)
      if (data.greeting_audio) {
        if (!audioReadyRef.current) {
          pendingGreetingAudioRef.current = data.greeting_audio
          return
        }

        await playGreetingAudio(playbackManager, data.greeting_audio)
      }
    })

    ws.on('audio_chunk', (data) => {
      if (isDisposed) {
        return
      }

      send({ type: "AUDIO_CHUNK_RECEIVED" })
      markAgentSpeaking()
      playbackManager.playChunk(data.data)
    })

    ws.on('transcript_output', (data) => {
      if (isDisposed) {
        return
      }

      send({ type: 'ACTIVITY_DETECTED' })
      setTranscripts((prev) => [
        ...prev,
        {
          id: `agent:${data.timestamp}`,
          role: 'agent',
          text: data.text,
        },
      ])
    })

    ws.on('transcript_input', (data) => {
      if (isDisposed) {
        return
      }

      send({ type: 'ACTIVITY_DETECTED' })
      const normalizedText = data.text.trim()
      if (!normalizedText) {
        return
      }

      setTranscripts((prev) => {
        const liveEntryId = data.turn_id ?? 'input-live'

        if (data.is_final) {
          const finalizedEntryId = data.turn_id ?? `input-final:${data.timestamp}`
          return [
            ...prev.filter((entry) => entry.id !== liveEntryId),
            {
              id: finalizedEntryId,
              role: 'user',
              text: normalizedText,
            },
          ]
        }

        const nextEntry = {
          id: liveEntryId,
          role: 'user' as const,
          text: normalizedText,
        }
        const existingIndex = prev.findIndex((entry) => entry.id === liveEntryId)
        if (existingIndex === -1) {
          return [...prev, nextEntry]
        }

        const nextTranscripts = [...prev]
        nextTranscripts[existingIndex] = nextEntry
        return nextTranscripts
      })
    })

    ws.on('ui_snapshot', (data) => {
      if (isDisposed) {
        return
      }

      setJourneySnapshot(data)
      setErrorMessage(null)
      send({ type: 'UI_SNAPSHOT_RECEIVED' })
    })

    ws.on('error', (data) => {
      if (isDisposed) {
        return
      }

      setErrorMessage(data.message)
    })

    ws.on('session_end', async (data) => {
      if (isDisposed) {
        return
      }

      let qrImageSrc: string | undefined
      if (data.qr_data) {
        try {
          qrImageSrc = await toDataURL(data.qr_data, {
            margin: 1,
            scale: 6,
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
          })
        } catch (error) {
          console.error('Failed to build QR image', error)
        }
      }

      setJourneyHandoff({
        summaryUrl: data.summary_url ?? undefined,
        qrData: data.qr_data ?? undefined,
        qrImageSrc,
      })
      setFarewellDeadline(Date.now() + FAREWELL_DURATION_MS)
      send({ type: 'SESSION_END_TOOL' })
      sessionRequestedRef.current = false
      expectedDisconnectRef.current = true
      captureManager.stop()
      playbackManager.clear()
      ws.disconnect()
      resetWaveformSignals()
      setIsAgentSpeaking(false)
    })

    ws.on('turn_complete', () => {
      if (isDisposed) {
        return
      }

      send({ type: 'TURN_COMPLETE' })
      setIsAgentSpeaking(false)
    })

    return () => {
      isDisposed = true
      ws.offConnectionChange(handleConnectionChange)
      if (agentSpeechTimeoutRef.current !== null) {
        window.clearTimeout(agentSpeechTimeoutRef.current)
      }
      expectedDisconnectRef.current = true
      resetWaveformSignals()
      captureManager.stop()
      playbackManager.stop()
      ws.disconnect()
    }
  }, [send, showMockMidConversation, websocketUrl])

  useEffect(() => {
    if (showMockMidConversation) {
      return
    }

    if (state.value !== 'idle') {
      return
    }

    if (!sessionRequestedRef.current) {
      return
    }

    sessionRequestedRef.current = false
    expectedDisconnectRef.current = true
    captureManagerRef.current?.stop()
    playbackManagerRef.current?.clear()
    resetWaveformSignals()
    setIsAgentSpeaking(false)
    setErrorMessage(null)
    wsClientRef.current?.disconnect()
  }, [showMockMidConversation, state.value])

  const startInteraction = async () => {
    setTranscripts([])
    setJourneySnapshot(null)
    setJourneyHandoff(null)
    setFarewellDeadline(null)
    setErrorMessage(null)
    setIsAgentSpeaking(false)
    resetWaveformSignals()
    sessionRequestedRef.current = true
    expectedDisconnectRef.current = false
    send({ type: "PRESENCE_DETECTED" })

    if (wsClientRef.current && !isConnected) {
      try {
        await wsClientRef.current.connect()
      } catch (error) {
        console.error('Failed to establish websocket connection', error)
        sessionRequestedRef.current = false
        setErrorMessage('Nao foi possivel ligar ao backend do kiosk.')
        send({ type: 'TIMEOUT_INACTIVITY' })
        return
      }
    }

    if (playbackManagerRef.current && !audioReadyRef.current) {
      try {
        await playbackManagerRef.current.initialize()
        audioReadyRef.current = true
      } catch (error) {
        console.error('Failed to initialize playback audio', error)
        setErrorMessage('Nao foi possivel preparar o audio do quiosque.')
        return
      }

      if (pendingGreetingAudioRef.current) {
        await playGreetingAudio(playbackManagerRef.current, pendingGreetingAudioRef.current)
      }
    }
    
    // Start audio capture
    if (captureManagerRef.current) {
      await captureManagerRef.current.start((buffer: ArrayBuffer) => {
        send({ type: 'ACTIVITY_DETECTED' })
        if (wsClientRef.current) {
          wsClientRef.current.sendAudio(bufferToBase64(buffer));
        }
      })
    }
  }

  const stopInteraction = () => {
    sessionRequestedRef.current = false
    expectedDisconnectRef.current = true
    send({ type: "TIMEOUT_INACTIVITY" })
    setJourneyHandoff(null)
    setFarewellDeadline(null)
    setIsAgentSpeaking(false)
    setErrorMessage(null)
    resetWaveformSignals()
    captureManagerRef.current?.stop()
    playbackManagerRef.current?.clear()
    wsClientRef.current?.disconnect()
  }

  const handleSensorToggleChange = async (enabled: boolean) => {
    if (enabled) {
      await startInteraction()
      return
    }

    stopInteraction()
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-transparent font-sans text-slate-800">
      <main className="flex h-full w-full flex-col">
        <div className="flex-1">
          <JourneyHost scene={journeyScene} inputSignalRef={inputSignalRef} outputSignalRef={outputSignalRef} />
        </div>
      </main>

      {showControlPanel ? (
      <aside className="fixed bottom-6 right-6 z-10 w-[17rem] rounded-[1.4rem] border border-slate-200 bg-white/88 p-4 shadow-[0_20px_44px_-30px_rgba(15,23,42,0.3)] backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">{showDevControls ? 'Desenvolvimento' : 'Teste de sensor'}</p>
            <p className="mt-3 text-sm text-slate-600">Estado atual: <span className="font-medium capitalize text-slate-900">{state.value as string}</span></p>
            <p className="mt-1 text-sm text-slate-600">Ligacao backend: <span className="font-medium text-slate-900">{isConnected ? 'ativa' : 'indisponivel'}</span></p>
            <p className="mt-1 text-xs text-slate-400">Timeout atual: <span className="font-medium text-slate-500">{getLifecycleTimeoutMs(state.value as 'idle' | 'listening' | 'active' | 'farewell') ?? 0} ms</span></p>
          </div>
          <button
            type="button"
            aria-label={isControlPanelCollapsed ? 'Expandir painel de controlo' : 'Minimizar painel de controlo'}
            onClick={() => setIsControlPanelCollapsed((current) => !current)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
          >
            {isControlPanelCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {isControlPanelCollapsed ? null : (
          <>
            <label className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-700">
              <div>
                <p className="font-semibold text-slate-900">Simular sensor</p>
                <p className="mt-1 text-[0.76rem] text-slate-500">Ativa o evento de presenca para testes no browser.</p>
              </div>
              <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
                <input
                  aria-label="Simular sensor de presenca"
                  checked={isSensorActive}
                  className="peer sr-only"
                  onChange={(event) => {
                    void handleSensorToggleChange(event.target.checked)
                  }}
                  type="checkbox"
                />
                <span className="absolute inset-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-sky-500" />
                <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
              </span>
            </label>

            {(state.value === 'idle' || state.value === 'farewell') ? (
              <button
                onClick={startInteraction}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
              >
                <Mic size={18} /> Iniciar interacao
              </button>
            ) : (
              <button
                onClick={stopInteraction}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
              >
                <MicOff size={18} /> Terminar interacao
              </button>
            )}
          </>
        )}
      </aside>
      ) : null}
    </div>
  )
}
