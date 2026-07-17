import {randomUUID} from 'node:crypto'
import type {WorkerDb} from '../database.js'
import {handleAtprotoDelete} from '../atproto/delete.js'
import {handleAtprotoProfilePublish} from '../atproto/profile.js'
import {handleAtprotoPublish} from '../atproto/publish.js'
import {handleAtprotoUpdate} from '../atproto/update.js'
import {handleNotificationCreate} from '../notifications/create.js'
import {handleSearchIndex} from '../search/index.js'
import {claimNextJob} from './claim.js'
import {isPermanentError, nextAvailableAt} from './retry.js'

export async function processOneJob(db: WorkerDb, workerId: string, leaseSeconds: number): Promise<boolean> {
  const job = await claimNextJob(db, workerId, leaseSeconds * 1000)
  if (!job) return false
  const payload =
    job.payload && typeof job.payload === 'object' ? (job.payload as Record<string, unknown>) : {}
  try {
    switch (job.job_type) {
      case 'notification.create':
        await handleNotificationCreate(db, payload)
        break
      case 'search.index':
        await handleSearchIndex(db, payload)
        break
      case 'atproto.publish':
        await handleAtprotoPublish(db, payload)
        break
      case 'atproto.update':
        await handleAtprotoUpdate(db, payload)
        break
      case 'atproto.delete':
        await handleAtprotoDelete(db, payload)
        break
      case 'atproto.profile.publish':
        await handleAtprotoProfilePublish(db, payload)
        break
      case 'audit.checkpoint':
        break
      default:
        throw Object.assign(new Error(`Unsupported job type ${job.job_type}`), {
          code: 'UNSUPPORTED_RECORD_TYPE',
        })
    }
    await db
      .updateTable('background_jobs')
      .set({
        status: 'completed',
        completed_at: new Date(),
        updated_at: new Date(),
        lease_owner: null,
        lease_expires_at: null,
      })
      .where('id', '=', job.id)
      .execute()
  } catch (error: any) {
    const code = String(error?.code ?? 'SERVER_ERROR')
    const message = String(error?.message ?? 'job failed')
    const permanent = isPermanentError(code) || job.attempt_count >= job.maximum_attempts
    await db
      .insertInto('job_failures')
      .values({
        id: randomUUID(),
        job_id: job.id,
        job_type: job.job_type,
        payload,
        error_code: code,
        error_message: message,
        permanent,
        created_at: new Date(),
      })
      .execute()
    if (permanent) {
      await db
        .updateTable('background_jobs')
        .set({
          status: 'dead_letter',
          last_error: message,
          updated_at: new Date(),
          lease_owner: null,
          lease_expires_at: null,
        })
        .where('id', '=', job.id)
        .execute()
      await db
        .insertInto('atproto_dead_letters')
        .values({
          id: randomUUID(),
          source: job.job_type,
          payload,
          error_code: code,
          error_message: message,
          created_at: new Date(),
          resolved_at: null,
        })
        .execute()
    } else {
      await db
        .updateTable('background_jobs')
        .set({
          status: 'pending',
          available_at: nextAvailableAt(job.attempt_count),
          last_error: message,
          updated_at: new Date(),
          lease_owner: null,
          lease_expires_at: null,
        })
        .where('id', '=', job.id)
        .execute()
    }
  }
  return true
}
