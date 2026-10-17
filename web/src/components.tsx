import { useState } from 'react'
import type { Level } from './shared'
import { helplines } from './shared'
import type { Report } from './store'

export const LEVEL_META: Record<Level, { label: string; hi: string; bg: string; text: string }> = {
  calm: { label: 'Calm', hi: 'सब ठीक है', bg: 'bg-calm', text: 'No scam signals heard.' },
  caution: { label: 'Caution', hi: 'सावधान', bg: 'bg-caution', text: 'Something sounds unusual. Stay alert.' },
  warning: { label: 'Warning', hi: 'चेतावनी', bg: 'bg-warning', text: 'This looks like a scam. Do not send money or codes.' },
  stop: { label: 'STOP', hi: 'रुकिए!', bg: 'bg-stop', text: 'Very likely a scam. Hang up now.' },
}

export function RiskMeter({ level }: { level: Level }) {
  const order: Level[] = ['calm', 'caution', 'warning', 'stop']
  return (
    <div role="img" aria-label={`Risk level: ${LEVEL_META[level].label}`} className="flex gap-1">
      {order.map((l, i) => (
        <div
          key={l}
          className={`h-3 flex-1 rounded-full ${i <= order.indexOf(level) ? LEVEL_META[level].bg : 'bg-[#e3dfd2]'}`}
        />
      ))}
    </div>
  )
}

export function ReportView({ r }: { r: Report }) {
  const [copied, setCopied] = useState(false)
  const text = [
    `Complaint draft for ${helplines.IN.name} ${helplines.IN.phone} / ${helplines.IN.web}`,
    `Category: ${r.category}`,
    `Summary: ${r.summary}`,
    `Caller claimed: ${r.caller_claims}`,
    `Money requested: ${r.money_requested}`,
    `Timeline:\n${r.timeline.map((t, i) => `${i + 1}. ${t}`).join('\n')}`,
    `Key quotes:\n${r.quotes.map((q) => `- "${q}"`).join('\n')}`,
    `Actions taken: ${r.actions_taken.join('; ') || '—'}`,
  ].join('\n\n')
  return (
    <section aria-label="Complaint draft" className="card print-area p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Complaint draft (1930 / cybercrime.gov.in)</h3>
        <div className="flex gap-2 print:hidden">
          <button
            className="btn btn-ghost"
            onClick={() =>
              navigator.clipboard.writeText(text).then(() => {
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1500)
              })
            }
          >
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
          <button className="btn btn-ghost" onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
      </div>
      <dl className="mt-3 grid gap-2 text-sm md:grid-cols-[10rem_1fr]">
        <dt className="font-semibold">Category</dt>
        <dd>{r.category}</dd>
        <dt className="font-semibold">Summary</dt>
        <dd>{r.summary}</dd>
        <dt className="font-semibold">Caller claimed</dt>
        <dd>{r.caller_claims}</dd>
        <dt className="font-semibold">Money requested</dt>
        <dd>{r.money_requested}</dd>
        <dt className="font-semibold">Timeline</dt>
        <dd>
          <ol className="list-decimal pl-5">{r.timeline.map((t, i) => <li key={i}>{t}</li>)}</ol>
        </dd>
        <dt className="font-semibold">Key quotes</dt>
        <dd>
          <ul className="list-disc pl-5">{r.quotes.map((q, i) => <li key={i}>“{q}”</li>)}</ul>
        </dd>
        <dt className="font-semibold">Actions taken</dt>
        <dd>{r.actions_taken.join('; ') || '—'}</dd>
      </dl>
      <p className="mt-3 text-xs text-ink/70">
        Draft prepared by Second Opinion from the call. Please review before submitting. Nothing is filed automatically.
      </p>
    </section>
  )
}
