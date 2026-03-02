type AudioOutputCallback = (buffer: ArrayBuffer) => void;

export class AudioCaptureManager {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private onData: AudioOutputCallback | null = null;

  async start(onData: AudioOutputCallback) {
    this.onData = onData;
    this.context = new AudioContext({ sampleRate: 16000 });
    
    await this.context.audioWorklet.addModule('/audio-processors/capture.worklet.js');
    
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    });

    this.source = this.context.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.context, 'capture-worklet');

    this.workletNode.port.onmessage = (event) => {
      if (this.onData) {
        this.onData(event.data);
      }
    };

    this.source.connect(this.workletNode);
    this.workletNode.connect(this.context.destination);
  }

  stop() {
    this.workletNode?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach(track => track.stop());
    this.context?.close();
    
    this.stream = null;
    this.source = null;
    this.workletNode = null;
    this.context = null;
  }
}

export class AudioPlaybackManager {
  private context: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;

  async initialize() {
    this.context = new AudioContext({ sampleRate: 24000 });
    await this.context.audioWorklet.addModule('/audio-processors/playback.worklet.js');
    
    this.workletNode = new AudioWorkletNode(this.context, 'playback-worklet');
    this.workletNode.connect(this.context.destination);
  }

  playChunk(base64Data: string) {
    if (!this.workletNode || !this.context) return;
    
    // Decode base64 to binary
    const binary = atob(base64Data);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    // Int16 to Float32
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
    }

    this.workletNode.port.postMessage(float32Array);
  }
  
  clear() {
    if (this.workletNode) {
      this.workletNode.port.postMessage('clear');
    }
  }

  stop() {
    this.clear();
    this.workletNode?.disconnect();
    this.context?.close();
    this.context = null;
    this.workletNode = null;
  }
}
