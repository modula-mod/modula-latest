// GF-OPS-01(c): unit coverage for the independent heartbeat timer, the
// non-overlapping periodic helper and the liveness config. No database needed.
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {loadConfig} from '../src/config.js'
import {startHeartbeat} from '../src/heartbeat/heartbeat.js'
import {startPeriodic} from '../src/timers/periodic.js'

const HEALTH_THRESHOLD_MS = 90_000
const JOB_MS = 90_000

function fakeHeartbeatDb(options: {fail?: boolean; writeLatencyMs?: number} = {}) {
  const writes: number[] = []
  const db = {
    insertInto: () => ({
      values: () => ({
        onConflict: () => ({
          execute: async () => {
            if (options.writeLatencyMs) await new Promise(resolve => setTimeout(resolve, options.writeLatencyMs))
            if (options.fail) throw new Error('connect ECONNREFUSED postgresql://worker:hunter2@db:5432/modula')
            writes.push(Date.now())
          },
        }),
      }),
    }),
  }
  return {db: db as any, writes}
}

describe('startPeriodic', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('skips a tick while the previous run is still in flight', async () => {
    let release!: () => void
    const task = vi.fn(() => new Promise<void>(resolve => { release = resolve }))
    const periodic = startPeriodic(task, 1_000)
    await vi.advanceTimersByTimeAsync(3_500)
    expect(task).toHaveBeenCalledTimes(1)
    expect(periodic.skippedTicks).toBe(2)
    release()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(task).toHaveBeenCalledTimes(2)
    release()
    await periodic.stop()
  })

  it('never surfaces a rejected run and keeps ticking', async () => {
    const task = vi.fn(async () => { throw new Error('boom') })
    const periodic = startPeriodic(task, 1_000)
    await vi.advanceTimersByTimeAsync(3_000)
    expect(task).toHaveBeenCalledTimes(3)
    await periodic.stop()
  })

  it('stop() clears the timer, waits for the in-flight run and is idempotent', async () => {
    let finished = false
    const task = vi.fn(async () => { await new Promise(resolve => setTimeout(resolve, 500)); finished = true })
    const periodic = startPeriodic(task, 1_000, {runImmediately: true})
    expect(task).toHaveBeenCalledTimes(1)
    const stopping = periodic.stop()
    await vi.advanceTimersByTimeAsync(500)
    await stopping
    expect(finished).toBe(true)
    expect(periodic.stopped).toBe(true)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(task).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    await periodic.stop()
  })

  it('rejects a non-positive interval', () => {
    expect(() => startPeriodic(async () => undefined, 0)).toThrow(RangeError)
  })
})

describe('startHeartbeat (independent timer)', () => {
  beforeEach(() => vi.useFakeTimers({now: new Date('2026-11-13T12:00:00Z')}))
  afterEach(() => vi.useRealTimers())

  it('keeps the heartbeat fresh through a simulated 90 s job that blocks the main loop', async () => {
    const {db, writes} = fakeHeartbeatDb()
    const heartbeat = startHeartbeat(db, {workerId: 'w-90s', releaseSha: null, startedAt: new Date(), intervalMs: 15_000})
    await vi.advanceTimersByTimeAsync(0)
    // Main loop is "blocked" for the whole job; only the heartbeat timer runs.
    let maxAgeMs = 0
    for (let elapsed = 0; elapsed < JOB_MS; elapsed += 1_000) {
      await vi.advanceTimersByTimeAsync(1_000)
      maxAgeMs = Math.max(maxAgeMs, Date.now() - writes[writes.length - 1]!)
    }
    await heartbeat.stop()
    // Before the fix the only write was at job start, so the age reached 90 s.
    expect(writes.length).toBeGreaterThanOrEqual(7)
    expect(maxAgeMs).toBeLessThanOrEqual(15_000)
    expect(maxAgeMs).toBeLessThan(HEALTH_THRESHOLD_MS)
  })

  it('does not overlap slow writes', async () => {
    const {db, writes} = fakeHeartbeatDb({writeLatencyMs: 25_000})
    const heartbeat = startHeartbeat(db, {workerId: 'w-slow', releaseSha: null, startedAt: new Date(), intervalMs: 10_000})
    await vi.advanceTimersByTimeAsync(60_000)
    // A 25 s write with a 10 s interval: at most one write in flight at a time.
    expect(writes.length).toBeLessThanOrEqual(3)
    expect(heartbeat.skippedTicks).toBeGreaterThan(0)
    const stopping = heartbeat.stop()
    await vi.advanceTimersByTimeAsync(25_000)
    await stopping
  })

  it('reports a failed write without throwing or passing error detail', async () => {
    const {db} = fakeHeartbeatDb({fail: true})
    const onFailure = vi.fn()
    const heartbeat = startHeartbeat(db, {workerId: 'w-fail', releaseSha: null, startedAt: new Date(), intervalMs: 15_000, onFailure})
    await vi.advanceTimersByTimeAsync(30_000)
    expect(onFailure).toHaveBeenCalledTimes(3)
    for (const call of onFailure.mock.calls) expect(call).toEqual([])
    await heartbeat.stop()
  })

  it('stops writing on shutdown', async () => {
    const {db, writes} = fakeHeartbeatDb()
    const heartbeat = startHeartbeat(db, {workerId: 'w-stop', releaseSha: null, startedAt: new Date(), intervalMs: 15_000})
    await vi.advanceTimersByTimeAsync(30_000)
    const before = writes.length
    await heartbeat.stop()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(writes.length).toBe(before)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('liveness config', () => {
  const base = {NODE_ENV: 'test', MODULA_DATABASE_URL: 'postgresql://u@127.0.0.1:1/x'} as NodeJS.ProcessEnv

  it('defaults to a 15 s heartbeat and lease renewal at a third of the lease', () => {
    const config = loadConfig(base)
    expect(config.heartbeatIntervalMs).toBe(15_000)
    expect(config.leaseDurationMs).toBe(60_000)
    expect(config.leaseRenewIntervalMs).toBe(20_000)
  })

  it('accepts explicit intervals and derives renewal from a custom lease', () => {
    expect(loadConfig({...base, MODULA_WORKER_HEARTBEAT_INTERVAL_MS: '5000'}).heartbeatIntervalMs).toBe(5_000)
    expect(loadConfig({...base, MODULA_WORKER_LEASE_DURATION_MS: '90000'}).leaseRenewIntervalMs).toBe(30_000)
    expect(loadConfig({...base, MODULA_WORKER_LEASE_RENEW_INTERVAL_MS: '10000'}).leaseRenewIntervalMs).toBe(10_000)
  })

  it('refuses a renewal interval that is not shorter than the lease and an out-of-range heartbeat', () => {
    expect(() => loadConfig({...base, MODULA_WORKER_LEASE_RENEW_INTERVAL_MS: '60000'})).toThrow(/LEASE_RENEW_INTERVAL/)
    expect(() => loadConfig({...base, MODULA_WORKER_HEARTBEAT_INTERVAL_MS: '500'})).toThrow(/HEARTBEAT_INTERVAL/)
    expect(() => loadConfig({...base, MODULA_WORKER_HEARTBEAT_INTERVAL_MS: '90000'})).toThrow(/HEARTBEAT_INTERVAL/)
  })
})
