import type {WorkerConfig} from '../config.js'

/**
 * GF-OPS-01(c) regression fix: the lease-renewal interval processOneJob uses.
 *
 * loadConfig() always sets leaseRenewIntervalMs, but processOneJob is also
 * called with WorkerConfig objects built by hand (API integration tests and
 * other in-process callers written before #181). Those omit the field, and an
 * undefined interval made startPeriodic throw a RangeError *after* the job had
 * been claimed but before markJobRunning. The catch path then called
 * scheduleRetry on a LEASED (not RUNNING) row, whose ownership guard turned the
 * RangeError into a misleading "Job lease is no longer owned by worker" error.
 *
 * This resolves the interval *before* a job is claimed:
 * - unset: the same default loadConfig() uses, a third of the lease;
 * - set but not a positive integer of at most half the lease (the same margin
 *   loadConfig() enforces): refuse (RangeError) without claiming anything, so a
 *   bad config can never strand a claimed job or run a handler whose lease can
 *   lapse between renewals. No clamping. The 1000 ms env minimum stays a
 *   loadConfig() rule so scaled in-process tests can use shorter leases.
 */
export function resolveLeaseRenewIntervalMs(config: Pick<WorkerConfig, 'leaseDurationMs' | 'leaseRenewIntervalMs'>): number {
  const leaseMs = config.leaseDurationMs
  if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) {
    throw new RangeError('leaseDurationMs must be a positive integer')
  }
  const configured = (config as {leaseRenewIntervalMs?: unknown}).leaseRenewIntervalMs
  if (configured === undefined) return Math.max(1, Math.floor(leaseMs / 3))
  if (typeof configured !== 'number' || !Number.isSafeInteger(configured) || configured <= 0 || configured * 2 > leaseMs) {
    throw new RangeError('leaseRenewIntervalMs must be a positive integer of at most half of leaseDurationMs')
  }
  return configured
}
