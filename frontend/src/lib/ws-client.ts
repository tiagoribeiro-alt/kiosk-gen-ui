type EventCallback = (data: any) => void;

export class WSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners: Map<string, EventCallback[]> = new Map();

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type) {
            this.emit(parsed.type, parsed);
          }
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      this.ws.onerror = (err) => {
        console.error("WS Client error", err);
        reject(err);
      };

      this.ws.onclose = () => {
        console.log("WS Client closed");
        this.ws = null;
      };
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  on(type: string, callback: EventCallback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);
  }

  off(type: string, callback: EventCallback) {
    if (!this.listeners.has(type)) return;
    this.listeners.set(
      type,
      this.listeners.get(type)!.filter(cb => cb !== callback)
    );
  }

  private emit(type: string, payload: any) {
    if (this.listeners.has(type)) {
      this.listeners.get(type)!.forEach(cb => cb(payload));
    }
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
}
