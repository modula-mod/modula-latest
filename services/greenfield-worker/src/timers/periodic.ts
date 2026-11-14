/**
 * GF-OPS-01(c): a non-overlapping periodic task on its own timer.
 *
 * The worker's main loop blocks while a job runs, so anything that must keep
 * happening during a long job (liveness heartbeat, job lease renewal) runs on a
 * separate `setInterval`. A tick is skipped while the previous run is still in
 * flight, the timer is unref'd so it never keeps the process alive, and
 * `stop()` clears the timer and waits for any in-flight run to settle.
 */
export type PeriodicTask = {
  /** Clears the timer and resolves once any in-flight run has settled. Idempotent. */
  stop(): Promise<void>
  readonly stopped: boolean
  /** Ticks skipped because the previous run had not finished. */
  readonly skippedTicks: number
}

export function startPeriodic(
  task: () => Promise<void>,
  intervalMs: number,
  options: {runImmediately?: boolean} = {},
): PeriodicTask {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new RangeError('intervalMs must be a positive number')
  let stopped = false
  let skippedTicks = 0
  let inFlight: Promise<void> | null = null

  const tick = () => {
    if (stopped) return
    if (inFlight) {
      skippedTicks += 1
      return
    }
    // The task owns its own error reporting; this catch only guarantees a
    // rejected run can never become an unhandled rejection that kills the worker.
    inFlight = (async () => {
      try {
        await task()
      } catch {
        // swallowed: see above
      } finally {
        inFlight = null
      }
    })()
  }

  const timer = setInterval(tick, intervalMs)
  timer.unref()
  if (options.runImmediately) tick()

  return {
    async stop() {
      stopped = true
      clearInterval(timer)
      if (inFlight) await inFlight
    },
    get stopped() {
      return stopped
    },
    get skippedTicks() {
      return skippedTicks
    },
  }
}
