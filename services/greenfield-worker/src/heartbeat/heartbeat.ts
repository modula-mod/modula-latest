import type {Kysely} from 'kysely'
import type {Database} from '../database.js'

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
