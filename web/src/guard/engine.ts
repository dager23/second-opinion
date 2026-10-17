import {
  getLiveGenerativeModel,
  getGenerativeModel,
  ResponseModality,
  Schema,
  ThinkingLevel,
  type LiveSession,
} from 'firebase/ai'
import { ai, MODELS } from '../firebase'
import { prompts, SIGNAL_IDS, SCAM_IDS, type Alert, type Level } from '../shared'
import { toBase64 } from '../audio/capture'

export interface EngineEvents {
  onTranscript: (text: string, final: boolean) => void
  onAlert: (a: Alert) => void
  onStatus: (s: string) => void
  onError: (e: Error) => void
}

export interface Engine {
  mode: 'live' | 'chunk'
  pushPcm: (pcm: ArrayBuffer) => void
  stop: () => void
}

const LEVELS = ['calm', 'caution', 'warning', 'stop']

const alertSchemaProps = {
  level: Schema.enumString({ enum: LEVELS }),
  scam_type: Schema.enumString({ enum: SCAM_IDS }),
  signals: Schema.array({
    items: Schema.object({
      properties: {
        id: Schema.enumString({ enum: SIGNAL_IDS }),
        quote: Schema.string({ description: 'Exact words heard, original language' }),
      },
    }),
  }),
  whisper_en: Schema.string({ description: 'One or two calm sentences in English' }),
  whisper_hi: Schema.string({ description: 'Same warning in Hindi (Devanagari)' }),
}

/* ---------- Mode A: Live API ---------- */
export async function startLiveEngine(ev: EngineEvents): Promise<Engine> {
  const model = getLiveGenerativeModel(ai, {
    model: MODELS.live,
    generationConfig: {
      responseModalities: [ResponseModality.AUDIO],
      inputAudioTranscription: {},
      contextWindowCompression: { slidingWindow: {} },
    },
    systemInstruction: prompts.guard_system,
    tools: [
      {
        functionDeclarations: [
          {
            name: 'raise_alert',
            description:
              'Raise or escalate a scam alert. Call whenever the risk level increases or a new strong signal appears.',
            parameters: Schema.object({ properties: alertSchemaProps }),
          },
        ],
      },
    ],
  })
  ev.onStatus('Connecting to Gemini Live…')
  const session: LiveSession = await model.connect()
  ev.onStatus('Listening (Gemini Live)')
  let closed = false

  void (async () => {
    try {
      for await (const msg of session.receive()) {
        if (closed) break
        if (import.meta.env.DEV) console.debug('[live]', JSON.stringify(msg).slice(0, 400))
        if (msg.type === 'serverContent') {
          const t = msg.inputTranscription?.text
          if (t) ev.onTranscript(t, false)
        } else if (msg.type === 'toolCall') {
          const responses = []
          for (const fc of msg.functionCalls) {
            if (fc.name === 'raise_alert') {
              const a = normalizeAlert(fc.args as Record<string, unknown>)
              ev.onAlert(a)
            }
            responses.push({ id: fc.id, name: fc.name, response: { ok: true } })
          }
          await session.sendFunctionResponses(responses)
        } else if (msg.type === 'goingAwayNotice') {
          ev.onStatus('Session ending soon, resuming…')
        }
      }
    } catch (e) {
      if (!closed) ev.onError(e as Error)
    }
  })()

  return {
    mode: 'live',
    pushPcm: (pcm) => {
      if (closed || session.isClosed) return
      session
        .sendAudioRealtime({ mimeType: 'audio/pcm;rate=16000', data: toBase64(pcm) })
        .catch((e) => !closed && ev.onError(e as Error))
    },
    stop: () => {
      closed = true
      void session.close().catch(() => {})
    },
  }
}

/* ---------- Mode B: chunked classification ---------- */
const chunkSchema = Schema.object({
  properties: {
    transcript: Schema.string(),
    ...alertSchemaProps,
  },
})

function pcmToWav(chunks: ArrayBuffer[]): ArrayBuffer {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0)
  const wav = new ArrayBuffer(44 + total)
  const v = new DataView(wav)
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF')
  v.setUint32(4, 36 + total, true)
  w(8, 'WAVE')
  w(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, 16000, true)
  v.setUint32(28, 32000, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  w(36, 'data')
  v.setUint32(40, total, true)
  let off = 44
  for (const c of chunks) {
    new Uint8Array(wav, off).set(new Uint8Array(c))
    off += c.byteLength
  }
  return wav
}

export function startChunkEngine(ev: EngineEvents, windowMs = 8000): Engine {
  const model = getGenerativeModel(ai, {
    model: MODELS.lite,
    systemInstruction: prompts.chunk_classifier,
    generationConfig: { responseMimeType: 'application/json', responseSchema: chunkSchema, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
  })
  let buf: ArrayBuffer[] = []
  let bytes = 0
  let summary = ''
  let busy = false
  let closed = false
  const need = (windowMs / 1000) * 32000
  ev.onStatus('Listening (chunked mode)')

  async function flush() {
    if (busy || closed || bytes < need) return
    busy = true
    const chunks = buf
    buf = []
    bytes = 0
    try {
      const wav = pcmToWav(chunks)
      const res = await model.generateContent([
        { type: 'text', text: `Running summary of the call so far: ${summary || '(start of call)'}` },
        { type: 'inlineData', inlineData: { mimeType: 'audio/wav', data: toBase64(wav) } },
      ])
      const j = JSON.parse(res.response.text())
      if (j.transcript) {
        ev.onTranscript(j.transcript + ' ', true)
        summary = (summary + ' ' + j.transcript).slice(-1500)
      }
      if (j.level && j.level !== 'calm') ev.onAlert(normalizeAlert(j))
      else ev.onAlert({ level: 'calm', scam_type: 'none', signals: [], whisper_en: '', whisper_hi: '' })
    } catch (e) {
      if (!closed) ev.onError(e as Error)
    } finally {
      busy = false
    }
  }

  return {
    mode: 'chunk',
    pushPcm: (pcm) => {
      buf.push(pcm)
      bytes += pcm.byteLength
      void flush()
    },
    stop: () => {
      closed = true
    },
  }
}

export function normalizeAlert(a: Record<string, unknown>): Alert {
  const lvl = String(a.level ?? 'caution').toLowerCase()
  const level = (LEVELS.includes(lvl) ? lvl : 'caution') as Level
  const sigs = Array.isArray(a.signals) ? a.signals : []
  return {
    level,
    scam_type: String(a.scam_type ?? 'none'),
    signals: sigs
      .map((s) => ({ id: String((s as Record<string, unknown>).id ?? ''), quote: String((s as Record<string, unknown>).quote ?? '') }))
      .filter((s) => s.id),
    whisper_en: String(a.whisper_en ?? ''),
    whisper_hi: String(a.whisper_hi ?? ''),
  }
}
