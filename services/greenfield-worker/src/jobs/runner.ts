import type {WorkerConfig} from '../config.js'
import type {ModulaWorkerDb} from '../database.js'
import {handleAtprotoDelete} from '../bridges/atproto/delete.js'
import {handleAtprotoProfilePublish} from '../bridges/atproto/profile.js'
import {handleAtprotoPublish} from '../bridges/atproto/publish.js'
import {handleAtprotoUpdate} from '../bridges/atproto/update.js'
import {handlePluginLifecycle} from '../extensions/plugin-lifecycle.js'
import {handleFunctionInvoke} from '../functions/invoke.js'
import {handleMailDeliver} from '../mail/handler.js'
import {handleMailIdentityForward, handleMailIdentityProvision} from '../mail/provisioner.js'
import {handleModuleDisable} from '../modules/disable-handler.js'
import {handleModuleEnable} from '../modules/enable-handler.js'
import {handleModuleInstall} from '../modules/installation-handler.js'
import {handleModulePluginLifecycle} from '../modules/plugin-lifecycle-handler.js'
import {handleModuleGithubJob, handleModuleRegistrySync} from '../modules/registry-sync-handler.js'
import {handleModuleReleasePublish, handleModuleReleaseVerify} from '../modules/release-verification-handler.js'
import {registerModuleContributions, unregisterModuleContributions} from '../modules/contribution-registration-handler.js'
import {registerModuleSchemas, unregisterModuleSchemas} from '../modules/schema-registration-handler.js'
import {handleModuleUninstall} from '../modules/uninstall-handler.js'
import {handleModuleUpdate} from '../modules/update-handler.js'
import {handleExtensionJob} from '../modules/extension-job-handler.js'
import {handleExtensionEventDispatch} from '../modules/extension-event-handler.js'
import {handleNotificationCreate} from '../notifications/create.js'
import {handleSocialNotification} from '../notifications/social.js'
import {handleSearchIndex, handleSearchReindex} from '../search/index.js'
import {claimNextJob, completeJob, deadLetterJob, markJobRunning, renewJobLease, scheduleRetry} from './claim.js'
import {errorCodeFor, isPermanentFailure, messageFor} from './errors.js'
import {computeNextAvailableAt} from './retry.js'
import {metrics} from '../observability/metrics.js'
import {startPeriodic, type PeriodicTask} from '../timers/periodic.js'

/** Structured log sink for lease events; fields never include payloads or connection strings. */
export type JobRunnerLog = {
  warn(fields: Record<string, unknown>, message: string): void
  error(fields: Record<string, unknown>, message: string): void
}

export type ProcessJobOptions = {log?: JobRunnerLog}

export async function processOneJob(db: ModulaWorkerDb, config: WorkerConfig, options: ProcessJobOptions = {}): Promise<boolean> {
  const job = await claimNextJob(db, config.workerId, config.leaseDurationMs)
  if (!job) return false
  metrics.increment('jobsClaimed')
  const log = options.log
  // GF-OPS-01(c): the lease is renewed on its own timer while the handler runs,
  // so a job longer than leaseDurationMs is not reaped and re-claimed mid-run.
  let leaseLost = false
  let renewal: PeriodicTask | null = null

  try {
    await markJobRunning(db, job.id, config.workerId)
    renewal = startPeriodic(async () => {
      try {
        if (await renewJobLease(db, job.id, config.workerId, config.leaseDurationMs)) {
          metrics.increment('jobLeaseRenewals')
          return
        }
        leaseLost = true
        void renewal?.stop()
        log?.warn({operation: 'job.lease.renew', jobId: job.id, jobType: job.job_type}, 'job lease lost while running; renewal stopped')
      } catch (error) {
        // A transient renewal failure is not a lost lease: keep the job and try
        // again on the next tick. Only safe error fields are logged.
        log?.error({operation: 'job.lease.renew', jobId: job.id, jobType: job.job_type, error: safeError(error)}, 'job lease renewal failed')
      }
    }, config.leaseRenewIntervalMs)
    await withTimeout((async () => {
      switch (job.job_type) {
      case 'notification.create':
        await handleNotificationCreate(db, job.payload)
        break
      case 'notification.reaction':
        await handleSocialNotification(db, 'reaction', job.payload)
        break
      case 'notification.comment':
        await handleSocialNotification(db, 'comment', job.payload)
        break
      case 'notification.reply':
        await handleSocialNotification(db, 'reply', job.payload)
        break
      case 'notification.mention':
        await handleSocialNotification(db, 'mention', job.payload)
        break
      case 'notification.repost':
        await handleSocialNotification(db, 'repost', job.payload)
        break
      case 'notification.quote':
        await handleSocialNotification(db, 'quote', job.payload)
        break
      case 'notification.follow':
        await handleSocialNotification(db, 'follow', job.payload)
        break
      case 'extension.notification':
        await handleSocialNotification(db, 'extension', job.payload)
        break
      case 'plugin.install':
      case 'plugin.enable':
      case 'plugin.disable':
      case 'plugin.configure':
      case 'plugin.uninstall':
        await handlePluginLifecycle(db, job.job_type, withBackgroundJobId(job.payload, job.id))
        break
      case 'function.invoke':
        await handleFunctionInvoke(db, job.payload)
        break
      case 'mail.deliver':
        await handleMailDeliver(db, config, job.payload)
        break
      case 'mail.identity.provision':
        await handleMailIdentityProvision(db, config, job.payload)
        break
      case 'mail.identity.forward':
        await handleMailIdentityForward(db, config, job.payload)
        break
      case 'module.registry.sync':
        await handleModuleRegistrySync(db, config, job.payload)
        break
      case 'module.github.syncRepository':
      case 'module.github.fetchManifest':
      case 'module.github.fetchLicenseEvidence':
      case 'module.github.fetchReleaseMetadata':
      case 'module.github.verifyCommit':
      case 'module.github.verifyReleaseIntegrity':
        await handleModuleGithubJob(db, config, job.payload)
        break
      case 'module.discovered':
      case 'module.release.imported':
      case 'module.release.verified':
      case 'module.release.published':
      case 'module.release.quarantined':
      case 'module.release.revoked':
      case 'module.install.requested':
      case 'module.installed':
      case 'module.enable.requested':
      case 'module.enabled':
      case 'module.disable.requested':
      case 'module.disabled':
      case 'module.update.requested':
      case 'module.updated':
      case 'module.uninstall.requested':
      case 'module.uninstalled':
      case 'module.failed':
        break
      case 'module.release.verify':
        await handleModuleReleaseVerify(db, config, job.payload)
        break
      case 'module.release.publish':
        await handleModuleReleasePublish(db, config, job.payload)
        break
      case 'module.install':
        await handleModuleInstall(db, config, job.payload)
        break
      case 'module.enable':
        await handleModuleEnable(db, config, job.payload)
        break
      case 'module.disable':
        await handleModuleDisable(db, job.payload)
        break
      case 'module.update':
        await handleModuleUpdate(db, config, job.payload)
        break
      case 'module.uninstall':
        await handleModuleUninstall(db, job.payload)
        break
      case 'module.schemas.register':
        await registerModuleSchemas(db, (job.payload as any)?.releaseId)
        break
      case 'module.schemas.unregister':
        await unregisterModuleSchemas(db, (job.payload as any)?.releaseId)
        break
      case 'module.settings.migrate':
        break
      case 'module.contributions.register':
        await registerModuleContributions(db, (job.payload as any)?.releaseId, (job.payload as any)?.extensionVersionId, {enableExecutable: false})
        break
      case 'module.contributions.unregister':
        await unregisterModuleContributions(db, (job.payload as any)?.releaseId)
        break
      case 'module.plugin.install':
      case 'module.plugin.enable':
      case 'module.plugin.disable':
      case 'module.plugin.uninstall':
        await handleModulePluginLifecycle(db, config, job.payload)
        break
      case 'extension.job.execute':
        await handleExtensionJob(db, job.payload)
        break
      case 'extension.event.dispatch':
        await handleExtensionEventDispatch(db, job.payload)
        break
      case 'search.index':
      case 'search.index.post':
      case 'search.index.profile':
        await handleSearchIndex(db, normalizeSearchPayload(job.job_type, job.payload))
        break
      case 'search.reindex':
        await handleSearchReindex(db, job.payload)
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
    })(), job.timeout_ms)
    await renewal.stop()
    if (leaseLost) return leaseLostOutcome(log, job.id, job.job_type)
    await completeJob(db, job.id, config.workerId)
    metrics.increment('jobsCompleted')
  } catch (error: unknown) {
    await renewal?.stop()
    // The job now belongs to the reaper or another worker. Recording an outcome
    // here would double-complete it, and this worker must not retry it itself:
    // the existing claim semantics (reap -> RETRYING -> re-claim) own it now.
    if (leaseLost || errorCodeFor(error) === 'JOB_LEASE_LOST') return leaseLostOutcome(log, job.id, job.job_type)
    const code = errorCodeFor(error)
    const message = messageFor(error)
    const permanent = isPermanentFailure(error)
    const exhausted = job.attempt_count >= job.maximum_attempts
    if (permanent || exhausted) {
      await deadLetterJob(db, job, config.workerId, code, message, permanent)
      metrics.increment('jobsDeadLettered')
    } else {
      await scheduleRetry(db, job.id, config.workerId, computeNextAvailableAt(job.attempt_count + 1), code, message)
      metrics.increment('jobsRetried')
    }
  }
  return true
}

function leaseLostOutcome(log: JobRunnerLog | undefined, jobId: string, jobType: string): true {
  metrics.increment('jobLeasesLost')
  log?.warn({operation: 'job.lease.lost', jobId, jobType}, 'job lease lost; outcome not recorded by this worker')
  return true
}

function safeError(error: unknown): {name: string; code: string | null} {
  const name = error instanceof Error ? error.name : 'UnknownError'
  const code = error && typeof error === 'object' && typeof (error as {code?: unknown}).code === 'string' ? (error as {code: string}).code : null
  return {name, code}
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('Job execution exceeded its declared timeout'), {code: 'JOB_TIMEOUT'})), timeoutMs)
  })
  try {
    return await Promise.race([operation, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function withBackgroundJobId(payload: unknown, backgroundJobId: string): unknown {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload
  return {...payload, backgroundJobId}
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
