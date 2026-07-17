import type {WorkerConfig} from '../config.js'
import type {ModulaWorkerDb} from '../database.js'
import {handleAtprotoDelete} from '../bridges/atproto/delete.js'
import {handleAtprotoProfilePublish} from '../bridges/atproto/profile.js'
import {handleAtprotoPublish} from '../bridges/atproto/publish.js'
import {handleAtprotoUpdate} from '../bridges/atproto/update.js'
import {handleNotificationCreate} from '../notifications/create.js'
import {handleSearchIndex} from '../search/index.js'
import {claimNextJob, completeJob, deadLetterJob, scheduleRetry} from './claim.js'
import {errorCodeFor, isPermanentFailure, messageFor} from './errors.js'
import {computeNextAvailableAt} from './retry.js'

export async function processOneJob(db: ModulaWorkerDb, config: WorkerConfig): Promise<boolean> {
  const job = await claimNextJob(db, config.workerId, config.leaseDurationMs)
  if (!job) return false

  try {
    switch (job.job_type) {
      case 'notification.create':
        await handleNotificationCreate(db, job.payload)
        break
      case 'search.index':
      case 'search.index.post':
      case 'search.index.profile':
        await handleSearchIndex(db, normalizeSearchPayload(job.job_type, job.payload))
        break
      case 'atproto.publish':
      case 'atproto.publish.create':
        await handleAtprotoPublish(db, config, job.payload)
        break
      case 'atproto.update':
      case 'atproto.publish.update':
        await handleAtprotoUpdate(db, config, job.payload)
        break
      case 'atproto.delete':
      case 'atproto.publish.delete':
        await handleAtprotoDelete(db, config, job.payload)
        break
      case 'atproto.profile.publish':
        await handleAtprotoProfilePublish(db, config, job.payload)
        break
      case 'audit.checkpoint':
        break
      default:
        throw Object.assign(new Error(`Unsupported job type ${job.job_type}`), {
          code: 'UNSUPPORTED_RECORD_TYPE',
        })
    }
    await completeJob(db, job.id)
  } catch (error: unknown) {
    const code = errorCodeFor(error)
    const message = messageFor(error)
    const permanent = isPermanentFailure(error) || job.attempt_count >= job.maximum_attempts
    if (permanent) {
      await deadLetterJob(db, job, code, message, true)
    } else {
      await scheduleRetry(db, job.id, computeNextAvailableAt(job.attempt_count + 1), message)
    }
  }
  return true
}

function normalizeSearchPayload(jobType: string, payload: unknown): unknown {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (record.resourceType && record.resourceId) return payload
    if (typeof record.postId === 'string') {
      return {resourceType: 'post', resourceId: record.postId}
    }
    if (typeof record.profileId === 'string') {
      return {resourceType: 'profile', resourceId: record.profileId}
    }
  }
  if (jobType === 'search.index.profile') {
    return {resourceType: 'profile', resourceId: 'unknown'}
  }
  return {resourceType: 'post', resourceId: 'unknown'}
}
