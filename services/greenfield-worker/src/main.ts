import {loadConfig} from './config.js'
import {createDb} from './database.js'
import {processOneJob} from './jobs/runner.js'
import {processOneEventDelivery} from './events/runner.js'
import {createLogger} from './observability/logger.js'
import {drainOutboxOnce} from './outbox/drain.js'
import {reapExpiredLeases} from './jobs/claim.js'
import {reapExpiredEventDeliveryLeases} from './events/claim.js'
import {ingestAllConnections} from './bridges/atproto/ingest.js'
import {isOperationalFlagSet} from './bridges/atproto/session.js'
import {heartbeatDue, recordHeartbeat} from './heartbeat/heartbeat.js'
import {DIGEST_PASS_INTERVAL_MS, runDigestPass} from './digests/digests.js'
import {infrastructureBackoffMs} from './jobs/retry.js'
import {metrics} from './observability/metrics.js'
import {runAttachmentCleanup} from './media/cleanup.js'

const METRICS_LOG_INTERVAL_MS = 60_000

async function main() {
  const config = loadConfig()
  const log = createLogger(config)
  const db = createDb(config.databaseUrl, error => log.error({error: safeDatabaseError(error)}, 'database pool idle client error'))
  log.info({workerId: config.workerId}, 'modula worker starting')

  let stopping = false
  let shutdownTimer: NodeJS.Timeout | null = null
  const stop = (signal: string) => {
    if (stopping) return
    stopping = true
    log.info({signal}, 'modula worker draining')
    shutdownTimer = setTimeout(() => {
      log.fatal({signal, timeoutMs: config.shutdownTimeoutMs}, 'modula worker drain timed out')
      process.exit(1)
    }, config.shutdownTimeoutMs)
    shutdownTimer.unref()
  }
  process.on('SIGTERM', () => stop('SIGTERM'))
  process.on('SIGINT', () => stop('SIGINT'))

  let lastReap = 0
  let lastDrain = 0
  let lastIngest = 0
  let lastBeat = 0
  let lastDigest = 0
  let lastMetricsLog = 0
  let lastMediaCleanup = 0
  const startedAt = new Date()
  const releaseSha = process.env.MODULA_RELEASE_SHA ?? null
  let consecutiveInfrastructureFailures = 0

  while (!stopping) {
    try {
      const now = Date.now()
      if (heartbeatDue(lastBeat, now)) {
        await recordHeartbeat(db, {workerId: config.workerId, releaseSha, startedAt})
        lastBeat = now
      }
      if (now - lastMetricsLog >= METRICS_LOG_INTERVAL_MS) {
        log.info({operation: 'worker.metrics', metrics: metrics.read()}, 'worker metrics')
        lastMetricsLog = now
      }
      if (config.mediaCleanupMode !== 'disabled' && now - lastMediaCleanup >= config.mediaCleanupIntervalMs) {
        lastMediaCleanup = now
        try {
          const result = await runAttachmentCleanup(db, {
            mode: config.mediaCleanupMode,
            mediaRoot: config.mediaRoot,
            now: new Date(now),
            retentionMs: config.mediaCleanupRetentionMs,
            activeUploadGraceMs: config.mediaCleanupActiveUploadGraceMs,
            batchSize: config.mediaCleanupBatchSize,
          })
          metrics.increment('mediaCleanupRuns')
          metrics.increment('mediaCleanupExpiredSessions', result.expiredSessions)
          metrics.increment('mediaCleanupRemovedAttachments', result.removedAttachments)
          if (result.mode === 'dry-run') {
            metrics.increment('mediaCleanupDryRunCandidates', result.expiredSessionCandidates + result.orphanCandidates)
          }
          const write = result.unsafeStorageKeys > 0 || result.unsupportedProviders > 0 ? log.warn.bind(log) : log.info.bind(log)
          write({operation: 'media.cleanup', ...result}, 'attachment cleanup pass')
        } catch (error) {
          metrics.increment('mediaCleanupErrors')
          log.error({operation: 'media.cleanup', error}, 'attachment cleanup pass failed')
        }
      }
      if (now - lastDigest >= DIGEST_PASS_INTERVAL_MS) {
        lastDigest = now
        try {
          const result = await runDigestPass(db)
          if (result.queued > 0) log.info(result, 'digest pass queued mail')
        } catch (error) {
          log.error({error}, 'digest pass failed')
        }
      }
      if (now - lastReap >= config.leaseReapIntervalMs) {
        await reapExpiredLeases(db)
        await reapExpiredEventDeliveryLeases(db)
        lastReap = now
      }
      if (now - lastDrain >= config.outboxDrainIntervalMs) {
        metrics.increment('outboxDrained', await drainOutboxOnce(db, config.outboxBatchSize))
        lastDrain = now
      }
      if (config.ingestEnabled && now - lastIngest >= config.ingestIntervalMs) {
        try {
          const result = await ingestAllConnections(db, config)
          metrics.increment('ingestRuns')
          if (result.connections > 0 || result.ingested > 0) log.info(result, 'selective AT ingest pass')
        } catch (error) {
          metrics.increment('ingestErrors')
          log.error({error}, 'selective AT ingest failed')
        }
        lastIngest = now
      }

      if (await isOperationalFlagSet(db, 'jobs.queue.drained', false)) {
        consecutiveInfrastructureFailures = 0
        await delay(config.emptyPollBackoffMs)
        continue
      }

      const worked = (await processOneEventDelivery(db, config)) || (await processOneJob(db, config))
      consecutiveInfrastructureFailures = 0
      await delay(worked ? config.pollIntervalMs : config.emptyPollBackoffMs)
    } catch (error) {
      if (stopping) break
      consecutiveInfrastructureFailures += 1
      const backoffMs = infrastructureBackoffMs(consecutiveInfrastructureFailures, config.databaseBackoffMaxMs)
      log.error({err: error, backoffMs, consecutiveInfrastructureFailures}, 'worker infrastructure pass failed; backing off')
      await delay(backoffMs)
    }
  }
  await db.destroy()
  if (shutdownTimer) clearTimeout(shutdownTimer)
  log.info('modula worker stopped')
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function safeDatabaseError(error: Error) {
  const code = (error as Error & {code?: unknown}).code
  return {name: error.name, message: error.message, code: typeof code === 'string' ? code : null}
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
