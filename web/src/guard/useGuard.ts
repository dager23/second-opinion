import { useCallback, useEffect, useRef, useState } from 'react'
import { firebaseConfigured } from '../firebase'
import { startMic, startTab, startDemo, type Capture, type SourceKind } from '../audio/capture'
import { startChunkEngine, startLiveEngine, type Engine, type EngineEvents } from './engine'
import { checkFrame, type FrameCue } from './frameCheck'
import { speak, stopSpeaking } from './whisper'
import { draftFinalReport, runCaseAgent, type AgentStep, type CaseContext } from '../agent/caseAgent'
import { createSession, pushAlert, updateSession, type Report } from '../store'
import { friendlyError } from '../errors'
import { LEVEL_RANK, SCAM_LABEL, type Alert, type Lang, type Level, type Profile, type Signal } from '../shared'

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
  finishing: boolean
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
  finishing: false,
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

/**
 * The authoritative call state lives in a ref that is updated synchronously.
 * React state is only a mirror for rendering: reading React state from inside async engine callbacks
 * returned stale values (e.g. the case agent missed the chunk that triggered the alert).
 */
interface CallState {
  level: Level
  scamType: string
  signals: Signal[]
  transcript: string
  guardianNotified: boolean
  holdRequested: boolean
  agentStarted: boolean
  actions: string[]
}
const freshCall = (): CallState => ({
  level: 'calm',
  scamType: 'none',
  signals: [],
  transcript: '',
  guardianNotified: false,
  holdRequested: false,
  agentStarted: false,
  actions: [],
})

const atLeast = (l: Level, min: Level) => LEVEL_RANK[l] >= LEVEL_RANK[min]

export function useGuard(profile: Profile, lang: Lang, preferLive = false) {
  const [s, setS] = useState<GuardState>(initial)
  const call = useRef<CallState>(freshCall())
  const capRef = useRef<Capture | null>(null)
  const engRef = useRef<Engine | null>(null)
  const modeRef = useRef<GuardState['engine']>('')
  const t0 = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const frameTimer = useRef<number | undefined>(undefined)
  const events = useRef<ReplayEvent[]>([])
  const replayTimers = useRef<number[]>([])
  const ending = useRef(false)
  const langRef = useRef(lang)
  langRef.current = lang
  const codeRef = useRef('')
  const preferLiveRef = useRef(preferLive)
  preferLiveRef.current = preferLive

  const patch = useCallback((p: Partial<GuardState>) => setS((o) => ({ ...o, ...p })), [])
  const rec = (e: Omit<ReplayEvent, 't'>) => events.current.push({ ...e, t: Date.now() - t0.current })
  const addStep = useCallback((st: AgentStep) => {
    rec({ type: 'step', step: st })
    setS((o) => ({ ...o, steps: [...o.steps, st] }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const caseContext = useCallback(
    (): CaseContext => ({
      code: codeRef.current,
      transcript: call.current.transcript,
      level: call.current.level,
      scamType: call.current.scamType,
      signals: call.current.signals,
      actions: call.current.actions,
      isHoldRequested: () => call.current.holdRequested,
      markHoldRequested: () => {
        call.current.holdRequested = true
        call.current.actions.push('Cool-off hold requested (awaiting guardian approval)')
      },
    }),
    [],
  )

  /** Safety-critical actions do not depend on an LLM deciding to call a tool. */
  const takeActions = useCallback(() => {
    const c = call.current
    const code = codeRef.current
    if (!code || !atLeast(c.level, 'warning')) return
    const label = SCAM_LABEL[c.scamType] ?? 'scam'
    if (!c.guardianNotified) {
      c.guardianNotified = true
      const q = c.signals[c.signals.length - 1]?.quote
      const summary = `Possible ${label.toLowerCase()} call in progress.${q ? ` Second Opinion heard: “${q}”.` : ''} Please call them now.`
      c.actions.push('Guardian alerted')
      void updateSession(code, { guardianSummary: summary }).catch(() => {})
      addStep({ tool: 'alert_guardian', detail: 'Guardian’s phone alerted with a live summary' })
    }
    const ask = c.signals.find((x) => x.id === 'payment_request' || x.id === 'remote_access')
    if (ask && !c.holdRequested) {
      c.holdRequested = true
      const reason = `Caller asked for ${ask.id === 'payment_request' ? 'money / an OTP' : 'remote access'}: “${ask.quote}”`
      c.actions.push('Cool-off hold requested (awaiting guardian approval)')
      void updateSession(code, { holdStatus: 'requested', holdReason: reason }).catch(() => {})
      addStep({ tool: 'request_cooloff_hold', detail: reason })
    }
    if (!c.agentStarted) {
      c.agentStarted = true
      void runCaseAgent(caseContext(), addStep)
        .then((r) => {
          if (r.report) {
            rec({ type: 'report', report: r.report })
            setS((o) => ({ ...o, report: r.report }))
          }
        })
        .catch((e) => patch({ error: `Case agent: ${friendlyError(e)}` }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addStep, caseContext, patch])

  const handleAlert = useCallback(
    (a: Alert, isReplay = false) => {
      if (!isReplay) rec({ type: 'alert', alert: a })
      if (a.level === 'calm' && a.signals.length === 0) return
      const c = call.current
      const now = Math.round((Date.now() - t0.current) / 1000)
      // the classifier often re-quotes the same line with slightly different boundaries across slices
      const norm = (q: string) => q.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim()
      const seen = (x: Signal, list: Signal[]) =>
        list.some((y) => y.id === x.id && (norm(y.quote).includes(norm(x.quote)) || norm(x.quote).includes(norm(y.quote))))
      const newSigs: Signal[] = []
      for (const x of a.signals) {
        if (x.quote && !seen(x, c.signals) && !seen(x, newSigs)) newSigs.push({ ...x, t: now })
      }
      const prevLevel = c.level
      // the level only ratchets up during a call: a scammer pausing does not make the call safe
      if (LEVEL_RANK[a.level] > LEVEL_RANK[c.level]) c.level = a.level
      if (a.scam_type && a.scam_type !== 'none') c.scamType = a.scam_type
      c.signals = [...c.signals, ...newSigs]
      const escalated = c.level !== prevLevel
      setS((o) => ({
        ...o,
        level: c.level,
        scamType: c.scamType,
        signals: c.signals,
        whisper: a.whisper_en || a.whisper_hi ? { en: a.whisper_en, hi: a.whisper_hi } : o.whisper,
      }))
      if (escalated && atLeast(c.level, 'warning')) {
        const text = langRef.current === 'hi' ? a.whisper_hi || a.whisper_en : a.whisper_en
        void speak(text, langRef.current, `${import.meta.env.BASE_URL}whispers/${langRef.current}/${c.level}.wav`)
      }
      if (isReplay) return
      const code = codeRef.current
      if (code && (newSigs.length || escalated)) {
        void pushAlert(code, { level: c.level, scamType: c.scamType, signals: newSigs, note: a.whisper_en }).catch(() => {})
        void updateSession(code, { level: c.level, scamType: c.scamType }).catch(() => {})
      }
      takeActions()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [takeActions],
  )

  const clearTimers = () => {
    window.clearInterval(timer.current)
    window.clearInterval(frameTimer.current)
    replayTimers.current.forEach((x) => window.clearTimeout(x))
    replayTimers.current = []
  }

  /** Hard teardown (unmount): no final processing. */
  const teardown = useCallback(() => {
    clearTimers()
    capRef.current?.stop()
    engRef.current?.stop()
    capRef.current = null
    engRef.current = null
    stopSpeaking()
  }, [])

  useEffect(() => () => teardown(), [teardown])

  /** Graceful end of a call: stop capture, analyse the buffered tail, then write the final report. */
  const endCall = useCallback(
    async (reason = 'Stopped') => {
      if (ending.current) return
      ending.current = true
      try {
        window.clearInterval(frameTimer.current)
        if (modeRef.current === 'replay') {
          teardown()
          patch({ running: false, status: reason })
          return
        }
        capRef.current?.stop()
        capRef.current = null
        patch({ finishing: true, status: 'Finishing the analysis…' })
        const eng = engRef.current
        if (eng) await Promise.race([eng.finish().catch(() => {}), new Promise((r) => setTimeout(r, 25000))])
        eng?.stop()
        engRef.current = null
        window.clearInterval(timer.current)
        patch({ running: false, status: reason })
        const c = call.current
        if (codeRef.current && atLeast(c.level, 'warning')) {
          try {
            const report = await draftFinalReport(caseContext())
            rec({ type: 'report', report })
            setS((o) => ({ ...o, report }))
            await updateSession(codeRef.current, { report })
            addStep({ tool: 'draft_report', detail: 'Final complaint draft written from the full call' })
          } catch (e) {
            patch({ error: `Final report: ${friendlyError(e)}` })
          }
        }
      } finally {
        ending.current = false
        patch({ finishing: false })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addStep, caseContext, patch, teardown],
  )

  const begin = useCallback(
    async (source: SourceKind | 'replay') => {
      call.current = freshCall()
      events.current = []
      t0.current = Date.now()
      let code = ''
      let sessionError = ''
      if (firebaseConfigured) {
        try {
          code = await createSession(profile)
        } catch (e) {
          sessionError = `Guardian features unavailable: ${friendlyError(e)}`
        }
      }
      codeRef.current = code
      setS({ ...initial, running: true, source, code, status: 'Starting…', error: sessionError })
      window.clearInterval(timer.current)
      timer.current = window.setInterval(
        () => setS((o) => ({ ...o, elapsed: Math.round((Date.now() - t0.current) / 1000) })),
        1000,
      )
    },
    [profile],
  )

  const grabAndCheck = useCallback(async () => {
    const cap = capRef.current
    if (!cap?.grabFrame) return
    try {
      const jpg = await cap.grabFrame()
      if (!jpg) return
      const cues = await checkFrame(jpg)
      if (cues.length) {
        cues.forEach((cue) => rec({ type: 'frame', cue }))
        setS((o) => ({ ...o, cues: [...o.cues, ...cues] }))
        // staged-authority visuals (uniform, warrant) count as a fake_documents signal
        handleAlert({
          level: 'caution',
          scam_type: call.current.scamType,
          signals: [{ id: 'fake_documents', quote: `Video: ${cues[0].cue}${cues[0].detail ? ` (${cues[0].detail})` : ''}` }],
          whisper_en: '',
          whisper_hi: '',
        })
      }
    } catch (e) {
      patch({ error: `Frame check: ${friendlyError(e)}` })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleAlert, patch])

  const startLive = useCallback(
    async (kind: SourceKind, demoUrl?: string) => {
      await begin(kind)
      try {
        const cap =
          kind === 'mic' ? await startMic() : kind === 'tab' ? await startTab() : await startDemo(demoUrl!)
        capRef.current = cap
        const ev: EngineEvents = {
          onTranscript: (text) => {
            rec({ type: 'transcript', text })
            call.current.transcript += text
            const transcript = call.current.transcript
            setS((o) => ({ ...o, transcript }))
          },
          onAlert: (a) => handleAlert(a),
          onStatus: (st) => patch({ status: st }),
          onError: (e) => {
            if (engRef.current?.mode === 'live') {
              engRef.current.stop()
              const ce = startChunkEngine(ev)
              engRef.current = ce
              modeRef.current = 'chunk'
              patch({ engine: 'chunk', error: `Live mode stopped (${friendlyError(e)}). Switched to chunked analysis.` })
            } else {
              patch({ error: friendlyError(e) })
            }
          },
        }
        let engine: Engine
        if (!preferLiveRef.current) {
          engine = startChunkEngine(ev)
        } else {
          try {
            engine = await startLiveEngine(ev)
          } catch (e) {
            engine = startChunkEngine(ev)
            patch({ error: `Live mode unavailable (${friendlyError(e)}). Using chunked analysis.` })
          }
        }
        engRef.current = engine
        modeRef.current = engine.mode
        patch({ engine: engine.mode })
        cap.onPcm((p) => engRef.current?.pushPcm(p))
        if (kind === 'tab') {
          frameTimer.current = window.setInterval(() => void grabAndCheck(), 15000)
          cap.ended.then(() => endCall('Screen sharing stopped'))
        }
        if (kind === 'demo') cap.ended.then(() => endCall('Call ended'))
      } catch (e) {
        capRef.current?.stop()
        capRef.current = null
        clearTimers()
        patch({ error: friendlyError(e), running: false, status: 'Stopped' })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [begin, handleAlert, patch, endCall, grabAndCheck],
  )

  const startReplay = useCallback(
    async (item: DemoItem) => {
      if (!item.replay) return
      await begin('replay')
      modeRef.current = 'replay'
      patch({ engine: 'replay', status: 'Recorded session' })
      try {
        const evs = (await (await fetch(item.replay)).json()) as ReplayEvent[]
        const cap = await startDemo(item.audio)
        capRef.current = cap
        const code = () => codeRef.current
        for (const e of evs) {
          replayTimers.current.push(
            window.setTimeout(() => {
              if (e.type === 'transcript') {
                call.current.transcript += e.text ?? ''
                const transcript = call.current.transcript
                setS((o) => ({ ...o, transcript }))
              } else if (e.type === 'alert' && e.alert) {
                handleAlert(e.alert, true)
                // mirror guardian-facing state so the guardian view works during a replay too
                if (e.alert.level !== 'calm' && code()) {
                  void updateSession(code(), { level: call.current.level, scamType: call.current.scamType }).catch(() => {})
                  if (e.alert.signals.length)
                    void pushAlert(code(), { level: call.current.level, scamType: call.current.scamType, signals: e.alert.signals, note: e.alert.whisper_en }).catch(() => {})
                }
              } else if (e.type === 'step' && e.step) {
                setS((o) => ({ ...o, steps: [...o.steps, e.step!] }))
                if (e.step.tool === 'request_cooloff_hold' && code())
                  void updateSession(code(), { holdStatus: 'requested', holdReason: e.step.detail }).catch(() => {})
                if (e.step.tool === 'notify_guardian' && code())
                  void updateSession(code(), { guardianSummary: e.step.detail }).catch(() => {})
              } else if (e.type === 'frame' && e.cue) {
                setS((o) => ({ ...o, cues: [...o.cues, e.cue!] }))
              } else if (e.type === 'report' && e.report) {
                setS((o) => ({ ...o, report: e.report! }))
                if (code()) void updateSession(code(), { report: e.report! }).catch(() => {})
              }
            }, e.t),
          )
        }
        cap.ended.then(() => window.setTimeout(() => endCall('Recorded session ended'), 2500))
      } catch (e) {
        teardown()
        patch({ error: friendlyError(e), running: false, status: 'Stopped' })
      }
    },
    [begin, handleAlert, patch, endCall, teardown],
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
    stop: () => endCall('Stopped'),
    grabAndCheck,
    downloadReplay,
  }
}
