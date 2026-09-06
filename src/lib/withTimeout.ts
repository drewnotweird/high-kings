// A ceiling for awaited work that would otherwise hang forever.
//
// Auth and profile calls go over the network behind a lazily-imported module,
// and without a ceiling any stall leaves a button spinning with no way back and
// no explanation. That is what a deadlock in supabase-js's auth lock looked
// like from the outside, but a dropped mobile connection strands the user just
// as badly, so the guard is worth having regardless of cause.
//
// Resolves with TIMED_OUT rather than rejecting, so callers handle the timeout
// as a normal outcome and can't accidentally swallow it alongside real errors.
// Real rejections still propagate.

export const TIMED_OUT = Symbol('timed-out')

/** 8s: comfortably longer than a real sign-in on a slow connection, short
 *  enough that the user gets an actionable error instead of an endless wait. */
export const AUTH_TIMEOUT_MS = 8000

export const TIMEOUT_MESSAGE = 'Timed out. Check your connection and try again.'

export function withTimeout<T>(
  work: () => Promise<T>,
  ms: number = AUTH_TIMEOUT_MS,
): Promise<T | typeof TIMED_OUT> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(TIMED_OUT), ms)
    let settled = false
    const done = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }
    try {
      work().then(
        value => done(() => resolve(value)),
        err => done(() => reject(err)),
      )
    } catch (err) {
      // work() threw synchronously before returning a promise
      done(() => reject(err))
    }
  })
}
