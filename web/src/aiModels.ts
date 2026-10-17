import { isRetryable } from './errors'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Per-request timeouts (ms). The SDK default is 180 s, far too long for a live call. */
export const TIMEOUT = { chunk: 20000, check: 60000, agent: 40000, report: 40000, frame: 25000, chat: 40000 }

/**
 * Free-tier Gemini limits are per model and per minute. Bursts (end of a call: last audio slice + case agent
 * + final report) can hit one model's cap, so on a quota error, timeout or temporary overload we retry on the
 * next model in the list. Any other error is thrown immediately.
 */
export async function withFallback<T>(models: string[], run: (model: string) => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < models.length; i++) {
    try {
      return await run(models[i])
    } catch (e) {
      lastErr = e
      if (!isRetryable(e)) throw e
      if (i < models.length - 1) await sleep(600 + i * 1500)
    }
  }
  throw lastErr
}
