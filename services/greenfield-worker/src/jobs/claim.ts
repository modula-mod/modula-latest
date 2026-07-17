import {sql} from 'kysely'
import type {ModulaWorkerDb} from '../database.js'
import type {Database} from '../database.js'

export type ClaimedJob = Database['background_jobs']

/**
 * Atomically claims the next eligible pending job using row-level locking so
 * multiple worker processes can run concurrently without double-processing.
 * `FOR UPDATE SKIP LOCKED` guarantees lease exclusivity: a row already locked
 * by another worker's in-flight claim is simply skipped, not waited on.
 */
export async function claimNextJob(
  db: ModulaWorkerDb,
  workerId: string,
  leaseDurationMs: number,
): Promise<ClaimedJob | undefined> {
  const now = new Date()
  const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs)

  const result = await sql<ClaimedJob>`
    UPDATE background_jobs
    SET
      status = 'leased',
      lease_owner = ${workerId},
      lease_expires_at = ${leaseExpiresAt},
      attempt_count = attempt_count + 1,
      updated_at = ${now}
    WHERE id = (
      SELECT id
      FROM background_jobs
      WHERE status = 'pending' AND available_at <= ${now}
      ORDER BY priority, created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `.execute(db)

  return result.rows[0]
}

/**
 * Reclaims jobs whose lease has expired without being completed (worker
 * crashed mid-job). Returns them to `pending` so another worker can claim
 * them; does not touch attempt_count (the crash doesn't count as a handler
 * failure) but future claims will still increment it as normal.
 */
export async function reapExpiredLeases(db: ModulaWorkerDb, now: Date = new Date()): Promise<number> {
  const result = await sql`
    UPDATE background_jobs
    SET status = 'pending', lease_owner = NULL, lease_expires_at = NULL, updated_at = ${now}
    WHERE status = 'leased' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ${now}
  `.execute(db)

  return Number(result.numAffectedRows ?? 0n)
}

export async function completeJob(db: ModulaWorkerDb, jobId: string, now: Date = new Date()): Promise<void> {
  await db
    .updateTable('background_jobs')
    .set({status: 'completed', completed_at: now, updated_at: now, lease_owner: null, lease_expires_at: null})
    .where('id', '=', jobId)
    .execute()
}

export async function scheduleRetry(
  db: ModulaWorkerDb,
  jobId: string,
  availableAt: Date,
  lastError: string,
  now: Date = new Date(),
): Promise<void> {
  await db
    .updateTable('background_jobs')
    .set({
      status: 'pending',
      available_at: availableAt,
      last_error: lastError,
      lease_owner: null,
      lease_expires_at: null,
      updated_at: now,
    })
    .where('id', '=', jobId)
    .execute()
}

export async function deadLetterJob(
  db: ModulaWorkerDb,
  job: ClaimedJob,
  errorCode: string,
  errorMessage: string,
  permanent: boolean,
  now: Date = new Date(),
): Promise<void> {
  await db.transaction().execute(async trx => {
    await trx
      .updateTable('background_jobs')
      .set({
        status: 'dead_letter',
        last_error: errorMessage,
        lease_owner: null,
        lease_expires_at: null,
        updated_at: now,
      })
      .where('id', '=', job.id)
      .execute()

    await trx
      .insertInto('job_failures')
      .values({
        id: `jf_${job.id}_${now.getTime()}`,
        job_id: job.id,
        job_type: job.job_type,
        payload: job.payload as never,
        error_code: errorCode,
        error_message: errorMessage,
        permanent,
        created_at: now,
      })
      .execute()
  })
}
