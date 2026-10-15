import {describe, expect, it} from 'vitest'
import {infrastructureBackoffMs, isPermanentError, nextAvailableAt, RETRY_DELAYS_MS} from '../src/jobs/retry.js'

describe('retry policy', () => {
  it('uses bounded delays', () => {
    expect(RETRY_DELAYS_MS).toHaveLength(5)
    const at = nextAvailableAt(1, 0).getTime()
    expect(at).toBeGreaterThanOrEqual(30_000 * 0.8)
    expect(at).toBeLessThan(30_000 * 1.3)
  })

  it('classifies permanent errors', () => {
    expect(isPermanentError('REVOKED_CONNECTION')).toBe(true)
    expect(isPermanentError('TIMEOUT')).toBe(false)
  })

  it('backs off infrastructure failures exponentially with bounded jitter', () => {
    expect(infrastructureBackoffMs(1, 60_000, () => 0.5)).toBe(1_000)
    expect(infrastructureBackoffMs(4, 60_000, () => 0.5)).toBe(8_000)
    expect(infrastructureBackoffMs(20, 60_000, () => 0)).toBe(48_000)
    expect(infrastructureBackoffMs(20, 60_000, () => 1)).toBe(60_000)
  })
})
