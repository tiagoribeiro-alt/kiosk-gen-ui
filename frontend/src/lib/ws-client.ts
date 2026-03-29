import type { WSEventMap } from './ws-events'

type EventType = keyof WSEventMap
type EventCallback<T extends EventType> = (data: WSEventMap[T]) => void
type ConnectionCallback = (isConnected: boolean) => void
type UntypedEventCallback = (data: WSEventMap[EventType]) => void

type WSClientOptions = {
  reconnectDelaysMs?: Array<number>
  initialConnectTimeoutMs?: number
}

export class WSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectDelaysMs: Array<number>
  private listeners: Partial<Record<EventType, Array<UntypedEventCallback>>> = {}
  private connectionListeners: Array<ConnectionCallback> = []
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null
  private initialOpenTimeoutId: ReturnType<typeof setTimeout> | null = null
  private initialConnectTimeoutId: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private wasManuallyDisconnected = false
  private firstConnectPromise: Promise<void> | null = null
  private resolveFirstConnect: (() => void) | null = null
  private rejectFirstConnect: ((reason?: unknown) => void) | null = null
  private initialConnectTimeoutMs: number

  constructor(url: string, options: WSClientOptions = {}) {
    this.url = url;
    this.reconnectDelaysMs = options.reconnectDelaysMs ?? [1000, 2000, 4000, 8000, 16000]
    this.initialConnectTimeoutMs = options.initialConnectTimeoutMs ?? 10000
  }

  connect(): Promise<void> {
    if (this.firstConnectPromise) {
      return this.firstConnectPromise
    }

    this.wasManuallyDisconnected = false
    this.firstConnectPromise = new Promise((resolve, reject) => {
      this.resolveFirstConnect = resolve
      this.rejectFirstConnect = reject
    })

    this.scheduleInitialOpen()
    this.scheduleInitialConnectTimeout()
    return this.firstConnectPromise
  }

  disconnect() {
    this.wasManuallyDisconnected = true
    if (this.initialOpenTimeoutId !== null) {
      clearTimeout(this.initialOpenTimeoutId)
      this.initialOpenTimeoutId = null
    }
    if (this.initialConnectTimeoutId !== null) {
      clearTimeout(this.initialConnectTimeoutId)
      this.initialConnectTimeoutId = null
    }
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = null
    }
    const socket = this.ws
    this.ws = null
    if (!socket) {
      this.failPendingFirstConnect()
    }
    if (socket) {
      socket.close();
      this.emitConnectionState(false)
    }
  }

  on<T extends EventType>(type: T, callback: EventCallback<T>) {
    const listeners = (this.listeners[type] ?? []) as Array<UntypedEventCallback>
    listeners.push(callback as UntypedEventCallback)
    this.listeners[type] = listeners
  }

  onConnectionChange(callback: ConnectionCallback) {
    this.connectionListeners.push(callback)
  }

  offConnectionChange(callback: ConnectionCallback) {
    this.connectionListeners = this.connectionListeners.filter((listener) => listener !== callback)
  }

  off<T extends EventType>(type: T, callback: EventCallback<T>) {
    const listeners = this.listeners[type] as Array<UntypedEventCallback> | undefined
    if (!listeners) return

    this.listeners[type] = listeners.filter((cb) => cb !== (callback as UntypedEventCallback))
  }

  private emit<T extends EventType>(type: T, payload: WSEventMap[T]) {
    const listeners = this.listeners[type]
    if (!listeners) return

    listeners.forEach((cb) => cb(payload))
  }

  sendAudio(base64Data: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "audio_input",
        session_id: "client", // The backend will ignore client side id or we provide proper.
        data: base64Data,
        mime_type: "audio/pcm;rate=16000"
      }));
    }
  }

  private emitConnectionState(isConnected: boolean) {
    this.connectionListeners.forEach((callback) => callback(isConnected))
  }

  private scheduleInitialOpen() {
    if (this.initialOpenTimeoutId !== null || this.ws) {
      return
    }

    this.initialOpenTimeoutId = setTimeout(() => {
      this.initialOpenTimeoutId = null
      if (!this.wasManuallyDisconnected) {
        this.openSocket()
      }
    }, 0)
  }

  private failPendingFirstConnect() {
    if (this.initialConnectTimeoutId !== null) {
      clearTimeout(this.initialConnectTimeoutId)
      this.initialConnectTimeoutId = null
    }

    this.rejectFirstConnect?.(new Error('WebSocket disconnected before first successful connection'))
    this.resolveFirstConnect = null
    this.rejectFirstConnect = null
    this.firstConnectPromise = null
  }

  private openSocket() {
    const socket = new WebSocket(this.url)
    this.ws = socket

    socket.onopen = () => {
      if (this.ws !== socket) {
        return
      }

      this.reconnectAttempt = 0
      if (this.initialConnectTimeoutId !== null) {
        clearTimeout(this.initialConnectTimeoutId)
        this.initialConnectTimeoutId = null
      }
      this.emitConnectionState(true)
      this.resolveFirstConnect?.()
      this.resolveFirstConnect = null
      this.rejectFirstConnect = null
    }

    socket.onmessage = (event) => {
      if (this.ws !== socket) {
        return
      }

      try {
        const parsed = JSON.parse(event.data)
        if (parsed.type) {
          this.emit(parsed.type, parsed)
        }
      } catch (e) {
        console.error('Failed to parse WS message', e)
      }
    }

    socket.onerror = (err) => {
      if (this.ws !== socket || this.wasManuallyDisconnected) {
        return
      }

      console.error('WS Client error', err)
    }

    socket.onclose = () => {
      if (this.ws !== socket) {
        return
      }

      console.log('WS Client closed')
      this.emitConnectionState(false)
      this.ws = null

      if (this.wasManuallyDisconnected) {
        this.failPendingFirstConnect()
        return
      }

      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeoutId !== null) {
      return
    }

    const delay = this.reconnectDelaysMs[Math.min(this.reconnectAttempt, this.reconnectDelaysMs.length - 1)]
    this.reconnectAttempt += 1
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null
      if (!this.wasManuallyDisconnected) {
        this.openSocket()
      }
    }, delay)
  }

  private scheduleInitialConnectTimeout() {
    if (this.initialConnectTimeoutId !== null) {
      return
    }

    this.initialConnectTimeoutId = setTimeout(() => {
      this.initialConnectTimeoutId = null
      if (!this.firstConnectPromise) {
        return
      }

      this.wasManuallyDisconnected = true
      if (this.ws) {
        this.ws.close()
      } else {
        this.failPendingFirstConnect()
      }
    }, this.initialConnectTimeoutMs)
  }
}
