import { useEffect, useState } from 'react'

interface EvalRow {
  id: string
  kind: string
  detected: boolean
  level: string
  first_warning_s: number | null
}
interface EvalResult {
  model: string
  detection_rate: number
  false_alarm_rate: number
  median_seconds_to_first_warning: number | null
  scam_calls: number
  genuine_calls: number
  rows: EvalRow[]
}

export default function About() {
  const [ev, setEv] = useState<EvalResult | null>(null)
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}eval-results.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setEv)
      .catch(() => {})
  }, [])
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-extrabold">How Second Opinion works</h1>
      <section className="card space-y-2 p-4">
        <h2 className="text-xl font-bold">Pipeline</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Call audio (speakerphone, a shared Google Meet tab, or a demo call) is streamed from the browser as 16 kHz audio.</li>
          <li>
            <b>Gemini Live</b> (<code>gemini-3.8-live</code> via Firebase AI Logic) listens and transcribes. It reasons about the <i>coercion state</i> of the
            conversation and calls a <code>raise_alert</code> tool with the signals it heard and the exact quotes. If Live is unavailable the app falls back to
            chunked analysis with Gemini Flash.
          </li>
          <li>On a warning, a <b>Case Agent</b> (Gemini Flash with function calling) checks a curated official-advisory library, alerts the guardian, requests a cool-off hold and drafts the cybercrime complaint.</li>
          <li>For Google Meet, a periodic video frame is checked for staged-authority visual cues (uniform, fake warrant). These are cues, never a deepfake verdict.</li>
          <li>The <b>Scam Check</b> tool analyses screenshots, audio files, pasted text or questions with multimodal Gemini and a structured verdict.</li>
        </ol>
        <p className="text-sm text-ink/80">Hosted on Firebase (Hosting, Auth, Firestore, App Check) with Gemini via Firebase AI Logic.</p>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="text-xl font-bold">Keeping it honest</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Every signal is shown with the exact words that triggered it.</li>
          <li>Advice is grounded in official advisories (I4C, RBI, Sanchar Saathi), with links.</li>
          <li>The guardian approves any hold. Nothing is filed automatically.</li>
          <li>Genuine calls are tested too, so we track false alarms, not only detections.</li>
        </ul>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="text-xl font-bold">Privacy</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Raw audio and video are never stored. Only the risk level, signal names, short quotes and the complaint draft are saved so your guardian can help.</li>
          <li>Sessions use anonymous sign-in and a random 6-character pairing code.</li>
          <li>
            This prototype uses the Gemini Developer API free tier, where Google may use content to improve its products. A production deployment would use a paid tier
            or Vertex AI with data-use controls. Do not enter real personal data in this demo.
          </li>
        </ul>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="text-xl font-bold">Evaluation</h2>
        {ev ? (
          <>
            <p className="text-sm">
              Scripted calls run through the shipped classifier prompt ({ev.model}): <b>{Math.round(ev.detection_rate * 100)}%</b> of {ev.scam_calls} scam calls detected,{' '}
              <b>{Math.round(ev.false_alarm_rate * 100)}%</b> false alarms on {ev.genuine_calls} genuine calls
              {ev.median_seconds_to_first_warning != null && <>, median <b>{ev.median_seconds_to_first_warning}s</b> to first warning</>}.
            </p>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-1">Call</th>
                  <th>Type</th>
                  <th>Result</th>
                  <th>First warning</th>
                </tr>
              </thead>
              <tbody>
                {ev.rows.map((r) => (
                  <tr key={r.id} className="border-b border-[#eee]">
                    <td className="py-1">{r.id}</td>
                    <td>{r.kind}</td>
                    <td>{r.level} {r.kind === 'scam' ? (r.detected ? '✓' : '✗') : r.detected ? '✗ false alarm' : '✓'}</td>
                    <td>{r.first_warning_s != null ? `${r.first_warning_s}s` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-ink/70">Small scripted set generated for this prototype; indicative, not a field trial.</p>
          </>
        ) : (
          <p className="text-sm text-ink/70">Evaluation results not published yet.</p>
        )}
      </section>
    </div>
  )
}
