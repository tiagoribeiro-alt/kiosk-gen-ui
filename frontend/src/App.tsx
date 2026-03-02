import { useEffect, useRef, useState } from 'react'
import { useMachine } from '@xstate/react'
import { kioskMachine } from './machines/kiosk'
import { WSClient } from './lib/ws-client'
import { AudioCaptureManager, AudioPlaybackManager } from './lib/audio'
import { Mic, MicOff, Activity } from 'lucide-react'

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
  const [state, send] = useMachine(kioskMachine)
  const wsClientRef = useRef<WSClient | null>(null)
  const captureManagerRef = useRef<AudioCaptureManager | null>(null)
  const playbackManagerRef = useRef<AudioPlaybackManager | null>(null)
  
  const [isConnected, setIsConnected] = useState(false)
  const [transcripts, setTranscripts] = useState<{role: string, text: string}[]>([])

  useEffect(() => {
    // Initialize WebSockets and Audio Managers
    const ws = new WSClient("ws://localhost:8000/ws")
    wsClientRef.current = ws
    
    const playbackManager = new AudioPlaybackManager()
    playbackManagerRef.current = playbackManager

    const captureManager = new AudioCaptureManager()
    captureManagerRef.current = captureManager

    async function setup() {
      try {
        await ws.connect()
        setIsConnected(true)
        await playbackManager.initialize()
      } catch (err) {
        console.error("Setup failed", err)
      }
    }
    setup()

    // Listen to WS events
    ws.on("audio_chunk", (data: any) => {
      send({ type: "AUDIO_CHUNK_RECEIVED" })
      playbackManager.playChunk(data.data)
    })

    ws.on("transcript_output", (data: any) => {
      setTranscripts(prev => [...prev, { role: "agent", text: data.text }])
    })

    return () => {
      captureManager.stop()
      playbackManager.stop()
      ws.disconnect()
    }
  }, [send])

  const startInteraction = async () => {
    send({ type: "PRESENCE_DETECTED" })
    
    // Start audio capture
    if (captureManagerRef.current) {
      await captureManagerRef.current.start((buffer: ArrayBuffer) => {
        if (wsClientRef.current) {
          wsClientRef.current.sendAudio(bufferToBase64(buffer));
        }
      })
    }
  }

  const stopInteraction = () => {
    send({ type: "TIMEOUT_INACTIVITY" })
    captureManagerRef.current?.stop()
    playbackManagerRef.current?.clear()
  }

  return (
    <div className="w-full h-screen bg-slate-50 flex flex-col p-8 items-center font-sans text-slate-800">
      {/* Header */}
      <header className="w-full flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm">
        <h1 className="text-2xl font-bold">Kiosk Gen-UI <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded">M1 Skeleton</span></h1>
        <div className="flex gap-4 items-center">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm font-medium">{isConnected ? 'WS Connected' : 'Disconnected'}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl flex gap-8">
        {/* Left Column: Flow & State */}
        <div className="flex-[1] flex flex-col gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex-1">
            <h2 className="text-lg font-semibold mb-4 text-slate-700 uppercase tracking-wider text-sm flex gap-2 items-center">
              <Activity size={18}/> System State
            </h2>
            
            <div className="text-5xl font-black mb-8 p-4 bg-slate-50 rounded-xl text-center capitalize text-slate-600">
              {state.value as string}
            </div>

            <div className="flex flex-col gap-3">
              {(state.value === 'idle' || state.value === 'farewell') ? (
                <button 
                  onClick={startInteraction}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Mic size={20} /> Simulate Presence / Start Mic
                </button>
              ) : (
                <button 
                  onClick={stopInteraction}
                  className="w-full py-4 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <MicOff size={20} /> Stop Interaction
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Transcript */}
        <div className="flex-[2] bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">Live Transcript</h2>
          
          <div className="flex-1 overflow-y-auto flex flex-col gap-4">
            {transcripts.length === 0 ? (
              <div className="m-auto text-slate-400 italic">No conversation yet. Press start and speak...</div>
            ) : (
              transcripts.map((t, i) => (
                <div key={i} className={`p-4 rounded-xl max-w-[80%] ${t.role === 'user' ? 'bg-blue-50 self-end text-blue-900 rounded-br-none' : 'bg-slate-100 self-start text-slate-800 rounded-bl-none'}`}>
                  {t.text}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
