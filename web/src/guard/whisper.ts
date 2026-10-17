import type { Lang } from '../shared'

/** Speak a whisper warning using pre-rendered Gemini TTS if present, else the browser voice. */
let current: HTMLAudioElement | null = null

export async function speak(text: string, lang: Lang, clip?: string) {
  stopSpeaking()
  if (clip) {
    try {
      const a = new Audio(clip)
      current = a
      await a.play()
      return
    } catch {
      /* fall through */
    }
  }
  if ('speechSynthesis' in window && text) {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
    u.rate = 0.9
    u.volume = 0.8
    window.speechSynthesis.speak(u)
  }
}

export function stopSpeaking() {
  current?.pause()
  current = null
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}
