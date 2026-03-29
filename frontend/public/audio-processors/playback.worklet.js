class PlaybackWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.currentBuffer = null;
    this.currentIndex = 0;
    this.isPlaying = false;
    
    this.port.onmessage = (event) => {
      if (event.data === 'clear') {
        this.queue = [];
        this.currentBuffer = null;
        this.currentIndex = 0;
        if (this.isPlaying) {
          this.isPlaying = false;
          this.port.postMessage({ type: 'playback-state', isPlaying: false });
        }
      } else if (event.data instanceof Float32Array) {
        this.queue.push(event.data);
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const channel = output[0];
    if (!channel) return true;

    if (this.queue.length > 0 && !this.isPlaying) {
      this.isPlaying = true;
      this.port.postMessage({ type: 'playback-state', isPlaying: true });
    }

    for (let i = 0; i < channel.length; i++) {
        if (!this.currentBuffer || this.currentIndex >= this.currentBuffer.length) {
            if (this.queue.length > 0) {
            this.currentBuffer = this.queue.shift();
            this.currentIndex = 0;
            } else {
            this.currentBuffer = null;
            }
        }

        if (this.currentBuffer) {
            channel[i] = this.currentBuffer[this.currentIndex++];
        } else {
            channel[i] = 0;
        }
    }

    if (!this.currentBuffer && this.queue.length === 0 && this.isPlaying) {
      this.isPlaying = false;
      this.port.postMessage({ type: 'playback-state', isPlaying: false });
    }
    
    return true;
  }
}

registerProcessor("playback-worklet", PlaybackWorklet);
