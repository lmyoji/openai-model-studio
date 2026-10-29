class StudioPCMRecorder extends AudioWorkletProcessor {
  constructor() {
    super(); this.buffer = new Int16Array(2048); this.offset = 0
    this.port.onmessage = event => {
      if (event.data?.type !== 'commit') return
      if (this.offset) { const tail = this.buffer.slice(0, this.offset); this.port.postMessage(tail.buffer, [tail.buffer]); this.offset = 0 }
      this.port.postMessage({ type: 'flushed' })
    }
  }
  process(inputs) {
    const samples = inputs[0]?.[0]
    if (samples) for (const sample of samples) {
      const value = Math.max(-1, Math.min(1, sample))
      this.buffer[this.offset++] = value < 0 ? value * 0x8000 : value * 0x7fff
      if (this.offset === this.buffer.length) { this.port.postMessage(this.buffer.buffer, [this.buffer.buffer]); this.buffer = new Int16Array(2048); this.offset = 0 }
    }
    return true
  }
}
registerProcessor('studio-pcm-recorder', StudioPCMRecorder)
