import {loadConfig} from './config.js'
import {createDb} from './database.js'
import {processOneJob} from './jobs/runner.js'
import {createLogger} from './observability/logger.js'
import {drainOutboxOnce} from './outbox/drain.js'
import {reapExpiredLeases} from './jobs/claim.js'

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
    const worked = await processOneJob(db, config)
    if (!worked) await new Promise(r => setTimeout(r, config.emptyPollBackoffMs))
    else await new Promise(r => setTimeout(r, config.pollIntervalMs))
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
