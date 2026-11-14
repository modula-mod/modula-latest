import type {Kysely} from 'kysely'
import type {Database} from '../database.js'
import {startPeriodic, type PeriodicTask} from '../timers/periodic.js'

export const HEARTBEAT_INTERVAL_MS = 15_000

/**
 * Records that this worker process is alive so Greenfield's public status can
 * report real background-processing health. Failures are swallowed: liveness
 * reporting must never stop the worker from processing jobs.
 */
export async function recordHeartbeat(
  db: Kysely<Database>,
  input: {workerId: string; releaseSha: string | null; startedAt: Date; now?: Date},
): Promise<boolean> {
  const now = input.now ?? new Date()
  try {
    await db
      .insertInto('greenfield_worker_heartbeats')
      .values({worker_id: input.workerId.slice(0, 160), release_sha: input.releaseSha?.slice(0, 80) ?? null, started_at: input.startedAt, last_seen_at: now})
      .onConflict(oc => oc.column('worker_id').doUpdateSet({release_sha: input.releaseSha?.slice(0, 80) ?? null, started_at: input.startedAt, last_seen_at: now}))
      .execute()
    return true
  } catch {
    return false
  }
}

export function heartbeatDue(lastBeatAt: number, now: number, intervalMs = HEARTBEAT_INTERVAL_MS): boolean {
  return now - lastBeatAt >= intervalMs
}

/**
 * GF-OPS-01(c): writes the heartbeat on its own timer so a long-running job in
 * the main loop can no longer let `last_seen_at` age past the health threshold.
 * Writes never overlap, a failed write is reported through `onFailure` (no
 * error detail, so no connection string can reach the logs) and never throws,
 * and the returned task must be stopped on shutdown before the pool closes.
 */
export function startHeartbeat(
  db: Kysely<Database>,
  input: {
    workerId: string
    releaseSha: string | null
    startedAt: Date
    intervalMs?: number
    onFailure?: () => void
  },
): PeriodicTask {
  return startPeriodic(
    async () => {
      const ok = await recordHeartbeat(db, {workerId: input.workerId, releaseSha: input.releaseSha, startedAt: input.startedAt})
      if (!ok) input.onFailure?.()
    },
    input.intervalMs ?? HEARTBEAT_INTERVAL_MS,
    {runImmediately: true},
  )
}
