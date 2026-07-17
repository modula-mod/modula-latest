import pino from 'pino'
import {loadWorkerConfig} from './config.js'
import {createWorkerDb} from './database.js'
import {processOneJob} from './jobs/runner.js'

async function main() {
  const config = loadWorkerConfig()
  const log = pino({
    level: config.logLevel,
    redact: {paths: ['password', 'token', 'secret', 'encrypted_session'], remove: true},
  })
  const db = createWorkerDb(config.databaseUrl)
  log.info({workerId: config.workerId}, 'modula worker starting')

  let stopping = false
  const stop = async () => {
    stopping = true
    await db.destroy()
    process.exit(0)
  }
  process.on('SIGTERM', () => void stop())
  process.on('SIGINT', () => void stop())

  while (!stopping) {
    const worked = await processOneJob(db, config.workerId, config.leaseSeconds)
    if (!worked) await new Promise(r => setTimeout(r, config.pollMs))
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
