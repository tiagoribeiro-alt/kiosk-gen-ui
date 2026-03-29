type AudioOutputCallback = (buffer: ArrayBuffer) => void;

type PlaybackStateCallback = (isPlaying: boolean) => void;
export type FrequencyData = {
  low: number;
  mid: number;
  high: number;
  average: number;
};

type AmplitudeCallback = (data: FrequencyData) => void;

export const ZERO_FREQUENCY_DATA: FrequencyData = {
  low: 0,
  mid: 0,
  high: 0,
  average: 0,
};

function resolveWorkletModuleUrl(modulePath: string): string {
  const normalizedBase = import.meta.env.BASE_URL || '/'
  const baseUrl = new URL(normalizedBase, window.location.origin)
  return new URL(modulePath.replace(/^\/+/, ''), baseUrl).toString()
}

function averageRange(dataArray: Uint8Array<ArrayBuffer>, startIndex: number, endIndex: number): number {
  const safeStart = Math.max(0, Math.min(startIndex, dataArray.length))
  const safeEnd = Math.max(safeStart + 1, Math.min(endIndex, dataArray.length))
  let total = 0
  for (let index = safeStart; index < safeEnd; index += 1) {
    total += dataArray[index]
  }

  return (total / (safeEnd - safeStart)) / 255
}

function readFrequencyData(analyser: AnalyserNode, dataArray: Uint8Array<ArrayBuffer>): FrequencyData {
  analyser.getByteFrequencyData(dataArray)

  const nyquist = analyser.context.sampleRate / 2
  const totalBins = dataArray.length
  const lowEnd = Math.max(1, Math.floor((250 / nyquist) * totalBins))
  const midEnd = Math.max(lowEnd + 1, Math.floor((2500 / nyquist) * totalBins))

  const low = averageRange(dataArray, 0, lowEnd)
  const mid = averageRange(dataArray, lowEnd, midEnd)
  const high = averageRange(dataArray, midEnd, totalBins)
  const average = averageRange(dataArray, 0, totalBins)

  return { low, mid, high, average }
}

export class AudioCaptureManager {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private animationFrameId: number | null = null;
  private onData: AudioOutputCallback | null = null;
  private onAmplitudeChange: AmplitudeCallback | null = null;

  setOnAmplitudeChange(callback: AmplitudeCallback | null) {
    this.onAmplitudeChange = callback;
    if (!callback) {
      this.stopAnalysis()
      return
    }

    if (this.context && this.analyser && this.dataArray && this.animationFrameId === null) {
      this.startAnalysis()
    }
  }

  async start(onData: AudioOutputCallback) {
    this.onData = onData;
    if (this.context?.state === 'running') {
      if (this.onAmplitudeChange && this.animationFrameId === null) {
        this.startAnalysis()
      }
      return;
    }

    if (this.context?.state === 'suspended') {
      await this.context.resume()
      if (this.onAmplitudeChange && this.animationFrameId === null) {
        this.startAnalysis()
      }
      return
    }

    this.context = new AudioContext({ sampleRate: 16000 });

    await this.context.audioWorklet.addModule(resolveWorkletModuleUrl('audio-processors/capture.worklet.js'));
    
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    });

    this.source = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.55;
    this.dataArray = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount))
    this.workletNode = new AudioWorkletNode(this.context, 'capture-worklet');

    this.workletNode.port.onmessage = (event) => {
      if (this.onData) {
        this.onData(event.data);
      }
    };

    this.source.connect(this.analyser);
    this.source.connect(this.workletNode);
    if (this.context.state === 'suspended') {
      await this.context.resume()
    }

    if (this.onAmplitudeChange) {
      this.startAnalysis()
    }
  }

  private startAnalysis() {
    if (!this.analyser || !this.dataArray || !this.onAmplitudeChange) {
      return
    }

    const analyze = () => {
      if (!this.analyser || !this.dataArray || !this.onAmplitudeChange) {
        this.animationFrameId = null
        return
      }

      this.onAmplitudeChange(readFrequencyData(this.analyser, this.dataArray))
      this.animationFrameId = window.requestAnimationFrame(analyze)
    }

    this.animationFrameId = window.requestAnimationFrame(analyze)
  }

  private stopAnalysis() {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  stop() {
    this.stopAnalysis()
    this.onAmplitudeChange?.(ZERO_FREQUENCY_DATA)
    this.workletNode?.disconnect();
    this.analyser?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach(track => track.stop());
    this.context?.close();
    
    this.stream = null;
    this.source = null;
    this.workletNode = null;
    this.analyser = null;
    this.dataArray = null;
    this.context = null;
  }
}

export class AudioPlaybackManager {
  private context: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private animationFrameId: number | null = null;
  private onPlaybackStateChange: PlaybackStateCallback | null = null;
  private onOutputAmplitudeChange: AmplitudeCallback | null = null;

  setOnOutputAmplitudeChange(callback: AmplitudeCallback | null) {
    this.onOutputAmplitudeChange = callback;
    if (!callback) {
      this.stopOutputAnalysis()
      return
    }

    if (this.context && this.analyser && this.dataArray && this.animationFrameId === null) {
      this.startOutputAnalysis()
    }
  }

  async initialize() {
    if (this.context && this.workletNode) {
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
      if (this.onOutputAmplitudeChange && this.animationFrameId === null) {
        this.startOutputAnalysis()
      }
      return;
    }

    this.context = new AudioContext({ sampleRate: 24000 });
    await this.context.audioWorklet.addModule(resolveWorkletModuleUrl('audio-processors/playback.worklet.js'));
    
    this.workletNode = new AudioWorkletNode(this.context, 'playback-worklet');
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.45;
    this.dataArray = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount))
    this.gainNode = this.context.createGain()
    this.workletNode.port.onmessage = (event) => {
      if (event.data?.type === 'playback-state') {
        this.onPlaybackStateChange?.(Boolean(event.data.isPlaying))
      }
    }
    this.workletNode.connect(this.analyser);
    this.analyser.connect(this.gainNode);
    this.gainNode.connect(this.context.destination);

    if (this.onOutputAmplitudeChange) {
      this.startOutputAnalysis()
    }
  }

  setOnPlaybackStateChange(callback: PlaybackStateCallback | null) {
    this.onPlaybackStateChange = callback;
  }

  private startOutputAnalysis() {
    if (!this.analyser || !this.dataArray || !this.onOutputAmplitudeChange) {
      return
    }

    const analyze = () => {
      if (!this.analyser || !this.dataArray || !this.onOutputAmplitudeChange) {
        this.animationFrameId = null
        return
      }

      this.onOutputAmplitudeChange(readFrequencyData(this.analyser, this.dataArray))
      this.animationFrameId = window.requestAnimationFrame(analyze)
    }

    this.animationFrameId = window.requestAnimationFrame(analyze)
  }

  private stopOutputAnalysis() {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  async playBase64Wav(base64Data: string) {
    if (!base64Data) return
    await this.initialize()

    if (!this.context || !this.analyser) return

    const binary = atob(base64Data)
    const len = binary.length
    const bytes = new Uint8Array(len)
    for (let index = 0; index < len; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }

    const audioBuffer = await this.context.decodeAudioData(bytes.buffer.slice(0))
    const source = this.context.createBufferSource()
    source.buffer = audioBuffer
    source.connect(this.analyser)
    this.onPlaybackStateChange?.(true)
    source.onended = () => {
      this.onPlaybackStateChange?.(false)
      source.disconnect()
    }
    source.start()
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
    this.onPlaybackStateChange?.(false)
    this.onOutputAmplitudeChange?.(ZERO_FREQUENCY_DATA)
  }

  stop() {
    this.stopOutputAnalysis()
    this.clear();
    this.workletNode?.disconnect();
    this.analyser?.disconnect();
    this.gainNode?.disconnect();
    this.context?.close();
    this.context = null;
    this.workletNode = null;
    this.analyser = null;
    this.gainNode = null;
    this.dataArray = null;
  }
}
