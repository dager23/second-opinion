import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { decideHold, watchAlerts, watchSession, type AlertDoc, type SessionDoc } from '../store'
import { LEVEL_META, ReportView, RiskMeter } from '../components'
import { SCAM_LABEL, SIGNAL_LABEL } from '../shared'
import { ensureUser, firebaseConfigured } from '../firebase'

export default function Guardian() {
  const { code: param } = useParams()
  const nav = useNavigate()
  const [input, setInput] = useState('')
  const code = (param ?? '').toUpperCase()
  const [sess, setSess] = useState<SessionDoc | null | undefined>(undefined)
  const [alerts, setAlerts] = useState<AlertDoc[]>([])

  useEffect(() => {
    if (!code || !firebaseConfigured) return
    let offS = () => {}
    let offA = () => {}
    ensureUser().then(() => {
      offS = watchSession(code, (s) => setSess(s))
      offA = watchAlerts(code, setAlerts)
    })
    return () => {
      offS()
      offA()
    }
  }, [code])

  if (!code)
    return (
      <div className="card mx-auto max-w-md p-6">
        <h1 className="text-xl font-bold">Family guardian</h1>
        <p className="mt-1 text-sm">Enter the 6-character pairing code shown on your family member’s screen.</p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (input.trim().length === 6) nav(`/guardian/${input.trim().toUpperCase()}`)
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={6}
            aria-label="Pairing code"
            className="flex-1 rounded-lg border border-[#cfc9b6] p-3 font-mono text-xl uppercase tracking-widest"
          />
          <button className="btn btn-primary">Connect</button>
        </form>
      </div>
    )

  if (sess === undefined) return <p>Connecting…</p>
  if (sess === null) return <p role="alert">No active session for code {code}.</p>

  const meta = LEVEL_META[sess.level]
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <section className={`rounded-2xl p-5 text-white ${meta.bg} ${sess.level === 'stop' ? 'pulse' : ''}`} aria-live="assertive">
        <div className="text-sm opacity-90">Guardian view · session {code}</div>
        <div className="text-4xl font-extrabold">{meta.label}</div>
        {sess.scamType !== 'none' && <div className="mt-1 font-semibold">{SCAM_LABEL[sess.scamType]}</div>}
        <div className="mt-3">
          <RiskMeter level={sess.level} />
        </div>
        <p className="mt-3 text-lg">{sess.guardianSummary || meta.text}</p>
      </section>

      {sess.holdStatus !== 'none' && (
        <section className="card p-4" aria-label="Cool-off hold">
          <h2 className="font-bold">Cool-off hold request</h2>
          <p className="text-sm">{sess.holdReason}</p>
          <p className="mt-1 text-sm">
            Status: <b>{sess.holdStatus}</b> (mock bank API: a real deployment would pause outgoing transfers for 2 hours).
          </p>
          {sess.holdStatus === 'requested' && (
            <div className="mt-3 flex gap-2">
              <button className="btn btn-primary flex-1" onClick={() => decideHold(code, 'approved')}>
                Approve hold
              </button>
              <button className="btn btn-ghost flex-1" onClick={() => decideHold(code, 'declined')}>
                Decline
              </button>
            </div>
          )}
          <p className="mt-3 text-sm font-semibold">Call them now and ask them to hang up.</p>
        </section>
      )}

      <section className="card p-4" aria-label="Timeline">
        <h2 className="font-bold">What was heard</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {alerts.length === 0 && <li className="text-ink/60">No alerts yet.</li>}
          {alerts.flatMap((a, i) =>
            a.signals.map((x, j) => (
              <li key={`${i}-${j}`} className="rounded-lg border border-[#e3dfd2] p-2">
                <span className="chip">{SIGNAL_LABEL[x.id] ?? x.id}</span>
                <q className="mt-1 block italic">{x.quote}</q>
              </li>
            )),
          )}
        </ul>
      </section>
      {sess.report && <ReportView r={sess.report} />}
    </div>
  )
}
