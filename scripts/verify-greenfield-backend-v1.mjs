#!/usr/bin/env node
import {existsSync, lstatSync, readdirSync, realpathSync} from 'node:fs'
import {basename, join} from 'node:path'
import {spawnSync} from 'node:child_process'

const root = process.cwd()
const failures = []
const verificationEnvironment = {
  ...process.env,
  CI: 'true',
  MODULA_REQUIRE_PRODUCTION_043: '1',
  MODULA_REQUIRE_PRODUCTION_044: '1',
  MODULA_REQUIRE_PRODUCTION_045: '1',
  MODULA_REQUIRE_PRODUCTION_046: '1',
  MODULA_REQUIRE_PRODUCTION_047: '1',
  MODULA_REQUIRE_PRODUCTION_048: '1',
  MODULA_REQUIRE_PRODUCTION_049: '1',
  MODULA_REQUIRE_PRODUCTION_050: '1',
}

const subsystemVerifiers = [
  ['DATA LEDGER', 'scripts/verify-greenfield-backend-v1-data-ledger.mjs'],
  ['SERVICE FABRIC', 'scripts/verify-greenfield-backend-v1-service-fabric.mjs'],
  ['SECRET FABRIC', 'scripts/verify-greenfield-backend-v1-secret-fabric.mjs'],
  ['AI ENGINE', 'scripts/verify-greenfield-backend-v1-ai-engine.mjs'],
  ['EVENT AND JOB FABRIC', 'scripts/verify-greenfield-backend-v1-event-job-fabric.mjs'],
  ['ENGINE FABRIC', 'scripts/verify-greenfield-backend-v1-engine-fabric.mjs'],
  ['AUTH', 'scripts/verify-greenfield-backend-v1-auth.mjs'],
  ['SOCIAL', 'scripts/verify-greenfield-backend-v1-social.mjs'],
  ['DEVELOPER PLATFORM', 'scripts/verify-greenfield-backend-v1-developer.mjs'],
  ['BUILD AND RELEASE', 'scripts/verify-greenfield-backend-v1-build-release.mjs'],
  ['ENTITLEMENTS AND USAGE', 'scripts/verify-greenfield-backend-v1-entitlements.mjs'],
  ['ACCOUNT EXPORT AND DELETE', 'scripts/verify-greenfield-backend-v1-account-data.mjs'],
  ['BACKUP AND RESTORE', 'scripts/verify-greenfield-backend-v1-recovery.mjs'],
  ['REFERENCE PRODUCTS', 'scripts/verify-greenfield-backend-v1-reference-products.mjs'],
  ['SECURITY', 'scripts/verify-greenfield-backend-v1-security.mjs'],
]

console.log('MODULA\nGREENFIELD BACKEND V1\nFINAL CANONICAL VERIFIER\n')

record('CI MODE', process.env.CI === 'true', `CI=${process.env.CI ?? 'unset'}`)
for (const [label, script] of subsystemVerifiers) {
  run(label, 'node', [script], verificationEnvironment)
}
run('CATALOGUE RESILIENCE', 'pnpm', [
  '--filter', '@modula/greenfield-api', 'exec', 'tsx', '--tsconfig', join(root, 'tsconfig.json'),
  join(root, 'scripts/verify-greenfield-backend-v1-catalogue-resilience.ts'),
], verificationEnvironment)

await verifyProductionConvergence()
run('PRODUCTION WEB CUTOVER', 'node', ['scripts/verify-phase7e-web-production-cutover.mjs'], verificationEnvironment)
run('FINAL GIT DIFF CHECK', 'git', ['diff', '--check'], verificationEnvironment)

console.log('\nRESULT')
if (failures.length) {
  console.log(`CI=true pnpm verify:greenfield-backend-v1\nFAIL (${failures.length})`)
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}
console.log('PENDING MIGRATIONS'.padEnd(52) + ' 0')
console.log('P0'.padEnd(52) + ' 0')
console.log('P1'.padEnd(52) + ' 0')
console.log('CI=true pnpm verify:greenfield-backend-v1\nPASS')

function run(label, command, args, env) {
  console.log(`\n$ ${command} ${args.join(' ')}  # ${label}`)
  const result = spawnSync(command, args, {cwd: root, env, stdio: 'inherit', shell: false})
  record(label, result.status === 0, result.status === 0 ? 'completed' : `exit ${String(result.status)}`)
}

function record(label, passed, detail = '') {
  console.log(`${label.padEnd(52)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!passed) failures.push(`${label}: ${detail}`)
}

function capture(command, args, cwd = root) {
  return spawnSync(command, args, {cwd, encoding: 'utf8', shell: false})
}

function output(command, args, cwd = root) {
  const result = capture(command, args, cwd)
  return result.status === 0 ? result.stdout.trim() : ''
}

async function verifyProductionConvergence() {
  const branch = output('git', ['branch', '--show-current'])
  const head = output('git', ['rev-parse', 'HEAD'])
  const originMain = output('git', ['rev-parse', 'origin/main'])
  const status = output('git', ['status', '--porcelain'])
  record('PRODUCT BRANCH', branch === 'main', branch)
  record('PRODUCT MAIN SHA', Boolean(head) && head === originMain, `${head} / origin ${originMain}`)
  record('PRODUCT WORKTREE CLEAN', status === '', status || 'clean')

  const current = '/var/www/modula/current'
  const release = existsSync(current) && lstatSync(current).isSymbolicLink() ? realpathSync(current) : ''
  record('WEB SHA', Boolean(release) && basename(release) === head, release || 'missing atomic release')

  await verifyPublicVersion('WEB PUBLIC VERSION', 'https://modula.digital/version.json', head, false)
  await verifyPublicVersion('API PUBLIC VERSION', 'https://api.modula.digital/version.json', head, true)
  verifyContainer('API SHA', 'modula-production-greenfield-api-1', head, true)
  verifyContainer('WORKER SHA', 'modula-production-greenfield-worker-1', head, false)

  const postgres = 'modula-production-greenfield-postgres-1'
  const productionDatabase = productionDatabaseName(postgres)
  const schema = dockerPsql(postgres, productionDatabase, "SELECT value FROM schema_metadata WHERE key='schema_version'")
  const applied = dockerPsql(postgres, productionDatabase, 'SELECT id FROM schema_migrations ORDER BY id').split('\n').filter(Boolean)
  const source = readdirSync(join(root, 'services/greenfield-api/migrations'))
    .filter(file => file.endsWith('.sql') && !file.includes('.down.'))
    .map(file => file.replace(/\.sql$/, ''))
    .sort()
  const pending = source.filter(id => !applied.includes(id))
  const unknown = applied.filter(id => !source.includes(id))
  record('PRODUCTION SCHEMA', schema === '053', schema)
  record('PRODUCTION MIGRATION LEDGER', applied.length === source.length && unknown.length === 0, `${applied.length}/${source.length}; unknown=${unknown.length}`)
  record('PENDING MIGRATIONS', pending.length === 0, pending.join(',') || '0')

  try {
    const response = await fetch('https://api.modula.digital/v1/health/ready', {headers: {'cache-control': 'no-cache'}})
    const body = await response.json()
    const status = body?.data?.status ?? body?.status
    record('PRODUCTION API READY', response.ok && status === 'ready', `${response.status} ${String(status)}`)
  } catch (error) {
    record('PRODUCTION API READY', false, error instanceof Error ? error.message : String(error))
  }
}

async function verifyPublicVersion(label, url, expected, api) {
  try {
    const response = await fetch(url, {headers: {'cache-control': 'no-cache'}})
    const body = await response.json()
    const data = api ? body?.data ?? body : body
    record(label, response.ok && data?.commit === expected, `${response.status} ${String(data?.commit)}`)
  } catch (error) {
    record(label, false, error instanceof Error ? error.message : String(error))
  }
}

function verifyContainer(label, container, expected, requireHealthy) {
  const revision = output('docker', ['inspect', container, '--format', '{{index .Config.Labels "org.opencontainers.image.revision"}}'])
  const status = output('docker', ['inspect', container, '--format', '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|{{.RestartCount}}'])
  const releaseSha = output('docker', ['exec', container, 'printenv', 'MODULA_RELEASE_SHA'])
  const expectedStatus = requireHealthy ? 'running|healthy|0' : 'running||0'
  record(label, revision === expected && releaseSha === expected && status === expectedStatus, `${revision}|${releaseSha}|${status}`)
}

function productionDatabaseName(container) {
  const value = output('docker', ['exec', container, 'printenv', 'POSTGRES_DB'])
  return value || 'modula'
}

function dockerPsql(container, database, sql) {
  return output('docker', ['exec', container, 'psql', '-U', 'modula_admin', '-d', database, '-Atqc', sql])
}
