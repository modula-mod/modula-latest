import {createHash} from 'node:crypto'
import {sql, type Transaction} from 'kysely'
import {createDb} from '../src/database/client.js'
import type {Database} from '../src/database/types.js'
import {AuditRepository} from '../src/domains/audit/repository.js'

type Candidate = Pick<Database['background_jobs'], 'id' | 'job_type' | 'status' | 'error_code' | 'created_at'>

const apply = process.argv.includes('--apply')
const expectedCount = argumentNumber('--expected-count')
const expectedDigest = argument('--expected-digest')
if (apply && (!Number.isSafeInteger(expectedCount) || expectedCount! < 1 || !/^[0-9a-f]{64}$/.test(expectedDigest ?? ''))) {
  throw new Error('--apply requires the exact --expected-count and --expected-digest from a prior dry-run')
}

const databaseUrl = process.env.MODULA_DATABASE_MIGRATOR_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) throw new Error('MODULA_DATABASE_MIGRATOR_URL or MODULA_DATABASE_URL is required')
const db = createDb(databaseUrl)

try {
  if (!apply) {
    const candidates = await listCandidates(db)
    process.stdout.write(`${JSON.stringify(report('dry-run', candidates))}\n`)
  } else {
    const result = await db.transaction().execute(async trx => {
      const candidates = await listCandidates(trx, true)
      const evidence = report('apply', candidates)
      if (candidates.length !== expectedCount || evidence.digest !== expectedDigest) {
        throw new Error('terminal-job candidate set changed after dry-run')
      }
      const ids = candidates.map(candidate => candidate.id)
      const updated = await trx.updateTable('background_jobs').set({
        status: 'CANCELLED',
        updated_at: new Date(),
      }).where('id', 'in', ids).where('status', '=', 'DEAD_LETTER').returning('id').execute()
      if (updated.length !== ids.length) throw new Error('terminal-job cancellation was incomplete')
      await new AuditRepository(trx).append('operations.greenfield_v1.terminal_jobs_cancelled', {
        count: ids.length,
        candidateDigest: evidence.digest,
        classes: evidence.classes,
        reason: 'bounded GreenField v1 closeout of obsolete terminal jobs; failure evidence retained',
      }, {type: 'backgroundJobSet', id: evidence.digest}, {correlationId: 'greenfield-v1-closeout-final'})
      return {...evidence, cancelled: updated.length}
    })
    process.stdout.write(`${JSON.stringify(result)}\n`)
  }
} finally {
  await db.destroy()
}

async function listCandidates(database: typeof db | Transaction<Database>, lock = false): Promise<Candidate[]> {
  let query = database.selectFrom('background_jobs')
    .select(['id', 'job_type', 'status', 'error_code', 'created_at'])
    .where('status', '=', 'DEAD_LETTER')
    .where(expression => expression.or([
      expression.and([expression('job_type', '=', 'mail.identity.provision'), expression('created_at', '<', new Date('2026-09-01T00:00:00.000Z'))]),
      expression.and([expression('job_type', '=', 'search.reindex'), expression('created_at', '<', new Date('2026-08-01T00:00:00.000Z'))]),
      expression.and([expression('job_type', '=', 'plugin.enable'), expression('created_at', '<', new Date('2026-08-01T00:00:00.000Z'))]),
    ]))
    .orderBy('created_at')
    .orderBy('id')
  if (lock) query = query.forUpdate()
  return query.execute()
}

function report(mode: 'dry-run' | 'apply', candidates: Candidate[]) {
  const canonical = candidates.map(candidate => ({
    id: candidate.id,
    jobType: candidate.job_type,
    status: candidate.status,
    errorCode: candidate.error_code,
    createdAt: candidate.created_at.toISOString(),
  }))
  const digest = createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
  const classes = Object.fromEntries([...new Set(candidates.map(candidate => candidate.job_type))].sort().map(jobType => [
    jobType,
    candidates.filter(candidate => candidate.job_type === jobType).length,
  ]))
  return {mode, count: candidates.length, digest, classes}
}

function argument(name: string): string | null {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] ?? null : null
}

function argumentNumber(name: string): number | null {
  const value = argument(name)
  return value === null ? null : Number(value)
}
