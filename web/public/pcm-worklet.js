// Downsamples mono input to 16 kHz PCM16 and posts ~100 ms chunks to the main thread.
class PcmWorklet extends AudioWorkletProcessor {
  constructor() {
    super()
    this.ratio = sampleRate / 16000
    this.pos = 0
    this.out = []
    this.prev = 0
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (!ch) return true
    const out = this.out
    while (this.pos < ch.length) {
      const i = Math.floor(this.pos)
      const frac = this.pos - i
      const a = i === 0 && frac === 0 ? ch[0] : ch[i]
      const b = i + 1 < ch.length ? ch[i + 1] : ch[i]
      const s = a + (b - a) * frac
      out.push(Math.max(-1, Math.min(1, s)))
      this.pos += this.ratio
    }
    this.pos -= ch.length
    if (out.length >= 1600) {
      const pcm = new Int16Array(out.length)
      for (let k = 0; k < out.length; k++) pcm[k] = out[k] < 0 ? out[k] * 0x8000 : out[k] * 0x7fff
      this.port.postMessage(pcm.buffer, [pcm.buffer])
      this.out = []
    }
    return true
  }
}
registerProcessor('pcm-worklet', PcmWorklet)
