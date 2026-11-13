/**
 * GF-MOD-01 read-only artifact/presentation closure report.
 *
 * Lists, per installable release, the package artifact bytes, presentation
 * blobs, recorded digests and signature state, and emits JSON on stdout.
 * Opens a single READ ONLY transaction; it never writes. Running it against
 * production requires owner approval.
 *
 *   pnpm --filter @modula/greenfield-api registry:artifact-closure-report [--module <id>] [--states published,superseded] [--fail-on-open]
 */
import {sql} from 'kysely'
import {createDb} from '../src/database/client.js'
import {GreenfieldArtifactClosureService} from '../src/modules/artifact-closure-service.js'

function argument(name: string): string | null {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] && !process.argv[index + 1]!.startsWith('--') ? process.argv[index + 1]! : null
}

const databaseUrl = process.env.MODULA_DATABASE_URL ?? process.env.MODULA_DATABASE_MIGRATOR_URL
if (!databaseUrl) throw new Error('MODULA_DATABASE_URL or MODULA_DATABASE_MIGRATOR_URL is required')
const states = argument('--states')?.split(',').map(value => value.trim()).filter(Boolean)
const db = createDb(databaseUrl)
let exitCode = 0
try {
  const report = await db.transaction().execute(async trx => {
    await sql`SET TRANSACTION READ ONLY`.execute(trx)
    return new GreenfieldArtifactClosureService(trx as any).report({releaseStates: states, moduleId: argument('--module')})
  })
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (process.argv.includes('--fail-on-open') && report.totals.open > 0) exitCode = 2
} finally {
  await db.destroy()
}
process.exitCode = exitCode
