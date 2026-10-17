export type SourceKind = 'mic' | 'tab' | 'demo'

export interface Capture {
  kind: SourceKind
  stop: () => void
  /** Resolves when a demo file finishes playing (never for mic/tab) */
  ended: Promise<void>
  videoTrack?: MediaStreamTrack
  /** grab a JPEG still (base64, no prefix) from the shared tab video, if any */
  grabFrame?: () => Promise<string | null>
  /** 16 kHz PCM16 chunks (~100 ms) */
  onPcm: (cb: (pcm: ArrayBuffer) => void) => void
}

export function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(bin)
}

async function makePipeline(ctx: AudioContext, node: AudioNode) {
  await ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}pcm-worklet.js`)
  const worklet = new AudioWorkletNode(ctx, 'pcm-worklet', { numberOfOutputs: 0 })
  node.connect(worklet)
  let cb: (pcm: ArrayBuffer) => void = () => {}
  worklet.port.onmessage = (e) => cb(e.data as ArrayBuffer)
  return {
    set: (f: (pcm: ArrayBuffer) => void) => (cb = f),
    close: () => {
      try {
        node.disconnect()
        worklet.disconnect()
      } catch {
        /* ignore */
      }
    },
  }
}

export async function startMic(): Promise<Capture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true },
  })
  const ctx = new AudioContext()
  const src = ctx.createMediaStreamSource(stream)
  const p = await makePipeline(ctx, src)
  return {
    kind: 'mic',
    ended: new Promise(() => {}),
    onPcm: p.set,
    stop: () => {
      p.close()
      stream.getTracks().forEach((t) => t.stop())
      void ctx.close()
    },
  }
}

export async function startTab(): Promise<Capture> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 2 },
    audio: true,
  })
  if (stream.getAudioTracks().length === 0) {
    stream.getTracks().forEach((t) => t.stop())
    throw new Error('No tab audio shared. Choose a Chrome tab and tick "Also share tab audio".')
  }
  const ctx = new AudioContext()
  const src = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()))
  const p = await makePipeline(ctx, src)
  const videoTrack = stream.getVideoTracks()[0]
  const video = document.createElement('video')
  video.muted = true
  video.srcObject = new MediaStream([videoTrack])
  await video.play().catch(() => {})
  const grabFrame = async () => {
    if (!video.videoWidth) return null
    const c = document.createElement('canvas')
    const scale = Math.min(1, 768 / video.videoWidth)
    c.width = Math.round(video.videoWidth * scale)
    c.height = Math.round(video.videoHeight * scale)
    c.getContext('2d')!.drawImage(video, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.7).split(',')[1]
  }
  let stopFn = () => {}
  const ended = new Promise<void>((res) => {
    videoTrack.addEventListener('ended', () => res())
    stopFn = res
  })
  return {
    kind: 'tab',
    ended,
    videoTrack,
    grabFrame,
    onPcm: p.set,
    stop: () => {
      p.close()
      stream.getTracks().forEach((t) => t.stop())
      void ctx.close()
      stopFn()
    },
  }
}

export async function startDemo(url: string): Promise<Capture> {
  const ctx = new AudioContext()
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Demo audio not found: ${url}`)
  const buf = await ctx.decodeAudioData(await res.arrayBuffer())
  const src = ctx.createBufferSource()
  src.buffer = buf
  const p = await makePipeline(ctx, src)
  src.connect(ctx.destination) // so the room can hear the "caller"
  const ended = new Promise<void>((resolve) => (src.onended = () => resolve()))
  src.start()
  return {
    kind: 'demo',
    ended,
    onPcm: p.set,
    stop: () => {
      try {
        src.stop()
      } catch {
        /* already stopped */
      }
      p.close()
      void ctx.close()
    },
  }
}
