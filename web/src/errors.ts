/** Turn SDK / network errors into something a judge or an elderly user can act on. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  const name = e instanceof Error ? e.name : ''
  if (name === 'NotAllowedError' || name === 'NotFoundError')
    return 'Microphone or screen sharing was blocked or not found. Allow it in the browser (and tick "Also share tab audio" for Meet), then try again.'
  if (/timeout|timed out|abort/i.test(`${name} ${msg}`)) return 'Gemini took too long to answer. Please try again, or press ⏺ Recorded replay.'
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg))
    return 'Gemini is busy (free-tier limit reached). Please try again in a minute, or press ⏺ Replay to see a recorded session.'
  if (/app ?check/i.test(msg))
    return 'Security check (App Check) failed. Please reload the page; if a privacy or ad-blocking extension blocks reCAPTCHA, allow it for this site.'
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Network problem. Check your internet connection and try again.'
  if (/Permission|permission-denied|insufficient/i.test(msg)) return 'This action is not allowed (permission denied).'
  return msg.length > 220 ? msg.slice(0, 220) + '…' : msg
}

export const isQuotaError = (e: unknown) => /429|RESOURCE_EXHAUSTED|quota/i.test(e instanceof Error ? e.message : String(e))

/** quota, timeout or temporary server overload: worth retrying on another model */
export const isRetryable = (e: unknown) =>
  isQuotaError(e) || /timeout|timed out|abort|\b5\d\d\b|UNAVAILABLE|overloaded|INTERNAL/i.test(e instanceof Error ? `${e.name} ${e.message}` : String(e))
