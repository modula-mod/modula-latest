import {loadConfig} from './config.js'
import {createDb} from './database.js'
import {processOneJob} from './jobs/runner.js'
import {createLogger} from './observability/logger.js'
import {drainOutboxOnce} from './outbox/drain.js'
import {reapExpiredLeases} from './jobs/claim.js'
import {ingestAllConnections} from './bridges/atproto/ingest.js'
import {isOperationalFlagSet} from './bridges/atproto/session.js'

async function main() {
  const config = loadConfig()
  const log = createLogger(config)
  const db = createDb(config.databaseUrl)
  log.info({workerId: config.workerId}, 'modula worker starting')

  let stopping = false
  const stop = async () => {
    stopping = true
    await db.destroy()
    process.exit(0)
  }
  process.on('SIGTERM', () => void stop())
  process.on('SIGINT', () => void stop())

  let lastReap = 0
  let lastDrain = 0
  let lastIngest = 0

  while (!stopping) {
    const now = Date.now()
    if (now - lastReap >= config.leaseReapIntervalMs) {
      await reapExpiredLeases(db)
      lastReap = now
    }
    if (now - lastDrain >= config.outboxDrainIntervalMs) {
      await drainOutboxOnce(db, config.outboxBatchSize)
      lastDrain = now
    }
    if (config.ingestEnabled && now - lastIngest >= config.ingestIntervalMs) {
      try {
        const result = await ingestAllConnections(db, config)
        if (result.connections > 0 || result.ingested > 0) {
          log.info(result, 'selective AT ingest pass')
        }
      } catch (error) {
        log.error({error}, 'selective AT ingest failed')
      }
      lastIngest = now
    }

    if (await isOperationalFlagSet(db, 'jobs.queue.drained', false)) {
      await new Promise(r => setTimeout(r, config.emptyPollBackoffMs))
      continue
    }

    const worked = await processOneJob(db, config)
    if (!worked) await new Promise(r => setTimeout(r, config.emptyPollBackoffMs))
    else await new Promise(r => setTimeout(r, config.pollIntervalMs))
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
