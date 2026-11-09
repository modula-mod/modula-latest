import {sql} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import {RELEASE_JOB_DISPATCH_MODE, RELEASE_JOB_PUBLISH, RELEASE_JOB_VALIDATE} from './release-job-core.js'
import type {PublisherReleaseJobProcessor} from './release-job-processor.js'

type ClaimedRow = {id: string; job_type: string; payload: unknown; attempt_count: number; maximum_attempts: number}

/**
 * Consumer for publisher release console work on the existing background_jobs
 * queue. Claims only dispatch_mode = PUBLISHER_RELEASE_RUNNER rows (the generic
 * greenfield-worker claims only GREENFIELD_WORKER rows), using the same
 * FOR UPDATE SKIP LOCKED lease pattern as greenfield-worker/src/jobs/claim.ts.
 */
export class PublisherReleaseJobRunner {
  constructor(private readonly db: ModulaDb, private readonly processor: PublisherReleaseJobProcessor, private readonly options: {workerId: string; leaseMs?: number}) {}

  async reapExpiredLeases(now = new Date()): Promise<number> {
    const result = await sql`
      UPDATE background_jobs SET status = CASE WHEN attempt_count >= maximum_attempts THEN 'DEAD_LETTER' ELSE 'RETRYING' END,
        lease_owner = NULL, lease_expires_at = NULL, available_at = ${now}, updated_at = ${now},
        error_code = 'WORKER_LEASE_EXPIRED', error_class = 'WORKER_LEASE_EXPIRED', last_error = 'Runner lease expired before completion'
      WHERE dispatch_mode = ${RELEASE_JOB_DISPATCH_MODE} AND status IN ('LEASED', 'RUNNING') AND lease_expires_at <= ${now}
    `.execute(this.db)
    return Number(result.numAffectedRows ?? 0)
  }

  /** Processes at most one queued work item. Returns false when the queue is empty. */
  async runOnce(): Promise<boolean> {
    const now = new Date()
    const leaseExpiresAt = new Date(now.getTime() + (this.options.leaseMs ?? 10 * 60_000))
    const claimed = (await sql<ClaimedRow>`
      UPDATE background_jobs SET status = 'RUNNING', lease_owner = ${this.options.workerId}, lease_expires_at = ${leaseExpiresAt},
        attempt_count = attempt_count + 1, started_at = ${now}, updated_at = ${now}
      WHERE id = (
        SELECT id FROM background_jobs
        WHERE dispatch_mode = ${RELEASE_JOB_DISPATCH_MODE} AND status IN ('QUEUED', 'RETRYING') AND available_at <= ${now}
        ORDER BY priority, created_at FOR UPDATE SKIP LOCKED LIMIT 1
      )
      RETURNING id, job_type, payload, attempt_count, maximum_attempts
    `.execute(this.db)).rows[0]
    if (!claimed) return false
    const releaseJobId = String((claimed.payload as {releaseJobId?: unknown})?.releaseJobId ?? '')
    try {
      if (claimed.job_type === RELEASE_JOB_VALIDATE) await this.processor.validate(releaseJobId)
      else if (claimed.job_type === RELEASE_JOB_PUBLISH) await this.processor.publish(releaseJobId)
      else throw Object.assign(new Error(`Unknown publisher release work ${claimed.job_type}`), {permanent: true})
      await this.settle(claimed.id, 'SUCCEEDED', null)
    } catch (error) {
      const message = (error as Error)?.message?.slice(0, 300) || 'runner failure'
      const exhausted = claimed.attempt_count >= claimed.maximum_attempts || (error as {permanent?: boolean})?.permanent === true
      if (exhausted) {
        await this.processor.markExhausted(releaseJobId, message).catch(() => undefined)
        await this.settle(claimed.id, 'DEAD_LETTER', message)
      } else {
        const delay = Math.min(5 * 60_000, 15_000 * 2 ** (claimed.attempt_count - 1))
        await this.db.updateTable('background_jobs').set({
          status: 'RETRYING', lease_owner: null, lease_expires_at: null, available_at: new Date(Date.now() + delay),
          last_error: message, error_code: 'PUBLISHER_RELEASE_RETRY', error_class: 'PUBLISHER_RELEASE_RETRY', updated_at: new Date(),
        } as never).where('id', '=', claimed.id).where('lease_owner', '=', this.options.workerId).execute()
      }
    }
    return true
  }

  private async settle(id: string, status: 'SUCCEEDED' | 'DEAD_LETTER', message: string | null) {
    const now = new Date()
    await this.db.updateTable('background_jobs').set({
      status, lease_owner: null, lease_expires_at: null, finished_at: now, completed_at: now, updated_at: now,
      last_error: message, error_code: message ? 'PUBLISHER_RELEASE_FAILED' : null, error_class: message ? 'PUBLISHER_RELEASE_FAILED' : null,
    } as never).where('id', '=', id).where('lease_owner', '=', this.options.workerId).execute()
  }
}
