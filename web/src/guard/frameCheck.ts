import { getGenerativeModel, Schema, ThinkingLevel } from 'firebase/ai'
import { ai, MODELS } from '../firebase'
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
  const model = getGenerativeModel(ai, {
    model: MODELS.flash,
    systemInstruction: prompts.frame_check,
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
  })
  const res = await model.generateContent([{ type: 'inlineData', inlineData: { mimeType: 'image/jpeg', data: jpegBase64 } }])
  return (JSON.parse(res.response.text()).cues ?? []) as FrameCue[]
}
