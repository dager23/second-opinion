import { getGenerativeModel, Schema, ThinkingLevel, type FunctionCall } from 'firebase/ai'
import { ai, MODELS } from '../firebase'
import { TIMEOUT, withFallback } from '../aiModels'
import { advisoryFor, helplines, prompts, SCAM_IDS, SCAM_LABEL, type Level, type Signal } from '../shared'
import { updateSession, type Report } from '../store'

export interface CaseContext {
  code: string
  transcript: string
  level: Level
  scamType: string
  /** every signal heard so far in the call, not just the latest alert */
  signals: Signal[]
  /** actions already taken deterministically by the app (guardian alert, hold) */
  actions: string[]
  isHoldRequested: () => boolean
  markHoldRequested: (reason: string) => void
}

export interface AgentStep {
  tool: string
  detail: string
}

const reportProps = {
  category: Schema.string(),
  summary: Schema.string(),
  caller_claims: Schema.string(),
  timeline: Schema.array({ items: Schema.string() }),
  quotes: Schema.array({ items: Schema.string() }),
  money_requested: Schema.string({ description: 'Amount or "none stated"' }),
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
        parameters: Schema.object({ properties: reportProps }),
      },
    ],
  },
]

function briefOf(ctx: CaseContext) {
  return [
    `Detected level: ${ctx.level}. Scam type: ${ctx.scamType} (${SCAM_LABEL[ctx.scamType] ?? 'unknown'}).`,
    `Signals heard so far: ${ctx.signals.map((s) => `${s.id}: "${s.quote}"`).join(' | ') || 'none'}`,
    `Actions already taken by the app: ${ctx.actions.join('; ') || 'none'}`,
    `Transcript:\n${ctx.transcript.slice(-6000)}`,
  ].join('\n')
}

function toReport(args: Record<string, unknown>, ctx: CaseContext): Report {
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])
  const quotes = arr(args.quotes)
  return {
    category: String(args.category || SCAM_LABEL[ctx.scamType] || 'Cyber fraud'),
    summary: String(args.summary ?? ''),
    caller_claims: String(args.caller_claims ?? ''),
    timeline: arr(args.timeline),
    quotes: quotes.length ? quotes : ctx.signals.map((s) => s.quote),
    money_requested: String(args.money_requested || 'none stated'),
    actions_taken: [...ctx.actions],
  }
}

/** Runs once when a call first reaches Warning: advisory, guardian summary, hold (idempotent), early report. */
export function runCaseAgent(ctx: CaseContext, onStep: (s: AgentStep) => void) {
  // tool side effects are idempotent (summary overwrite, hold guarded, report overwrite), so a whole-run retry on another model is safe
  return withFallback([MODELS.flash, MODELS.flashAlt], (m) => runCaseAgentOn(m, ctx, onStep))
}

async function runCaseAgentOn(
  modelName: string,
  ctx: CaseContext,
  onStep: (s: AgentStep) => void,
): Promise<{ closing: string; report: Report | null }> {
  const model = getGenerativeModel(ai, {
    model: modelName,
    systemInstruction: prompts.case_agent,
    generationConfig: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
    tools,
  }, { timeout: TIMEOUT.agent })
  const chat = model.startChat()
  let report: Report | null = null
  let result = await chat.sendMessage(briefOf(ctx))

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
        const summary = String(args.summary ?? '').trim()
        if (summary) {
          await updateSession(ctx.code, { guardianSummary: summary })
          onStep({ tool: 'notify_guardian', detail: summary })
        }
      } else if (fc.name === 'request_cooloff_hold') {
        if (ctx.isHoldRequested()) {
          out = { status: 'already requested' }
        } else {
          const reason = String(args.reason || 'Possible scam payment request')
          ctx.markHoldRequested(reason)
          await updateSession(ctx.code, { holdStatus: 'requested', holdReason: reason })
          onStep({ tool: 'request_cooloff_hold', detail: reason })
          out = { status: 'requested', note: 'Mock bank API: hold pending guardian approval' }
        }
      } else if (fc.name === 'draft_report') {
        report = toReport(args, ctx)
        await updateSession(ctx.code, { report })
        onStep({ tool: 'draft_report', detail: `Early complaint draft for ${helplines.IN.phone} / ${helplines.IN.web}` })
      }
      responses.push({ type: 'functionResponse' as const, functionResponse: { name: fc.name, response: out } })
    }
    result = await chat.sendMessage(responses)
  }
  let closing = ''
  try {
    closing = result.response.text()
  } catch {
    /* response had no text part */
  }
  return { closing, report }
}

/** One structured call at the end of a risky call, using the FULL transcript, so the report is not stuck at the mid-call snapshot. */
export async function draftFinalReport(ctx: CaseContext): Promise<Report> {
  // runs right after the case agent, so start on the alternate model to avoid that model's per-minute burst
  const res = await withFallback([MODELS.flashAlt, MODELS.flash, MODELS.liteAlt], (m) =>
    getGenerativeModel(ai, {
      model: m,
      systemInstruction: prompts.final_report,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: Schema.object({ properties: reportProps }),
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    }, { timeout: TIMEOUT.report }).generateContent(briefOf(ctx)),
  )
  return toReport(JSON.parse(res.response.text()), ctx)
}
