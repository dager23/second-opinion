import { useRef, useState } from 'react'
import { useApp } from '../ctx'
import { firebaseConfigured } from '../firebase'
import { followUp, MAX_FILE_BYTES, runScamCheck, type Verdict } from '../check/scamCheck'
import { SCAM_LABEL, advisoryFor, helplines } from '../shared'

const SAMPLES = [
  {
    label: 'Digital-arrest WhatsApp',
    text: 'This is Inspector Vikram Rathore, Mumbai Cyber Crime Branch. A parcel in your name contains illegal items and your Aadhaar is linked to money laundering. You are under digital arrest. Stay on this video call and do not tell anyone. Transfer ₹2,40,000 to the RBI verification account within 1 hour or you will be arrested.',
  },
  {
    label: 'Task job chat',
    text: 'Hi! Earn ₹3,000 daily by liking YouTube videos. Join our Telegram group. Complete 3 tasks free, then to unlock the VIP task pay a refundable deposit of ₹5,000. Guaranteed 40% profit!',
  },
  {
    label: 'Teen DM (sextortion)',
    text: "Hey it's Riya from school's Insta. Send me a pic and I'll send mine ;) ... [later] I recorded our video call. Pay ₹10,000 on UPI in 2 hours or I'll send it to all your followers and your parents.",
  },
  {
    label: 'Genuine bank SMS',
    text: 'HDFC Bank: Rs 1,250.00 debited from A/c XX1234 on 17-Oct at Swiggy. Not you? Call the number on the back of your card. Never share OTP/PIN with anyone.',
  },
]

const VERDICT_STYLE: Record<Verdict['verdict'], { label: string; cls: string }> = {
  likely_scam: { label: 'Likely a scam', cls: 'bg-stop' },
  suspicious: { label: 'Suspicious', cls: 'bg-warning' },
  unclear: { label: 'Unclear', cls: 'bg-caution' },
  likely_safe: { label: 'Likely safe', cls: 'bg-calm' },
}

export default function Check() {
  const { lang, profile } = useApp()
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [simple, setSimple] = useState(profile === 'senior')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [v, setV] = useState<Verdict | null>(null)
  const [chat, setChat] = useState<{ role: 'user' | 'model'; text: string }[]>([])
  const [q, setQ] = useState('')
  const [asking, setAsking] = useState(false)
  const dropRef = useRef<HTMLLabelElement>(null)

  function addFiles(list: FileList | File[]) {
    const ok: File[] = []
    for (const f of Array.from(list)) {
      if (!/^(image|audio)\//.test(f.type)) {
        setErr(`${f.name}: only images and audio files are supported.`)
        continue
      }
      if (f.size > MAX_FILE_BYTES) {
        setErr(`${f.name}: file is too large (max 12 MB).`)
        continue
      }
      ok.push(f)
    }
    setFiles((o) => [...o, ...ok].slice(0, 5))
  }

  async function analyse() {
    setBusy(true)
    setErr('')
    setV(null)
    setChat([])
    try {
      setV(await runScamCheck({ text, files, profile, simple, lang }))
    } catch (e) {
      setErr(`Could not analyse: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function ask() {
    if (!v || !q.trim()) return
    const question = q
    setQ('')
    setAsking(true)
    setChat((c) => [...c, { role: 'user', text: question }])
    try {
      const a = await followUp(v, chat, question, lang)
      setChat((c) => [...c, { role: 'model', text: a }])
    } catch (e) {
      setChat((c) => [...c, { role: 'model', text: `Sorry, something went wrong: ${(e as Error).message}` }])
    } finally {
      setAsking(false)
    }
  }

  const adv = v ? advisoryFor(v.scam_type) : null
  const canRun = firebaseConfigured && !busy && (text.trim() || files.length > 0)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card space-y-3 p-4">
        <h1 className="text-xl font-bold">Is this a scam?</h1>
        <p className="text-sm text-ink/80">
          Paste a message, upload screenshots of a chat, add a voice note or call recording, or just ask a question.
        </p>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button key={s.label} className="chip cursor-pointer" onClick={() => setText(s.text)}>
              {s.label}
            </button>
          ))}
        </div>
        <label htmlFor="msg" className="sr-only">
          Message or question
        </label>
        <textarea
          id="msg"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder="Paste the message, link text, or ask: “Someone called saying my SIM will be blocked. Is this real?”"
          className="w-full rounded-lg border border-[#cfc9b6] p-3"
        />
        <label
          ref={dropRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            addFiles(e.dataTransfer.files)
          }}
          className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-[#cfc9b6] p-4 text-center text-sm"
        >
          <span className="font-semibold">📎 Drop screenshots or audio here, or click to choose</span>
          <span className="text-xs text-ink/70">Images and audio (voice notes, call recordings), up to 5 files, 12 MB each</span>
          <input type="file" accept="image/*,audio/*" multiple className="sr-only" onChange={(e) => e.target.files && addFiles(e.target.files)} />
        </label>
        {files.length > 0 && (
          <ul className="flex flex-wrap gap-2 text-sm">
            {files.map((f, i) => (
              <li key={i} className="chip">
                {f.type.startsWith('audio') ? '🎧' : '🖼️'} {f.name}{' '}
                <button aria-label={`Remove ${f.name}`} onClick={() => setFiles((o) => o.filter((_, j) => j !== i))}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={simple} onChange={(e) => setSimple(e.target.checked)} /> Explain in very simple words
        </label>
        <button className="btn btn-primary w-full" disabled={!canRun} onClick={analyse}>
          {busy ? 'Checking…' : 'Check it'}
        </button>
        {err && (
          <p role="alert" className="text-sm text-stop">
            {err}
          </p>
        )}
      </section>

      <section aria-live="polite" className="space-y-4">
        {!v && !busy && <div className="card p-6 text-ink/60">Your result will appear here.</div>}
        {busy && <div className="card p-6">Looking for scam signals…</div>}
        {v && adv && (
          <>
            <div className={`rounded-2xl p-5 text-white ${VERDICT_STYLE[v.verdict].cls}`}>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-extrabold">{VERDICT_STYLE[v.verdict].label}</div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{v.risk}</div>
                  <div className="text-xs opacity-90">risk / 100</div>
                </div>
              </div>
              <p className="mt-2 text-lg font-semibold">{v.headline}</p>
              {v.scam_type !== 'none' && <span className="mt-2 inline-block rounded-full bg-white/20 px-3 py-1 text-sm">{SCAM_LABEL[v.scam_type]}</span>}
            </div>
            <div className="card space-y-3 p-4">
              <p>{v.explanation}</p>
              {v.red_flags.length > 0 && (
                <>
                  <h2 className="font-bold">Red flags</h2>
                  <ul className="space-y-2 text-sm">
                    {v.red_flags.map((r, i) => (
                      <li key={i} className="rounded-lg border border-[#e3dfd2] p-2">
                        <b>{r.flag}</b>
                        <q className="block italic text-ink/80">{r.evidence}</q>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <h2 className="font-bold">What to do now</h2>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {v.next_steps.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ol>
              {v.safe_reply && (
                <div className="rounded-lg bg-[#faf9f4] p-3 text-sm">
                  <b>Safe reply you can send:</b>
                  <p className="mt-1 italic">{v.safe_reply}</p>
                  <button className="btn btn-ghost mt-2" onClick={() => navigator.clipboard.writeText(v.safe_reply!)}>
                    Copy
                  </button>
                </div>
              )}
              <div className="rounded-lg border border-[#cfc9b6] p-3 text-sm">
                <b>Official advisory: {adv.title}</b>
                <p className="mt-1">{adv.text}</p>
                <ul className="mt-1 list-disc pl-5">
                  {adv.sources.map((s) => (
                    <li key={s.url}>
                      <a className="underline" href={s.url} target="_blank" rel="noreferrer">
                        {s.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-sm">
                Report: <b>{helplines.IN.phone}</b> · {helplines.IN.web}
              </p>
              <p className="text-xs text-ink/70">{v.disclaimer}</p>
            </div>
            <div className="card p-4">
              <h2 className="font-bold">Ask Second Opinion</h2>
              <div className="mt-2 max-h-60 space-y-2 overflow-auto text-sm">
                {chat.map((c, i) => (
                  <p key={i} className={c.role === 'user' ? 'text-right font-semibold' : 'rounded-lg bg-[#faf9f4] p-2'}>
                    {c.text}
                  </p>
                ))}
              </div>
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void ask()
                }}
              >
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Follow-up question"
                  placeholder="e.g. I already sent ₹5,000. What now?"
                  className="flex-1 rounded-lg border border-[#cfc9b6] p-2"
                />
                <button className="btn btn-primary" disabled={asking || !q.trim()}>
                  Ask
                </button>
              </form>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
