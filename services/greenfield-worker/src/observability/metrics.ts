/**
 * Minimal in-process counters for the worker loop. Intentionally dependency-free
 * (no Prometheus client) — logged periodically via pino so preview/production
 * hosts can scrape logs without adding a metrics exporter dependency.
 */
export interface MetricsSnapshot {
  jobsClaimed: number
  jobsCompleted: number
  jobsRetried: number
  jobsDeadLettered: number
  outboxDrained: number
  ingestRuns: number
  ingestErrors: number
  mediaCleanupRuns: number
  mediaCleanupErrors: number
  mediaCleanupExpiredSessions: number
  mediaCleanupRemovedAttachments: number
  mediaCleanupDryRunCandidates: number
}

class WorkerMetrics {
  private snapshot: MetricsSnapshot = {
    jobsClaimed: 0,
    jobsCompleted: 0,
    jobsRetried: 0,
    jobsDeadLettered: 0,
    outboxDrained: 0,
    ingestRuns: 0,
    ingestErrors: 0,
    mediaCleanupRuns: 0,
    mediaCleanupErrors: 0,
    mediaCleanupExpiredSessions: 0,
    mediaCleanupRemovedAttachments: 0,
    mediaCleanupDryRunCandidates: 0,
  }

  increment(key: keyof MetricsSnapshot, by = 1): void {
    this.snapshot[key] += by
  }

  read(): MetricsSnapshot {
    return {...this.snapshot}
  }

  reset(): void {
    for (const key of Object.keys(this.snapshot) as (keyof MetricsSnapshot)[]) {
      this.snapshot[key] = 0
    }
  }
}

export const metrics = new WorkerMetrics()
