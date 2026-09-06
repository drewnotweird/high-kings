import { describe, it, expect, vi } from 'vitest'
import { withTimeout, TIMED_OUT, AUTH_TIMEOUT_MS } from './withTimeout'

describe('withTimeout', () => {
  it('returns TIMED_OUT for work that never settles', async () => {
    vi.useFakeTimers()
    // The deadlock case: signInWithPassword blocked on the auth lock, which
    // never resolves and never rejects. Before this guard the button sat on
    // "Logging in…" indefinitely.
    const promise = withTimeout(() => new Promise<string>(() => {}))
    await vi.advanceTimersByTimeAsync(AUTH_TIMEOUT_MS + 1)
    await expect(promise).resolves.toBe(TIMED_OUT)
    vi.useRealTimers()
  })

  it('returns the value when work finishes in time', async () => {
    vi.useFakeTimers()
    const promise = withTimeout(() => new Promise<string>(r => setTimeout(() => r('signed in'), 100)))
    await vi.advanceTimersByTimeAsync(200)
    await expect(promise).resolves.toBe('signed in')
    vi.useRealTimers()
  })

  it('propagates a real rejection rather than reporting a timeout', async () => {
    await expect(withTimeout(() => Promise.reject(new Error('Invalid login credentials'))))
      .rejects.toThrow('Invalid login credentials')
  })

  it('propagates a synchronous throw', async () => {
    await expect(withTimeout(() => { throw new Error('module failed to load') }))
      .rejects.toThrow('module failed to load')
  })

  it('does not resolve twice when work settles right on the deadline', async () => {
    vi.useFakeTimers()
    const promise = withTimeout(() => new Promise<string>(r => setTimeout(() => r('late'), AUTH_TIMEOUT_MS)))
    await vi.advanceTimersByTimeAsync(AUTH_TIMEOUT_MS + 50)
    // Whichever wins, exactly one outcome is delivered and it never throws.
    await expect(promise).resolves.toSatisfy(v => v === TIMED_OUT || v === 'late')
    vi.useRealTimers()
  })

  it('clears its timer so a resolved call leaves nothing pending', async () => {
    vi.useFakeTimers()
    await withTimeout(() => Promise.resolve('done'))
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
  })

  it('honours a custom timeout', async () => {
    vi.useFakeTimers()
    const promise = withTimeout(() => new Promise<string>(() => {}), 1000)
    await vi.advanceTimersByTimeAsync(1001)
    await expect(promise).resolves.toBe(TIMED_OUT)
    vi.useRealTimers()
  })
})
