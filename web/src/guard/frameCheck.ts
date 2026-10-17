import { getGenerativeModel, Schema, ThinkingLevel } from 'firebase/ai'
import { ai, MODELS } from '../firebase'
import { TIMEOUT, withFallback } from '../aiModels'
import { prompts } from '../shared'

export interface FrameCue {
  cue: string
  detail: string
}

const schema = Schema.object({
  properties: {
    cues: Schema.array({
      items: Schema.object({ properties: { cue: Schema.string(), detail: Schema.string() } }),
    }),
  },
})

export async function checkFrame(jpegBase64: string): Promise<FrameCue[]> {
  // Frame Check runs on the alternate Flash model so it never competes with the case agent's quota
  const res = await withFallback([MODELS.flashAlt, MODELS.flash], (m) =>
    getGenerativeModel(ai, {
      model: m,
      systemInstruction: prompts.frame_check,
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
    }, { timeout: TIMEOUT.frame }).generateContent([{ type: 'inlineData', inlineData: { mimeType: 'image/jpeg', data: jpegBase64 } }]),
  )
  return (JSON.parse(res.response.text()).cues ?? []) as FrameCue[]
}
