import { getGenerativeModel, Schema, ThinkingLevel, type FunctionCall } from 'firebase/ai'
import { ai, MODELS } from '../firebase'
import { advisoryFor, helplines, prompts, SCAM_IDS, SCAM_LABEL, type Alert } from '../shared'
import { updateSession, type Report } from '../store'

export interface CaseContext {
  code: string
  transcript: string
  alert: Alert
  lang: 'en' | 'hi'
}

export interface AgentStep {
  tool: string
  detail: string
}

const tools = [
  {
    functionDeclarations: [
      {
        name: 'check_official_advisory',
        description: 'Look up the official advisory for a scam type.',
        parameters: Schema.object({
          properties: { scam_type: Schema.enumString({ enum: SCAM_IDS }) },
        }),
      },
      {
        name: 'notify_guardian',
        description: 'Send a short plain-language summary to the family guardian.',
        parameters: Schema.object({ properties: { summary: Schema.string() } }),
      },
      {
        name: 'request_cooloff_hold',
        description:
          'Ask the (mock) bank to place a 2-hour cool-off hold on outgoing transfers, pending guardian approval. Use when any payment/OTP/transfer was requested.',
        parameters: Schema.object({ properties: { reason: Schema.string() } }),
      },
      {
        name: 'draft_report',
        description: 'Draft a complaint for the national cybercrime helpline 1930 / cybercrime.gov.in.',
        parameters: Schema.object({
          properties: {
            category: Schema.string(),
            summary: Schema.string(),
            caller_claims: Schema.string(),
            timeline: Schema.array({ items: Schema.string() }),
            quotes: Schema.array({ items: Schema.string() }),
            money_requested: Schema.string({ description: 'Amount or "none stated"' }),
          },
        }),
      },
    ],
  },
]

export async function runCaseAgent(
  ctx: CaseContext,
  onStep: (s: AgentStep) => void,
): Promise<{ closing: string; report: Report | null }> {
  const model = getGenerativeModel(ai, {
    model: MODELS.flash,
    systemInstruction: prompts.case_agent,
    generationConfig: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
    tools,
  })
  const chat = model.startChat()
  const brief = [
    `Detected level: ${ctx.alert.level}. Scam type: ${ctx.alert.scam_type}.`,
    `Signals: ${ctx.alert.signals.map((s) => `${s.id}: "${s.quote}"`).join(' | ')}`,
    `Transcript so far:\n${ctx.transcript.slice(-3500)}`,
  ].join('\n')

  let report: Report | null = null
  const actions: string[] = []
  let result = await chat.sendMessage(brief)

  for (let round = 0; round < 4; round++) {
    const calls: FunctionCall[] = result.response.functionCalls() ?? []
    if (!calls.length) break
    const responses = []
    for (const fc of calls) {
      const args = (fc.args ?? {}) as Record<string, unknown>
      let out: object = { ok: true }
      if (fc.name === 'check_official_advisory') {
        const a = advisoryFor(String(args.scam_type))
        onStep({ tool: 'check_official_advisory', detail: a.title })
        out = { title: a.title, text: a.text, action: a.action, sources: a.sources }
      } else if (fc.name === 'notify_guardian') {
        const summary = String(args.summary ?? '')
        await updateSession(ctx.code, {
          guardianSummary: summary,
          level: ctx.alert.level,
          scamType: ctx.alert.scam_type,
        })
        actions.push('Guardian notified')
        onStep({ tool: 'notify_guardian', detail: summary })
      } else if (fc.name === 'request_cooloff_hold') {
        const reason = String(args.reason ?? 'Possible scam payment request')
        await updateSession(ctx.code, { holdStatus: 'requested', holdReason: reason })
        actions.push('Cool-off hold requested (awaiting guardian approval)')
        onStep({ tool: 'request_cooloff_hold', detail: reason })
        out = { status: 'requested', note: 'Mock bank API: hold pending guardian approval' }
      } else if (fc.name === 'draft_report') {
        report = {
          category: String(args.category ?? SCAM_LABEL[ctx.alert.scam_type] ?? 'Cyber fraud'),
          summary: String(args.summary ?? ''),
          caller_claims: String(args.caller_claims ?? ''),
          timeline: (args.timeline as string[]) ?? [],
          quotes: (args.quotes as string[]) ?? ctx.alert.signals.map((s) => s.quote),
          money_requested: String(args.money_requested ?? 'none stated'),
          actions_taken: actions,
        }
        await updateSession(ctx.code, { report })
        onStep({ tool: 'draft_report', detail: `Complaint draft for ${helplines.IN.phone} / ${helplines.IN.web}` })
        out = { ok: true }
      }
      responses.push({ type: 'functionResponse' as const, functionResponse: { name: fc.name, response: out } })
    }
    result = await chat.sendMessage(responses)
  }
  return { closing: result.response.text(), report }
}
