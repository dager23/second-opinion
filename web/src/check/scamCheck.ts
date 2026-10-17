import { getGenerativeModel, Schema, ThinkingLevel, type Part } from 'firebase/ai'
import { ai, MODELS } from '../firebase'
import { TIMEOUT, withFallback } from '../aiModels'
import { advisoryFor, helplines, prompts, SCAM_IDS, taxonomy, type Profile } from '../shared'

export interface Verdict {
  verdict: 'likely_scam' | 'suspicious' | 'likely_safe' | 'unclear'
  risk: number
  scam_type: string
  headline: string
  explanation: string
  red_flags: { flag: string; evidence: string }[]
  next_steps: string[]
  safe_reply: string | null
  disclaimer: string
}

const verdictSchema = Schema.object({
  properties: {
    verdict: Schema.enumString({ enum: ['likely_scam', 'suspicious', 'likely_safe', 'unclear'] }),
    risk: Schema.integer({ description: '0-100' }),
    scam_type: Schema.enumString({ enum: SCAM_IDS }),
    headline: Schema.string(),
    explanation: Schema.string(),
    red_flags: Schema.array({
      items: Schema.object({ properties: { flag: Schema.string(), evidence: Schema.string() } }),
    }),
    next_steps: Schema.array({ items: Schema.string() }),
    safe_reply: Schema.string({ nullable: true }),
    disclaimer: Schema.string(),
  },
})

export interface CheckInput {
  text: string
  files: File[]
  profile: Profile
  simple: boolean
  lang: 'en' | 'hi'
}

const EXT_MIME: Record<string, string> = {
  opus: 'audio/ogg', ogg: 'audio/ogg', oga: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', mp3: 'audio/mpeg',
  wav: 'audio/wav', amr: 'audio/amr', flac: 'audio/flac', webm: 'audio/webm',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', gif: 'image/gif',
}

/** Browsers often report '' or 'audio/opus' for WhatsApp voice notes; Gemini wants a standard container type. */
export function mimeOf(f: File): string {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  if (EXT_MIME[ext] && (!f.type || f.type === 'audio/opus' || f.type === 'application/octet-stream')) return EXT_MIME[ext]
  return f.type || EXT_MIME[ext] || ''
}

async function fileToPart(f: File): Promise<Part> {
  const buf = await f.arrayBuffer()
  let bin = ''
  const b = new Uint8Array(buf)
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return { type: 'inlineData', inlineData: { mimeType: mimeOf(f), data: btoa(bin) } }
}

export const MAX_FILE_BYTES = 12 * 1024 * 1024
/** inline request limit is ~20 MB after base64 (+33%) */
export const MAX_TOTAL_BYTES = 14 * 1024 * 1024

export async function runScamCheck(inp: CheckInput): Promise<Verdict> {
  const modelFor = (name: string) =>
    getGenerativeModel(ai, {
      model: name,
      systemInstruction: prompts.scam_check,
      generationConfig: { responseMimeType: 'application/json', responseSchema: verdictSchema, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
    }, { timeout: TIMEOUT.check })
  const profileTone = (taxonomy.profiles as Record<string, string>)[inp.profile]
  const parts: Part[] = [
    {
      type: 'text',
      text: [
        `Audience: ${profileTone}.`,
        inp.simple ? 'Use very simple words (explain like I am 70).' : '',
        `Respond in ${inp.lang === 'hi' ? 'Hindi (Devanagari) for headline, explanation, next_steps, safe_reply; keep evidence quotes in their original language' : 'English'}.`,
        `Helplines: India ${helplines.IN.phone} / ${helplines.IN.web}; Singapore ${helplines.SG.phone}; Japan ${helplines.JP.phone}; Australia ${helplines.AU.web}.`,
        `Scam types you may choose from: ${taxonomy.scam_types.map((s) => s.id).join(', ')}.`,
        inp.text ? `User's message / question / pasted text:\n${inp.text}` : 'The user attached material only.',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ]
  for (const f of inp.files) parts.push(await fileToPart(f))
  const res = await withFallback([MODELS.flash, MODELS.flashAlt, MODELS.liteAlt], (m) => modelFor(m).generateContent(parts))
  const v = JSON.parse(res.response.text()) as Verdict
  v.risk = Math.max(0, Math.min(100, Number(v.risk) || 0))
  return v
}

export async function followUp(
  v: Verdict,
  history: { role: 'user' | 'model'; text: string }[],
  q: string,
  lang: 'en' | 'hi',
): Promise<string> {
  const adv = advisoryFor(v.scam_type)
  const replyLang = lang === 'hi' ? 'Hindi' : "the user's language"
  const system = `${prompts.chat}\nAnalysis: ${JSON.stringify(v)}\nOfficial advisory: ${adv.title}. ${adv.text} ${adv.action}\nReply in ${replyLang}.`
  const r = await withFallback([MODELS.flash, MODELS.flashAlt, MODELS.liteAlt], (m) =>
    getGenerativeModel(ai, { model: m, generationConfig: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }, systemInstruction: system }, { timeout: TIMEOUT.chat })
      .startChat({ history: history.map((h) => ({ role: h.role, parts: [{ type: 'text' as const, text: h.text }] })) })
      .sendMessage(q),
  )
  return r.response.text()
}
