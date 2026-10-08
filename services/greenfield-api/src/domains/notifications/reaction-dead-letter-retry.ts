import type {ModulaDb} from '../../database/client.js'
import {AuditRepository} from '../audit/repository.js'

const HISTORICAL_REACTION_CONSTRAINT = 'notifications_recipient_dedupe_uidx'

/** Requeues only the historical reaction/notification uniqueness failure. */
export async function retryReactionNotificationDeadLetter(
  db: ModulaDb,
  jobId: string,
  operatorActorId: string,
  operatorContext: {reason?: string; requestId?: string; correlationId?: string} = {},
): Promise<{jobId: string; status: 'RETRYING'}> {
  return db.transaction().execute(async trx => {
    const job = await trx.selectFrom('background_jobs')
      .select(['id', 'job_type', 'dispatch_mode', 'status', 'error_code'])
      .where('id', '=', jobId)
      .forUpdate()
      .executeTakeFirst()
    if (!job || job.job_type !== 'notification.reaction' || job.dispatch_mode !== 'GREENFIELD_WORKER') {
      throw Object.assign(new Error('Reaction notification dead letter not found'), {code: 'NOT_FOUND'})
    }
    if (job.status !== 'DEAD_LETTER' || job.error_code !== '23505') {
      throw Object.assign(new Error('Job is not an affected reaction notification dead letter'), {code: 'CONFLICT'})
    }
    const failure = await trx.selectFrom('job_failures')
      .select(['id', 'error_code', 'error_message'])
      .where('job_id', '=', jobId)
      .where('job_type', '=', 'notification.reaction')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .executeTakeFirst()
    if (failure?.error_code !== '23505' || !failure.error_message.includes(HISTORICAL_REACTION_CONSTRAINT)) {
      throw Object.assign(new Error('Matching failure evidence is missing'), {code: 'CONFLICT'})
    }

    const now = new Date()
    await trx.updateTable('background_jobs').set({
      status: 'RETRYING',
      available_at: now,
      attempt_count: 0,
      lease_owner: null,
      lease_expires_at: null,
      started_at: null,
      completed_at: null,
      finished_at: null,
      last_error: null,
      error_class: null,
      error_code: null,
      updated_at: now,
    }).where('id', '=', jobId).execute()
    await new AuditRepository(trx).append('admin.notification.reaction_dead_letter.retried', {
      jobId,
      originalFailureId: failure.id,
      reason: operatorContext.reason ?? 'verified historical reaction-notification collision replay',
      matchedConstraint: HISTORICAL_REACTION_CONSTRAINT,
    }, {type: 'job', id: jobId, actorId: operatorActorId}, {
      requestId: operatorContext.requestId,
      correlationId: operatorContext.correlationId,
    })
    return {jobId, status: 'RETRYING' as const}
  })
}
