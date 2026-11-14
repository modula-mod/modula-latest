import {createHash} from 'node:crypto'
import {sql, type Selectable, type Transaction} from 'kysely'
import type {ModulaWorkerDb} from '../database.js'
import type {Database} from '../database.js'

export type ClaimedJob = Selectable<Database['background_jobs']>

/**
 * Atomically claims the next eligible Greenfield-worker job using row-level locking so
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
      status = 'LEASED',
      lease_owner = ${workerId},
      lease_expires_at = ${leaseExpiresAt},
      attempt_count = attempt_count + 1,
      updated_at = ${now}
    WHERE id = (
      SELECT id
      FROM background_jobs
      WHERE dispatch_mode = 'GREENFIELD_WORKER'
        AND status IN ('QUEUED', 'RETRYING')
        AND available_at <= ${now}
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
 * crashed mid-job). Exhausted jobs are dead-lettered without retaining their
 * payload; the rest enter the explicit RETRYING state.
 */
export async function reapExpiredLeases(db: ModulaWorkerDb, now: Date = new Date()): Promise<number> {
  return db.transaction().execute(async trx => {
    const expired = await trx
      .selectFrom('background_jobs')
      .selectAll()
      .where('dispatch_mode', '=', 'GREENFIELD_WORKER')
      .where('status', 'in', ['LEASED', 'RUNNING'])
      .where('lease_expires_at', '<=', now)
      .orderBy('lease_expires_at')
      .limit(100)
      .forUpdate()
      .skipLocked()
      .execute()
    for (const job of expired) {
      const exhausted = job.attempt_count >= job.maximum_attempts
      const failureMessage = 'Worker lease expired before job completion'
      await trx
        .updateTable('background_jobs')
        .set({
          status: exhausted ? 'DEAD_LETTER' : 'RETRYING',
          available_at: now,
          lease_owner: null,
          lease_expires_at: null,
          last_error: failureMessage,
          error_class: 'WORKER_LEASE_EXPIRED',
          error_code: 'WORKER_LEASE_EXPIRED',
          finished_at: exhausted ? now : null,
          completed_at: exhausted ? now : null,
          updated_at: now,
        })
        .where('id', '=', job.id)
        .execute()
      if (exhausted) await insertRedactedFailure(trx, job, 'WORKER_LEASE_EXPIRED', failureMessage, false, now)
    }
    return expired.length
  })
}

export async function markJobRunning(
  db: ModulaWorkerDb,
  jobId: string,
  workerId: string,
  now: Date = new Date(),
): Promise<void> {
  const row = await db
    .updateTable('background_jobs')
    .set({status: 'RUNNING', started_at: now, updated_at: now})
    .where('id', '=', jobId)
    .where('status', '=', 'LEASED')
    .where('lease_owner', '=', workerId)
    .returning('id')
    .executeTakeFirst()
  if (!row) throw Object.assign(new Error('Job lease is no longer owned by this worker'), {code: 'JOB_LEASE_LOST'})
}

/**
 * GF-OPS-01(c): extends the lease of a job this worker has claimed (LEASED) or
 * is running (RUNNING).
 *
 * The row must still be LEASED or RUNNING and leased to `workerId` (the same
 * ownership guard as markJobRunning/completeJob/scheduleRetry/deadLetterJob).
 * Once the reaper has moved the job to RETRYING/DEAD_LETTER (clearing
 * lease_owner) or another worker has claimed it, no row matches and this
 * returns false, so a renewal can never take a reclaimed job back. It never changes status, attempts or payload.
 */
export async function renewJobLease(
  db: ModulaWorkerDb,
  jobId: string,
  workerId: string,
  leaseDurationMs: number,
  now: Date = new Date(),
): Promise<boolean> {
  const row = await db
    .updateTable('background_jobs')
    .set({lease_expires_at: new Date(now.getTime() + leaseDurationMs), updated_at: now})
    .where('id', '=', jobId)
    .where('status', 'in', ['LEASED', 'RUNNING'])
    .where('lease_owner', '=', workerId)
    .returning('id')
    .executeTakeFirst()
  return Boolean(row)
}

export async function completeJob(db: ModulaWorkerDb, jobId: string, workerId: string, now: Date = new Date()): Promise<void> {
  const row = await db
    .updateTable('background_jobs')
    .set({
      status: 'SUCCEEDED',
      completed_at: now,
      finished_at: now,
      last_error: null,
      error_class: null,
      error_code: null,
      updated_at: now,
      lease_owner: null,
      lease_expires_at: null,
    })
    .where('id', '=', jobId)
    .where('status', '=', 'RUNNING')
    .where('lease_owner', '=', workerId)
    .returning('id')
    .executeTakeFirst()
  assertLeaseTransition(row, jobId, workerId)
}

export async function scheduleRetry(
  db: ModulaWorkerDb,
  jobId: string,
  workerId: string,
  availableAt: Date,
  errorCode: string,
  lastError: string,
  now: Date = new Date(),
): Promise<void> {
  const row = await db
    .updateTable('background_jobs')
    .set({
      status: 'RETRYING',
      available_at: availableAt,
      last_error: safeFailureMessage(lastError),
      error_class: boundedErrorCode(errorCode),
      error_code: boundedErrorCode(errorCode),
      lease_owner: null,
      lease_expires_at: null,
      updated_at: now,
    })
    .where('id', '=', jobId)
    .where('status', '=', 'RUNNING')
    .where('lease_owner', '=', workerId)
    .returning('id')
    .executeTakeFirst()
  assertLeaseTransition(row, jobId, workerId)
}

export async function deadLetterJob(
  db: ModulaWorkerDb,
  job: ClaimedJob,
  workerId: string,
  errorCode: string,
  errorMessage: string,
  permanent: boolean,
  now: Date = new Date(),
): Promise<void> {
  await db.transaction().execute(async trx => {
    const row = await trx
      .updateTable('background_jobs')
      .set({
        status: permanent ? 'FAILED' : 'DEAD_LETTER',
        last_error: safeFailureMessage(errorMessage),
        error_class: boundedErrorCode(errorCode),
        error_code: boundedErrorCode(errorCode),
        finished_at: now,
        completed_at: now,
        lease_owner: null,
        lease_expires_at: null,
        updated_at: now,
      })
      .where('id', '=', job.id)
      .where('status', '=', 'RUNNING')
      .where('lease_owner', '=', workerId)
      .returning('id')
      .executeTakeFirst()

    assertLeaseTransition(row, job.id, workerId)

    await insertRedactedFailure(trx, job, errorCode, errorMessage, permanent, now)
  })
}

function assertLeaseTransition(row: {id: string} | undefined, jobId: string, workerId: string): void {
  if (!row) {
    throw Object.assign(new Error(`Job lease is no longer owned by worker ${workerId}`), {
      code: 'JOB_LEASE_LOST',
      jobId,
    })
  }
}

type JobTransaction = Transaction<Database>

async function insertRedactedFailure(
  trx: JobTransaction,
  job: ClaimedJob,
  errorCode: string,
  errorMessage: string,
  permanent: boolean,
  now: Date,
): Promise<void> {
  await trx
    .insertInto('job_failures')
    .values({
      id: `jf_${job.id}_${job.attempt_count}`,
      job_id: job.id,
      job_type: job.job_type,
      payload: {},
      payload_fingerprint: `sha256:${createHash('sha256').update(JSON.stringify(job.payload ?? null)).digest('hex')}`,
      error_code: boundedErrorCode(errorCode),
      error_class: boundedErrorCode(errorCode),
      error_message: safeFailureMessage(errorMessage),
      permanent,
      created_at: now,
    })
    .onConflict(conflict => conflict.column('id').doNothing())
    .execute()
}

function boundedErrorCode(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 120)
  return normalized || 'UNKNOWN_ERROR'
}

function safeFailureMessage(value: string): string {
  const bounded = value.replace(/[\r\n\t]+/g, ' ').slice(0, 320)
  return /(?:bearer\s+|api[_-]?key|secret|password|token|credential|sk-[a-z0-9])/i.test(bounded)
    ? 'Job failed; sensitive failure detail redacted'
    : bounded || 'Job failed without a safe error detail'
}
