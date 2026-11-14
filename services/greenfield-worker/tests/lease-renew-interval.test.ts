// GF-OPS-01(c) regression: processOneJob resolves the lease-renewal interval
// before it claims a job. Unit tests for the resolver; the live-Postgres proof
// is in lease-renewal.integration.test.ts.
import {describe, expect, it} from 'vitest'
import {resolveLeaseRenewIntervalMs} from '../src/jobs/lease-renew-interval.js'
import {startPeriodic} from '../src/timers/periodic.js'

describe('resolveLeaseRenewIntervalMs', () => {
  it('root cause: startPeriodic refuses an undefined interval (what a pre-#181 hand-built config produced)', () => {
    expect(() => startPeriodic(async () => {}, undefined as unknown as number)).toThrow(RangeError)
  })

  it('defaults to a third of the lease when unset, matching loadConfig()', () => {
    expect(resolveLeaseRenewIntervalMs({leaseDurationMs: 60_000} as never)).toBe(20_000)
    expect(resolveLeaseRenewIntervalMs({leaseDurationMs: 90_000, leaseRenewIntervalMs: undefined} as never)).toBe(30_000)
    expect(resolveLeaseRenewIntervalMs({leaseDurationMs: 2} as never)).toBe(1)
  })

  it('keeps a valid configured interval unchanged (no clamping)', () => {
    expect(resolveLeaseRenewIntervalMs({leaseDurationMs: 60_000, leaseRenewIntervalMs: 10_000})).toBe(10_000)
    expect(resolveLeaseRenewIntervalMs({leaseDurationMs: 600, leaseRenewIntervalMs: 200})).toBe(200)
    expect(resolveLeaseRenewIntervalMs({leaseDurationMs: 60_000, leaseRenewIntervalMs: 30_000})).toBe(30_000)
  })

  it('refuses a configured interval that is not a positive integer of at most half the lease', () => {
    for (const leaseRenewIntervalMs of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 30_001, 59_999, 60_000, 60_001, '1000', null]) {
      expect(() => resolveLeaseRenewIntervalMs({leaseDurationMs: 60_000, leaseRenewIntervalMs} as never)).toThrow(RangeError)
    }
  })

  it('refuses an invalid lease duration', () => {
    for (const leaseDurationMs of [0, -1, 1.5, Number.NaN, undefined]) {
      expect(() => resolveLeaseRenewIntervalMs({leaseDurationMs} as never)).toThrow(RangeError)
    }
  })
})
