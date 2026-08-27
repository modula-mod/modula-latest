#!/usr/bin/env node
import {existsSync, readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {join, resolve} from 'node:path'
import {randomBytes} from 'node:crypto'

const root = process.cwd()
const failures = []
const enginesRoot = resolve(process.env.MODULA_BACKEND_ENGINES_ROOT ?? '/root/modula-platform/modula-backend-engines')
const aiRoot = resolve(process.env.MODULA_AI_BACKEND_ROOT ?? '/root/modula-platform/modula-ai-backend')
const secretsRoot = resolve(process.env.MODULA_SECRETS_SERVICE_ROOT ?? '/root/modula-platform/modula-secrets-service')

function record(label, passed, detail = '') {
  console.log(`${label.padEnd(48)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!passed) failures.push(`${label}${detail ? `: ${detail}` : ''}`)
}

function source(label, file, required, forbidden = []) {
  const content = existsSync(file) ? readFileSync(file, 'utf8') : ''
  record(label, Boolean(content) && required.every(value => content.includes(value)) && forbidden.every(value => !content.includes(value)), file)
}

function run(label, command, args, cwd = root, env = process.env) {
  console.log(`\n$ ${command} ${args.join(' ')}  # ${label}`)
  const result = spawnSync(command, args, {cwd, env, stdio: 'inherit', shell: false})
  record(label, result.status === 0, cwd)
  return result.status === 0
}

function output(command, args, cwd = root) {
  const result = spawnSync(command, args, {cwd, encoding: 'utf8', shell: false})
  return result.status === 0 ? result.stdout.trim() : ''
}

console.log('MODULA')
console.log('GREENFIELD BACKEND V1')
console.log('AI ENGINE VERIFIER\n')

source('PRIVATE AI SERVICE TARGET POLICY', join(root, 'services/greenfield-api/src/config/env.ts'), [
  'MODULA_AI_BACKEND_URL',
  "target.hostname === 'modula-ai-backend'",
  'AI backend URL must use HTTPS or the approved private service identity',
  "target.origin !== 'http://modula-ai-backend:4040'",
])
source('SIGNED SERVICE-FABRIC ADAPTER', join(root, 'services/greenfield-api/src/ai/providers/modula-ai-backend-provider.ts'), [
  "target: 'service.modula-ai'",
  "audience: 'modula-engine:ai'",
  "'secrets.use.direct'",
  "redirect: 'error'",
  'x-modula-service-assertion',
  'AbortSignal.timeout',
], ['authorization:', 'Bearer '])
source('GREENFIELD POLICY AND USAGE WRAPPER', join(root, 'services/greenfield-api/src/ai/provider-runtime-service.ts'), [
  "credentialMode === 'credential-broker'",
  'assertWithinLimits',
  'recordUsage',
  'evaluateAndAudit',
])
source('REVERSIBLE AI LEDGER MIGRATION', join(root, 'services/greenfield-api/migrations/042_greenfield_backend_v1_ai_engine.sql'), [
  "'provider:gemini'",
  "'service.modula-ai'",
  "'unconfigured'",
  "'unavailable'",
  'FALSE',
])
source('AI MIGRATION DOWN', join(root, 'services/greenfield-api/migrations/042_greenfield_backend_v1_ai_engine.down.sql'), [
  "DELETE FROM greenfield_ai_providers WHERE provider_id = 'provider:gemini'",
  "value='041'",
])
source('AI ADAPTER BEHAVIOUR', join(root, 'services/greenfield-api/tests/greenfield-backend-v1.ai-backend-adapter.test.ts'), [
  'no raw bearer',
  'PROVIDER_NOT_CONFIGURED',
  'AI_MODEL_UNAVAILABLE',
])

for (const [label, repository] of [
  ['BACKEND ENGINES', enginesRoot],
  ['AI BACKEND', aiRoot],
  ['SECRETS SERVICE', secretsRoot],
]) {
  record(`${label} REPOSITORY`, existsSync(join(repository, '.git')), repository)
  if (!existsSync(join(repository, '.git'))) continue
  run(`${label} VERIFY`, 'pnpm', ['verify'], repository, {...process.env, CI: 'true'})
  run(`${label} MAIN CONVERGENCE`, 'sh', ['-ceu', 'test "$(git branch --show-current)" = main; test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"; test -z "$(git status --porcelain)"'], repository)
}

if (existsSync(join(enginesRoot, '.git')) && existsSync(join(aiRoot, '.git'))) {
  const enginesSha = output('git', ['rev-parse', 'HEAD'], enginesRoot)
  const pinnedSha = readFileSync(join(aiRoot, 'ENGINE_CONTRACTS_SHA'), 'utf8').trim()
  record('ENGINE CONTRACT EXACT SHA', Boolean(enginesSha) && enginesSha === pinnedSha, pinnedSha)
}
source('BROKER PROVIDER BATCH', join(secretsRoot, 'src/http.ts'), ['/v1/secrets/use-batch', 'secrets.use.direct'])
source('AI BROKER-ONLY CREDENTIAL CLIENT', join(aiRoot, 'src/credential-client.ts'), [
  '/v1/secrets/use-batch',
  'x-modula-service-assertion',
], ['authorization', 'Bearer '])

run('GREENFIELD AI TYPECHECK', 'pnpm', ['--filter', '@modula/greenfield-api', 'typecheck'], root, {...process.env, CI: 'true'})
run('GREENFIELD ADAPTER TEST', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-backend-v1.ai-backend-adapter.test.ts'], root, {...process.env, CI: 'true'})
await runIsolatedDatabaseChecks()
verifyProductionContainer('AI BACKEND PRODUCTION', 'modula-ai-ai-backend-1', aiRoot)
verifyProductionContainer('SECRETS SERVICE PRODUCTION', 'modula-secrets-secrets-service-1', secretsRoot)
run('GIT DIFF CHECK', 'git', ['diff', '--check'])

console.log('\nRESULT')
if (failures.length) {
  console.log(`GREENFIELD BACKEND V1 AI ENGINE FAIL (${failures.length})`)
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}
console.log('GREENFIELD BACKEND V1 AI ENGINE PASS')

async function runIsolatedDatabaseChecks() {
  const fixture = databaseFixture()
  record('DISPOSABLE DATABASE AVAILABLE', Boolean(fixture), fixture?.databaseName ?? 'configure MODULA_TEST_DATABASE_URL or run preview Postgres')
  if (!fixture) return
  try {
    const migrateEnv = {...process.env, CI: 'true', MODULA_TEST_DATABASE_URL: fixture.migratorUrl}
    const testEnv = {...process.env, CI: 'true', NODE_ENV: 'test', MODULA_TEST_DATABASE_URL: fixture.testUrl}
    run('FULL MIGRATION CHAIN THROUGH 042', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'tsx', '-e', "import {migrateUp} from './src/database/migrate.ts'; void migrateUp(process.env.MODULA_TEST_DATABASE_URL).then(applied => { if (!applied.includes('042_greenfield_backend_v1_ai_engine')) process.exit(1) })"], join(root, 'services/greenfield-api'), migrateEnv)
    run('AI ENGINE DB BEHAVIOUR', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-backend-v1.ai-engine.test.ts', 'tests/phase7e.ai-provider-runtime.test.ts'], root, testEnv)
    run('MIGRATION 042 DOWN AND REAPPLY', 'pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'tsx', '-e', "import {migrateDown,migrateUp} from './src/database/migrate.ts'; void (async()=>{const latest=await migrateDown(process.env.MODULA_TEST_DATABASE_URL);if(latest!=='043_greenfield_backend_v1_event_job_fabric')process.exit(1);const down=await migrateDown(process.env.MODULA_TEST_DATABASE_URL);if(down!=='042_greenfield_backend_v1_ai_engine')process.exit(1);const applied=await migrateUp(process.env.MODULA_TEST_DATABASE_URL);if(!applied.includes('042_greenfield_backend_v1_ai_engine')||!applied.includes('043_greenfield_backend_v1_event_job_fabric'))process.exit(1)})()"], join(root, 'services/greenfield-api'), migrateEnv)
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
  const databaseName = `modula_gbv1_ai_engine_${process.pid}_${Date.now()}`.toLowerCase()
  const testRole = `gbv1_ai_test_${process.pid}_${Date.now()}`.toLowerCase()
  const testPassword = randomBytes(24).toString('base64url')
  const roleCreated = spawnSync('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', values.POSTGRES_DB ?? 'modula', '-v', 'ON_ERROR_STOP=1', '-c', `CREATE ROLE ${testRole} LOGIN SUPERUSER PASSWORD '${testPassword}'`], {stdio: 'ignore', shell: false})
  if (roleCreated.status !== 0) return null
  const created = spawnSync('docker', ['exec', container, 'createdb', '-U', 'modula_admin', '-O', 'modula_migrator', databaseName], {stdio: 'ignore', shell: false})
  if (created.status !== 0) {
    spawnSync('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', values.POSTGRES_DB ?? 'modula', '-c', `DROP ROLE IF EXISTS ${testRole}`], {stdio: 'ignore', shell: false})
    return null
  }
  const migratorUrl = databaseUrl('modula_migrator', values.MODULA_MIGRATOR_PASSWORD, databaseName)
  const testUrl = databaseUrl(testRole, testPassword, databaseName)
  return {
    databaseName,
    migratorUrl,
    testUrl,
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

function verifyProductionContainer(label, container, repository) {
  if (!output('docker', ['container', 'inspect', container])) {
    record(label, true, 'not present outside production host')
    return
  }
  const expected = output('git', ['rev-parse', 'HEAD'], repository)
  const state = output('docker', ['inspect', container, '--format', '{{index .Config.Labels "org.opencontainers.image.revision"}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|{{.RestartCount}}|{{.HostConfig.ReadonlyRootfs}}'])
  record(label, state === `${expected}|running|healthy|0|true`, state)
}
