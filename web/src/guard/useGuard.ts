import { useCallback, useEffect, useRef, useState } from 'react'
import { firebaseConfigured } from '../firebase'
import { startMic, startTab, startDemo, type Capture, type SourceKind } from '../audio/capture'
import { startChunkEngine, startLiveEngine, type Engine } from './engine'
import { checkFrame, type FrameCue } from './frameCheck'
import { speak, stopSpeaking } from './whisper'
import { runCaseAgent, type AgentStep } from '../agent/caseAgent'
import { createSession, pushAlert, updateSession, type Report } from '../store'
import { LEVEL_RANK, type Alert, type Lang, type Level, type Profile, type Signal } from '../shared'

export interface DemoItem {
  id: string
  title: string
  lang: string
  kind: 'scam' | 'genuine'
  audio: string
  replay?: string
}

export interface ReplayEvent {
  t: number
  type: 'transcript' | 'alert' | 'step' | 'report' | 'frame'
  text?: string
  alert?: Alert
  step?: AgentStep
  report?: Report
  cue?: FrameCue
}

export interface GuardState {
  running: boolean
  status: string
  error: string
  engine: 'live' | 'chunk' | 'replay' | ''
  code: string
  transcript: string
  level: Level
  scamType: string
  signals: Signal[]
  whisper: { en: string; hi: string }
  steps: AgentStep[]
  report: Report | null
  cues: FrameCue[]
  elapsed: number
  source: SourceKind | 'replay' | ''
}

const initial: GuardState = {
  running: false,
  status: 'Ready',
  error: '',
  engine: '',
  code: '',
  transcript: '',
  level: 'calm',
  scamType: 'none',
  signals: [],
  whisper: { en: '', hi: '' },
  steps: [],
  report: null,
  cues: [],
  elapsed: 0,
  source: '',
}

export function useGuard(profile: Profile, lang: Lang, preferLive = false) {
  const [s, setS] = useState<GuardState>(initial)
  const sRef = useRef(s)
  sRef.current = s
  const capRef = useRef<Capture | null>(null)
  const engRef = useRef<Engine | null>(null)
  const t0 = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const frameTimer = useRef<number | undefined>(undefined)
  const agentRuns = useRef(0)
  const events = useRef<ReplayEvent[]>([])
  const replayTimers = useRef<number[]>([])
  const langRef = useRef(lang)
  langRef.current = lang
  const codeRef = useRef('')
  const preferLiveRef = useRef(preferLive)
  preferLiveRef.current = preferLive

  const patch = useCallback((p: Partial<GuardState>) => setS((o) => ({ ...o, ...p })), [])
  const rec = (e: Omit<ReplayEvent, 't'>) => events.current.push({ ...e, t: Date.now() - t0.current })

  const handleAlert = useCallback(
    (a: Alert, isReplay = false) => {
      const prev = sRef.current
      if (!isReplay) rec({ type: 'alert', alert: a })
      if (a.level === 'calm' && a.signals.length === 0) return
      const now = Math.round((Date.now() - t0.current) / 1000)
      const known = new Set(prev.signals.map((x) => `${x.id}|${x.quote}`))
      const newSigs = a.signals.filter((x) => !known.has(`${x.id}|${x.quote}`)).map((x) => ({ ...x, t: now }))
      const level = LEVEL_RANK[a.level] > LEVEL_RANK[prev.level] ? a.level : prev.level
      const escalated = LEVEL_RANK[level] > LEVEL_RANK[prev.level]
      setS((o) => ({
        ...o,
        level,
        scamType: a.scam_type !== 'none' ? a.scam_type : o.scamType,
        signals: [...o.signals, ...newSigs],
        whisper: a.whisper_en || a.whisper_hi ? { en: a.whisper_en, hi: a.whisper_hi } : o.whisper,
      }))
      const code = codeRef.current
      if (code && !isReplay && (newSigs.length || escalated)) {
        void pushAlert(code, {
          level,
          scamType: a.scam_type,
          signals: newSigs,
          note: a.whisper_en,
        }).catch(() => {})
        void updateSession(code, { level, scamType: a.scam_type }).catch(() => {})
      }
      if (escalated && LEVEL_RANK[level] >= LEVEL_RANK.warning) {
        const text = langRef.current === 'hi' ? a.whisper_hi || a.whisper_en : a.whisper_en
        void speak(text, langRef.current, `${import.meta.env.BASE_URL}whispers/${langRef.current}/${level}.wav`)
        if (!isReplay && agentRuns.current < 2 && code) {
          agentRuns.current += 1
          void runCaseAgent(
            { code, transcript: sRef.current.transcript, alert: { ...a, level }, lang: langRef.current },
            (st) => {
              rec({ type: 'step', step: st })
              setS((o) => ({ ...o, steps: [...o.steps, st] }))
            },
          )
            .then((r) => {
              if (r.report) {
                rec({ type: 'report', report: r.report })
                setS((o) => ({ ...o, report: r.report }))
              }
            })
            .catch((e) => patch({ error: `Case agent: ${(e as Error).message}` }))
        }
      }
    },
    [patch],
  )

  const stop = useCallback(() => {
    window.clearInterval(timer.current)
    window.clearInterval(frameTimer.current)
    replayTimers.current.forEach((x) => window.clearTimeout(x))
    replayTimers.current = []
    capRef.current?.stop()
    engRef.current?.stop()
    capRef.current = null
    engRef.current = null
    stopSpeaking()
    setS((o) => ({ ...o, running: false, status: 'Stopped' }))
  }, [])

  useEffect(() => () => stop(), [stop])

  const begin = useCallback(
    async (source: SourceKind | 'replay') => {
      agentRuns.current = 0
      events.current = []
      t0.current = Date.now()
      let code = ''
      let sessionError = ''
      if (firebaseConfigured) {
        try {
          code = await createSession(profile)
        } catch (e) {
          sessionError = `Guardian features unavailable (could not create session: ${(e as Error).message}).`
        }
      }
      codeRef.current = code
      setS({ ...initial, running: true, source, code, status: 'Starting…', error: sessionError })
      timer.current = window.setInterval(
        () => setS((o) => ({ ...o, elapsed: Math.round((Date.now() - t0.current) / 1000) })),
        1000,
      )
    },
    [profile],
  )

  const startLive = useCallback(
    async (kind: SourceKind, demoUrl?: string) => {
      await begin(kind)
      try {
        const cap =
          kind === 'mic' ? await startMic() : kind === 'tab' ? await startTab() : await startDemo(demoUrl!)
        capRef.current = cap
        const ev = {
          onTranscript: (text: string, final: boolean) => {
            rec({ type: 'transcript', text })
            setS((o) => ({ ...o, transcript: o.transcript + (final ? text : text) }))
          },
          onAlert: (a: Alert) => handleAlert(a),
          onStatus: (st: string) => patch({ status: st }),
          onError: (e: Error) => {
            if (engRef.current?.mode === 'live') {
              // fallback to chunked mode
              engRef.current.stop()
              const ce = startChunkEngine(ev)
              engRef.current = ce
              cap.onPcm((p) => ce.pushPcm(p))
              patch({ engine: 'chunk', error: `Live mode unavailable (${e.message}). Switched to chunked mode.` })
            } else {
              patch({ error: e.message })
            }
          },
        }
        let engine: Engine
        if (!preferLiveRef.current) {
          engine = startChunkEngine(ev)
          patch({ engine: 'chunk' })
        } else {
          try {
            engine = await startLiveEngine(ev)
            patch({ engine: 'live' })
          } catch (e) {
            engine = startChunkEngine(ev)
            patch({ engine: 'chunk', error: `Live mode unavailable (${(e as Error).message}). Using chunked mode.` })
          }
        }
        engRef.current = engine
        cap.onPcm((p) => engRef.current?.pushPcm(p))
        if (kind === 'tab') {
          frameTimer.current = window.setInterval(() => void grabAndCheck(), 15000)
          cap.ended.then(() => stop())
        }
        if (kind === 'demo') {
          cap.ended.then(() => {
            window.setTimeout(() => {
              if (sRef.current.running) {
                patch({ status: 'Call ended' })
                stop()
              }
            }, 6000)
          })
        }
      } catch (e) {
        patch({ error: (e as Error).message, running: false, status: 'Stopped' })
        window.clearInterval(timer.current)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [begin, handleAlert, patch, stop],
  )

  const grabAndCheck = useCallback(async () => {
    const cap = capRef.current
    if (!cap?.grabFrame) return
    try {
      const jpg = await cap.grabFrame()
      if (!jpg) return
      const cues = await checkFrame(jpg)
      if (cues.length) {
        cues.forEach((c) => rec({ type: 'frame', cue: c }))
        setS((o) => ({ ...o, cues: [...o.cues, ...cues] }))
        // a visual cue of staged authority nudges the level up to at least caution
        if (LEVEL_RANK[sRef.current.level] < 1)
          handleAlert({ level: 'caution', scam_type: sRef.current.scamType, signals: [{ id: 'fake_documents', quote: cues[0].detail }], whisper_en: '', whisper_hi: '' })
      }
    } catch (e) {
      patch({ error: `Frame check: ${(e as Error).message}` })
    }
  }, [handleAlert, patch])

  const startReplay = useCallback(
    async (item: DemoItem) => {
      if (!item.replay) return
      await begin('replay')
      patch({ engine: 'replay', status: 'Replaying a recorded session (no live model calls)' })
      try {
        const evs = (await (await fetch(item.replay)).json()) as ReplayEvent[]
        const cap = await startDemo(item.audio)
        capRef.current = cap
        for (const e of evs) {
          replayTimers.current.push(
            window.setTimeout(() => {
              if (e.type === 'transcript') setS((o) => ({ ...o, transcript: o.transcript + (e.text ?? '') }))
              else if (e.type === 'alert' && e.alert) handleAlert(e.alert, true)
              else if (e.type === 'step' && e.step) setS((o) => ({ ...o, steps: [...o.steps, e.step!] }))
              else if (e.type === 'frame' && e.cue) setS((o) => ({ ...o, cues: [...o.cues, e.cue!] }))
              else if (e.type === 'report' && e.report) {
                setS((o) => ({ ...o, report: e.report! }))
                const c = codeRef.current
                if (c) void updateSession(c, { report: e.report! }).catch(() => {})
              }
              // mirror guardian-facing state for replayed alerts
              if (e.type === 'alert' && e.alert && e.alert.level !== 'calm' && codeRef.current) {
                void updateSession(codeRef.current, { level: e.alert.level, scamType: e.alert.scam_type }).catch(() => {})
                if (e.alert.signals.length)
                  void pushAlert(codeRef.current, { level: e.alert.level, scamType: e.alert.scam_type, signals: e.alert.signals, note: e.alert.whisper_en }).catch(() => {})
              }
              if (e.type === 'step' && e.step?.tool === 'request_cooloff_hold' && codeRef.current)
                void updateSession(codeRef.current, { holdStatus: 'requested', holdReason: e.step.detail }).catch(() => {})
              if (e.type === 'step' && e.step?.tool === 'notify_guardian' && codeRef.current)
                void updateSession(codeRef.current, { guardianSummary: e.step.detail }).catch(() => {})
            }, e.t),
          )
        }
        cap.ended.then(() => window.setTimeout(() => stop(), 4000))
      } catch (e) {
        patch({ error: (e as Error).message, running: false })
      }
    },
    [begin, handleAlert, patch, stop],
  )

  const downloadReplay = useCallback(() => {
    const blob = new Blob([JSON.stringify(events.current, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'replay.json'
    a.click()
  }, [])

  return {
    s,
    startMic: () => startLive('mic'),
    startTab: () => startLive('tab'),
    startDemo: (item: DemoItem) => startLive('demo', item.audio),
    startReplay,
    stop,
    grabAndCheck,
    downloadReplay,
  }
}
