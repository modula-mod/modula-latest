/** Requeue only independently evidenced historical reaction collision jobs.
 * The ordinary worker executes them; this command never marks jobs successful.
 */
import {createDb} from '../src/database/client.js'
import {listEligibleReactionDeadLetters, retryReactionNotificationDeadLetter} from '../src/domains/notifications/reaction-dead-letter-retry.js'

const apply = process.argv.includes('--apply')
const countIndex = process.argv.indexOf('--expected-count')
const expectedCount = countIndex >= 0 ? Number(process.argv[countIndex + 1]) : null
const limitIndex = process.argv.indexOf('--limit')
const limit = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) : null
if (apply && (!Number.isSafeInteger(expectedCount) || expectedCount! < 1)) {
  throw new Error('--apply requires --expected-count <positive integer> from a prior dry-run')
}
if (limit !== null && (!Number.isSafeInteger(limit) || limit < 1)) {
  throw new Error('--limit must be a positive integer')
}
const databaseUrl = process.env.MODULA_DATABASE_MIGRATOR_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) throw new Error('A production database URL is required')
const db = createDb(databaseUrl)

try {
  const candidates = await listEligibleReactionDeadLetters(db)
  if (!apply) {
    process.stdout.write(`${JSON.stringify({mode: 'dry-run', eligible: candidates.length, selected: limit === null ? candidates.length : Math.min(limit, candidates.length)})}\n`)
  } else {
    if (candidates.length !== expectedCount) throw new Error('Eligible reaction dead-letter count changed since dry-run')
    if (limit !== null && limit > candidates.length) throw new Error('--limit exceeds eligible reaction dead-letter count')
    let requeued = 0
    for (const jobId of limit === null ? candidates : candidates.slice(0, limit)) {
      await retryReactionNotificationDeadLetter(db, jobId, null, {
        reason: 'API-FIX-01C protected one-off operator replay',
        correlationId: 'api-fix-01c-reaction-replay',
      })
      requeued += 1
    }
    process.stdout.write(`${JSON.stringify({mode: 'requeued-through-domain-service', eligible: candidates.length, requeued})}\n`)
  }
} finally {
  await db.destroy()
}
