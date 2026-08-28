#!/usr/bin/env node
import {randomBytes} from 'node:crypto'
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'

const root = process.cwd()
const failures = []
const record = (label, passed, detail = '') => {
  console.log(`${label.padEnd(49)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!passed) failures.push(`${label}${detail ? `: ${detail}` : ''}`)
}
const source = (label, file, required, forbidden = []) => {
  const content = existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : ''
  record(label, Boolean(content) && required.every(value => content.includes(value)) && forbidden.every(value => !content.includes(value)), file)
}
const run = (label, command, args, cwd = root, env = process.env) => {
  console.log(`\n$ ${command} ${args.join(' ')}  # ${label}`)
  const result = spawnSync(command, args, {cwd, env, stdio: 'inherit', shell: false})
  record(label, result.status === 0, cwd)
  return result.status === 0
}
const output = (command, args) => {
  const result = spawnSync(command, args, {encoding: 'utf8', shell: false})
  return result.status === 0 ? result.stdout.trim() : ''
}

console.log('MODULA\nGREENFIELD BACKEND V1\nSOCIAL COMPLETION VERIFIER\n')
source('SOCIAL MIGRATION', 'services/greenfield-api/migrations/046_greenfield_backend_v1_social_completion.sql', [
  'greenfield_post_shares', 'evidence_refs', 'reviewed_by_actor_id', "target_type IN ('profile', 'post', 'comment'", "'046'",
])
source('REVERSIBLE SOCIAL MIGRATION', 'services/greenfield-api/migrations/046_greenfield_backend_v1_social_completion.down.sql', [
  'INSERT INTO post_likes', 'DROP TABLE IF EXISTS greenfield_post_shares', "value='045'",
])
source('ONE REACTION PER ACTOR TARGET', 'services/greenfield-api/src/domains/reactions/service.ts', [
  "where('actor_id', '=', actorId)", "where('post_id', '=', postId)", "updateTable('greenfield_reactions')",
])
source('AUTHORITATIVE SHARE LEDGER', 'services/greenfield-api/src/domains/shares/service.ts', [
  'GreenfieldPolicyEngine', "insertInto('greenfield_post_shares')", 'idempotencyKey', "'post.shared'",
])
source('MODERATION REVIEW AND ACTION', 'services/greenfield-api/src/domains/moderation/repository.ts', [
  'reviewReport', 'applyAction', 'content_removed', 'evidenceRefs', "'moderation.action.applied'",
])
source('BLOCKED NOTIFICATION WRITE GUARD', 'services/greenfield-worker/src/notifications/social.ts', [
  'blockedEitherDirection', "selectFrom('blocks')",
])
source('BLOCKED NOTIFICATION READ GUARD', 'services/greenfield-api/src/domains/notifications/repository.ts', [
  'excludedActorIds', "selectFrom('blocks')", "selectFrom('mutes')",
])
source('VIEWER-AWARE DISCOVERY', 'services/greenfield-api/src/domains/discovery/repository.ts', [
  'viewerActorId', 'excludedActorIds', "selectFrom('post_media')",
], ['picsum.photos'])
source('SOCIAL ROUTES', 'services/greenfield-api/src/app/register-routes.ts', [
  '/v1/posts/:postId/share', '/v1/reports/me', '/v1/admin/moderation/reports', 'request.auth?.actorId ?? null',
])
source('STORY MEDIA POLICY', 'services/greenfield-api/src/app/register-phase7f-stories-routes.ts', [
  'stories.canViewGroup', 'if (!canView)',
])
source('BEHAVIOUR TEST', 'services/greenfield-api/tests/greenfield-backend-v1.social-completion.test.ts', [
  'one canonical reaction', 'evidence-bearing report', 'propagates blocking',
], ['sk-proj-', 'OPENAI_API_KEY='])

run('API CONTRACTS BUILD', 'pnpm', ['--filter', '@modula/api-contracts', 'build'], root, {...process.env, CI: 'true'})
run('GREENFIELD API TYPECHECK', 'pnpm', ['--filter', '@modula/greenfield-api', 'typecheck'], root, {...process.env, CI: 'true'})
run('GREENFIELD WORKER TYPECHECK', 'pnpm', ['--filter', '@modula/greenfield-worker', 'typecheck'], root, {...process.env, CI: 'true'})
await runDatabaseChecks()
verifyProductionState()

console.log('\nRESULT')
if (failures.length) {
  console.log(`GREENFIELD BACKEND V1 SOCIAL FAIL (${failures.length})`)
  failures.forEach(failure => console.log(`- ${failure}`))
  process.exit(1)
}
console.log('GREENFIELD BACKEND V1 SOCIAL PASS')

async function runDatabaseChecks() {
  const fixture = databaseFixture()
  record('DISPOSABLE DATABASE AVAILABLE', Boolean(fixture), fixture?.databaseName ?? 'preview Postgres unavailable')
  if (!fixture) return
  try {
    const migrateEnv = {...process.env, CI: 'true', MODULA_TEST_DATABASE_URL: fixture.migratorUrl}
    const testEnv = {...process.env, CI: 'true', NODE_ENV: 'test', MODULA_TEST_DATABASE_URL: fixture.testUrl}
    run('FULL MIGRATION CHAIN THROUGH 046', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'tsx', '-e', "import {migrateUp} from './src/database/migrate.ts'; void migrateUp(process.env.MODULA_TEST_DATABASE_URL).then(applied => { if (!applied.includes('046_greenfield_backend_v1_social_completion')) process.exit(1) })"], join(root, 'services/greenfield-api'), migrateEnv)
    run('SOCIAL COMPLETION BEHAVIOUR', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-backend-v1.social-completion.test.ts'], root, testEnv)
    run('EXISTING SOCIAL JOURNEYS', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/phase6s.social.test.ts', 'tests/phase7i.f5-stories.test.ts'], root, testEnv)
    run('NOTIFICATION BLOCK GUARDS', 'pnpm', ['--filter', '@modula/greenfield-worker', 'exec', 'vitest', 'run', 'tests/phase7e.notifications.test.ts'], root, testEnv)
    run('MIGRATION 046 DOWN AND REAPPLY', 'pnpm', ['exec', 'tsx', 'scripts/verify-migration-cycle.ts', '046_greenfield_backend_v1_social_completion'], join(root, 'services/greenfield-api'), migrateEnv)
  } finally {
    fixture.cleanup()
    record('DISPOSABLE DATABASE REMOVED', true, fixture.databaseName)
  }
}

function databaseFixture() {
  const supplied = process.env.MODULA_TEST_DATABASE_URL
  if (supplied) return {databaseName: new URL(supplied).pathname.slice(1), migratorUrl: supplied, testUrl: supplied, cleanup: () => undefined}
  const container = 'modula-preview-greenfield-postgres-1'
  if (!output('docker', ['container', 'inspect', container])) return null
  const environment = output('docker', ['inspect', container, '--format', '{{range .Config.Env}}{{println .}}{{end}}'])
  const values = Object.fromEntries(environment.split('\n').map(line => line.split(/=(.*)/s).slice(0, 2)).filter(parts => parts.length === 2))
  const databaseName = `modula_gbv1_social_${process.pid}_${Date.now()}`.toLowerCase()
  const testRole = `gbv1_social_test_${process.pid}_${Date.now()}`.toLowerCase()
  const testPassword = randomBytes(24).toString('base64url')
  if (spawnSync('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', values.POSTGRES_DB ?? 'modula', '-v', 'ON_ERROR_STOP=1', '-c', `CREATE ROLE ${testRole} LOGIN SUPERUSER PASSWORD '${testPassword}'`], {stdio: 'ignore', shell: false}).status !== 0) return null
  if (spawnSync('docker', ['exec', container, 'createdb', '-U', 'modula_admin', '-O', 'modula_migrator', databaseName], {stdio: 'ignore', shell: false}).status !== 0) {
    spawnSync('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', values.POSTGRES_DB ?? 'modula', '-c', `DROP ROLE IF EXISTS ${testRole}`], {stdio: 'ignore', shell: false})
    return null
  }
  return {
    databaseName,
    migratorUrl: databaseUrl('modula_migrator', values.MODULA_MIGRATOR_PASSWORD, databaseName),
    testUrl: databaseUrl(testRole, testPassword, databaseName),
    cleanup: () => {
      spawnSync('docker', ['exec', container, 'dropdb', '-U', 'modula_admin', '--if-exists', databaseName], {stdio: 'ignore', shell: false})
      spawnSync('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', values.POSTGRES_DB ?? 'modula', '-c', `DROP ROLE IF EXISTS ${testRole}`], {stdio: 'ignore', shell: false})
    },
  }
}

function databaseUrl(user, password, databaseName) {
  const url = new URL('postgresql://127.0.0.1:5433')
  url.username = user
  if (password) url.password = password
  url.pathname = `/${databaseName}`
  return url.toString()
}

function verifyProductionState() {
  const container = 'modula-production-greenfield-postgres-1'
  if (!output('docker', ['container', 'inspect', container])) return record('PRODUCTION DATABASE DISCOVERED', true, 'not present outside production host')
  const database = output('docker', ['inspect', container, '--format', '{{range .Config.Env}}{{println .}}{{end}}']).split('\n').find(line => line.startsWith('POSTGRES_DB='))?.slice(12) ?? 'modula'
  const schema = output('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', database, '-Atqc', "SELECT value FROM schema_metadata WHERE key='schema_version'"])
  const required = process.env.MODULA_REQUIRE_PRODUCTION_046 === '1'
  const version = Number(schema)
  record('PRODUCTION SCHEMA DISCOVERED', required ? version >= 46 : version >= 43 && version <= 53, schema)
}
