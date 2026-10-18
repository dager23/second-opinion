import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useApp } from '../ctx'
import { useGuard, type DemoItem } from '../guard/useGuard'
import { LEVEL_META, ReportView, RiskMeter } from '../components'
import { SCAM_LABEL, SIGNAL_LABEL, helplines } from '../shared'
import { firebaseConfigured } from '../firebase'
import { watchSession, decideHold, type SessionDoc } from '../store'

const fmt = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`

export default function Guard() {
  const { lang, profile } = useApp()
  const [live, setLive] = useState(false)
  const g = useGuard(profile, lang, live)
  const { s } = g
  const [demos, setDemos] = useState<DemoItem[]>([])
  const [demoId, setDemoId] = useState('')
  const [sess, setSess] = useState<SessionDoc | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}demo-calls/manifest.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((m: DemoItem[]) => {
        setDemos(m)
        setDemoId(m[0]?.id ?? '')
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!s.code || !firebaseConfigured) return
    return watchSession(s.code, setSess)
  }, [s.code])

  const demo = demos.find((d) => d.id === demoId)
  const meta = LEVEL_META[s.level]
  const whisper = lang === 'hi' ? s.whisper.hi || s.whisper.en : s.whisper.en
  const guardianUrl = s.code ? `${location.origin}/guardian/${s.code}` : ''
  const hold = sess?.holdStatus ?? 'none'
  const idle = !s.running && !s.finishing
  const active = s.running || s.finishing || s.level !== 'calm'

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <aside className="space-y-4">
        <section className="card p-4" aria-label="Start protection">
          <h1 className="text-xl font-bold">Protect a call</h1>
          <p className="mt-1 text-sm text-ink/80">
            Second Opinion listens to a suspicious call on speakerphone or Google Meet and warns you before money moves.
          </p>
          <div className="mt-3 grid gap-2">
            <button className="btn btn-primary" disabled={!idle || !firebaseConfigured} onClick={g.startMic}>
              🎙️ Listen on speakerphone
            </button>
            <button className="btn btn-primary" disabled={!idle || !firebaseConfigured} onClick={g.startTab}>
              🖥️ Listen to a Google Meet tab
            </button>
            <p className="text-xs text-ink/70">
              Meet: choose the Chrome tab and tick <b>“Also share tab audio”</b>.
            </p>
            <hr className="border-[#e3dfd2]" />
            <label className="text-sm font-semibold" htmlFor="demo">
              Demo call
            </label>
            <select
              id="demo"
              value={demoId}
              onChange={(e) => setDemoId(e.target.value)}
              className="rounded-lg border border-[#cfc9b6] bg-white p-2"
            >
              {demos.length === 0 && <option>No demo calls yet</option>}
              {demos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.kind === 'scam' ? '🚨' : '✅'} {d.title}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1" disabled={!idle || !demo || !firebaseConfigured} onClick={() => demo && g.startDemo(demo)}>
                ▶ Analyse live
              </button>
              <button className="btn btn-ghost flex-1" disabled={!idle || !demo?.replay} onClick={() => demo && g.startReplay(demo)}>
                ⏺ Recorded replay
              </button>
            </div>
            <p className="text-xs text-ink/70">
              <b>Analyse live</b> sends the demo call to Gemini in real time.
            </p>
            <label className="flex items-center gap-2 text-xs text-ink/80">
              <input type="checkbox" checked={live} disabled={!idle} onChange={(e) => setLive(e.target.checked)} />
              Use Gemini Live streaming (beta). Default: chunked analysis, which reacts every ~8 s.
            </label>
            {s.running && (
              <button className="btn btn-danger" onClick={g.stop} disabled={s.finishing}>
                ■ Stop
              </button>
            )}
            {s.finishing && <p className="text-sm font-semibold text-ink/80">Finishing the analysis and the final report…</p>}
          </div>
        </section>

        {s.code && (
          <section className="card p-4" aria-label="Family guardian">
            <h2 className="font-bold">Family guardian</h2>
            <p className="text-sm text-ink/80">A family member opens this on their phone to get alerts and approve a cool-off hold.</p>
            <div className="mt-2 flex items-center gap-3">
              <QRCodeSVG value={guardianUrl} size={92} />
              <div>
                <div className="text-xs text-ink/70">Pairing code</div>
                <div className="font-mono text-2xl font-bold tracking-widest">{s.code}</div>
                <a className="text-xs underline" href={guardianUrl} target="_blank" rel="noreferrer">
                  open guardian view
                </a>
              </div>
            </div>
          </section>
        )}

        <section className="card p-4 text-sm" aria-label="Privacy">
          <b>Private by design.</b> Raw audio is never stored. Only the risk level, the detected signals and short quotes are saved so your guardian
          can help.
        </section>
      </aside>

      <div className={`space-y-4 ${active ? 'order-first lg:order-none' : ''}`}>
        <section
          aria-live="assertive"
          className={`rounded-2xl p-5 text-white ${meta.bg} ${s.level === 'stop' ? 'pulse' : ''}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm opacity-90">
                {s.finishing ? 'Finishing…' : s.running ? `Listening ${fmt(s.elapsed)}` : s.status} {s.engine && `· ${s.engine === 'live' ? 'Gemini Live' : s.engine === 'chunk' ? 'chunked mode' : 'recorded replay'}`}
              </div>
              <div className="text-4xl font-extrabold">{lang === 'hi' ? meta.hi : meta.label}</div>
            </div>
            {s.scamType !== 'none' && <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">{SCAM_LABEL[s.scamType]}</span>}
          </div>
          <div className="mt-3">
            <RiskMeter level={s.level} />
          </div>
          <p className="mt-3 text-lg font-semibold">{whisper || meta.text}</p>
          {LEVEL_META[s.level] && (s.level === 'warning' || s.level === 'stop') && (
            <div className="mt-3 flex flex-wrap gap-2">
              <a className="btn bg-white text-ink" href={`tel:${helplines.IN.phone}`}>
                Hang up & call {helplines.IN.phone}
              </a>
              {sess?.guardianSummary && (
                <span className="rounded-lg bg-white/20 px-3 py-2 text-sm">Guardian alert sent (code {s.code})</span>
              )}
            </div>
          )}
        </section>

        {s.error && (
          <div role="alert" className="rounded-xl border border-caution bg-amber-50 p-3 text-sm">
            {s.error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <section className="card p-4" aria-label="Live transcript">
            <h2 className="font-bold">Live transcript</h2>
            <div className="mt-2 h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-[#faf9f4] p-3 text-sm" tabIndex={0}>
              {s.transcript || <span className="text-ink/50">Waiting for the call…</span>}
            </div>
          </section>
          <section className="card p-4" aria-label="Signals heard">
            <h2 className="font-bold">What it heard</h2>
            <ul className="mt-2 h-56 space-y-2 overflow-auto text-sm">
              {s.signals.length === 0 && <li className="text-ink/50">No signals yet.</li>}
              {s.signals.map((x, i) => (
                <li key={i} className="rounded-lg border border-[#e3dfd2] p-2">
                  <div className="flex items-center justify-between">
                    <span className="chip">{SIGNAL_LABEL[x.id] ?? x.id}</span>
                    <span className="text-xs text-ink/60">{fmt(x.t ?? 0)}</span>
                  </div>
                  <q className="mt-1 block italic">{x.quote}</q>
                </li>
              ))}
              {s.cues.map((c, i) => (
                <li key={`c${i}`} className="rounded-lg border border-dashed border-warning p-2">
                  <span className="chip">👁 Video cue</span> {c.cue}: {c.detail}
                </li>
              ))}
            </ul>
            {s.source === 'tab' && s.running && (
              <button className="btn btn-ghost mt-2" onClick={g.grabAndCheck}>
                Check video frame now
              </button>
            )}
          </section>
        </div>

        {(s.steps.length > 0 || hold !== 'none') && (
          <section className="card p-4" aria-label="Case agent actions">
            <h2 className="font-bold">Case agent</h2>
            <ol className="mt-2 space-y-1 text-sm">
              {s.steps.map((st, i) => (
                <li key={i}>
                  <span className="chip mr-2">{st.tool}</span>
                  {st.detail}
                </li>
              ))}
            </ol>
            {hold !== 'none' && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-[#faf9f4] p-3 text-sm">
                <b>Cool-off hold (mock bank):</b>
                <span className={`chip ${hold === 'approved' ? '!bg-green-100 !text-green-900' : hold === 'declined' ? '!bg-red-100 !text-red-900' : ''}`}>
                  {hold === 'requested' ? 'waiting for guardian approval' : hold}
                </span>
                {hold === 'requested' && s.code && (
                  <button className="btn btn-ghost ml-auto" onClick={() => decideHold(s.code, 'approved')} title="Demo shortcut: guardian normally approves from their phone">
                    Approve here (demo)
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {s.report && <ReportView r={s.report} />}

        {!s.running && s.transcript && import.meta.env.DEV && s.engine !== 'replay' && (
          <button className="btn btn-ghost" onClick={g.downloadReplay}>
            [dev] Download replay.json
          </button>
        )}
      </div>
    </div>
  )
}
