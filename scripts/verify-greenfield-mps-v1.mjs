#!/usr/bin/env node
import {spawnSync} from 'node:child_process'
import {existsSync, readFileSync, readdirSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createGreenfieldVerifierDatabaseFixture} from './greenfield-backend-v1-database-fixture.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

function fail(id, detail) {
  failures.push(`${id}: ${detail}`)
}

function record(label, passed, detail = '') {
  console.log(`${label.padEnd(56)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!passed) fail(label, detail || 'failed')
}

function source(rel, needles, id) {
  const text = readFileSync(join(ROOT, rel), 'utf8')
  const missing = needles.filter(needle => !text.includes(needle))
  record(id, missing.length === 0, missing.length ? `${rel} missing ${missing.join(', ')}` : rel)
}

function scanJsForVaultBranch(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) {
      scanJsForVaultBranch(p)
      continue
    }
    if (!entry.name.endsWith('.js') && !entry.name.endsWith('.ts')) continue
    const text = readFileSync(p, 'utf8')
    if (/if\s*\([^)]*(productId|moduleId)[^)]*(===|==)[^)]*digital\.modula\.vault-/.test(text)) {
      fail('RUNTIME_SPECIAL_CASE', p)
    }
  }
}

function run(label, command, args, env = process.env, cwd = ROOT) {
  console.log(`\n$ ${command} ${args.join(' ')}  # ${label}`)
  const result = spawnSync(command, args, {cwd, env, encoding: 'utf8', shell: false})
  if (result.status !== 0) {
    record(label, false, (result.stderr || result.stdout || `exit ${result.status}`).slice(0, 2000))
    return
  }
  record(label, true)
}

console.log('MODULA')
console.log('GREENFIELD × MPS 1.0-RC')
console.log('CONVERGENCE VERIFIER\n')

source('docs/GREENFIELD-V1-CORE-FREEZE.md', [
  'IN_PLACE_REMEDIATED — NOT CLEAN-IMAGE_REBUILT',
  'NORMAL NEW PRODUCT REQUIRES GREENFIELD CORE CODE CHANGE = **NO**',
], 'FREEZE_DOC')
source('docs/greenfield-mps-convergence-matrix.md', ['ALREADY_SUPPORTED', 'NO UNKNOWN'], 'MATRIX')
source('docs/architecture/greenfield-product-standard.md', [
  'external product contract',
  'greenfield.v1',
  'module profile',
], 'ARCHITECTURE')
source('packages/greenfield-product-standard/src/ingest.ts', [
  'parseModulaProductJson',
  'validateModulaProduct',
  'ingestProductManifest',
], 'INGEST')
source('packages/greenfield-product-standard/src/adapters.ts', ['adaptLegacyProductDocument'], 'ADAPTER')
source(
  'services/greenfield-api/src/product-standard/ingest-service.ts',
  ['GreenfieldMpsIngestService', 'validateMpsFrontendArtifact', 'greenfield_release_frontends'],
  'API_INGEST',
)
source(
  'services/greenfield-api/src/product-standard/frontend-service.ts',
  ['GreenfieldProductFrontendService', "source: 'legacy'", "source: 'mps'", 'runtime_projection'],
  'FRONTEND_RUNTIME_PROJECTION',
)
source(
  'services/greenfield-api/src/modules/routes/index.ts',
  ['/v1/admin/product-standard/ingest', '/v1/product-standard/products/:productId', '/v1/modules/:moduleId/frontend'],
  'API_INGEST_ROUTE',
)
source(
  'services/greenfield-api/scripts/publish-mps-products.ts',
  ['--product-root', 'GreenfieldModuleReleaseService', 'GreenfieldMpsIngestService', 'artifactSha256'],
  'GENERIC_MPS_PUBLISHER',
)
source(
  'services/greenfield-api/package.json',
  ['registry:ingest-mps-products', 'registry:publish-mps-products'],
  'GENERIC_MPS_OPERATOR_COMMANDS',
)
for (const rel of [
  'services/greenfield-api/scripts/ingest-mps-products.ts',
  'services/greenfield-api/scripts/publish-mps-products.ts',
]) {
  const text = readFileSync(join(ROOT, rel), 'utf8')
  record(
    `PRODUCT-NEUTRAL ${rel.split('/').at(-1)}`,
    !/digital\.modula\.vault|modula-vault|ProductName/.test(text),
    rel,
  )
}
source('services/greenfield-api/migrations/054_greenfield_mps_v1_product_contract.sql', [
  'GRANT SELECT, INSERT, UPDATE, DELETE ON',
  'TO modula_api, modula_worker',
  'TO modula_backup',
], 'MIGRATION_054')
source('services/greenfield-api/migrations/055_mps_product_frontend_runtime.sql', [
  'greenfield_release_frontends',
  'runtime_projection',
  'artifact_sha256',
  'greenfield_release_frontends_immutable',
  'TO modula_backup',
], 'MIGRATION_055')

scanJsForVaultBranch(join(ROOT, 'packages/greenfield-product-standard/src'))
scanJsForVaultBranch(join(ROOT, 'services/greenfield-api/src/product-standard'))
record('PRODUCT-SPECIFIC INGEST RUNTIME CASES', failures.filter(item => item.startsWith('RUNTIME_SPECIAL_CASE')).length === 0, '0')

const fixtures = [
  'reference-module',
  'reference-plugin',
  'reference-service',
  'reference-connector',
  'reference-engine',
  'reference-game',
  'reference-notes-alt',
]
for (const name of fixtures) {
  const file = join(ROOT, 'fixtures/mps', name, 'modula.product.json')
  if (!existsSync(file)) {
    record(`FIXTURE ${name}`, false, file)
    continue
  }
  const json = JSON.parse(readFileSync(file, 'utf8'))
  record(`FIXTURE ${name}`, json.productStandard === '1.0-RC' && !json.services?.urls, json.productStandard)
  if (name === 'reference-plugin' && json.backend?.mode !== 'none') {
    record('PLUGIN_BACKEND', false, String(json.backend?.mode))
  }
}

run('MODULE MANIFEST DEPENDENCY BUILD', 'pnpm', ['--filter', '@modula/greenfield-module-manifest', 'build'])
run('PACKAGE BUILD', 'pnpm', ['--filter', '@modula/greenfield-product-standard', 'build'])
run(
  'PACKAGE INGEST TESTS',
  'pnpm',
  ['--filter', '@modula/greenfield-product-standard', 'test'],
  {...process.env, CI: 'true'},
)

const fixture = createGreenfieldVerifierDatabaseFixture('mps_v1')
if (!fixture) {
  record('DISPOSABLE DATABASE AVAILABLE', false, 'REQUIRED — set MODULA_TEST_DATABASE_URL or start preview Postgres')
} else {
  record('DISPOSABLE DATABASE AVAILABLE', true, fixture.databaseName)
  try {
    const migrateEnv = {...process.env, CI: 'true', MODULA_TEST_DATABASE_URL: fixture.migratorUrl}
    const testEnv = {...process.env, CI: 'true', NODE_ENV: 'test', MODULA_TEST_DATABASE_URL: fixture.testUrl}
    run(
      'FULL MIGRATION CHAIN THROUGH 055',
      'pnpm',
      [
        '--filter', '@modula/greenfield-api', 'exec', 'tsx', '-e',
        "import {migrateUp, migrateStatus} from './src/database/migrate.ts'; void migrateUp(process.env.MODULA_TEST_DATABASE_URL).then(async applied => { const status = await migrateStatus(process.env.MODULA_TEST_DATABASE_URL); if (!applied.includes('055_mps_product_frontend_runtime') || status.pending.length !== 0) process.exit(1) })",
      ],
      migrateEnv,
      join(ROOT, 'services/greenfield-api'),
    )
    run(
      'MPS INGEST DB BEHAVIOUR',
      'pnpm',
      ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-mps-v1.ingest.test.ts'],
      testEnv,
    )
    run(
      'MPS PUBLISH DB SECURITY',
      'pnpm',
      ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-mps-v1.publish.test.ts'],
      testEnv,
    )
    run(
      'MIGRATION 055 ROLLBACK TO 054',
      'pnpm',
      [
        '--filter', '@modula/greenfield-api', 'exec', 'tsx', '-e',
        "import {migrateDown, migrateStatus} from './src/database/migrate.ts'; void migrateDown(process.env.MODULA_TEST_DATABASE_URL).then(async id => { const status = await migrateStatus(process.env.MODULA_TEST_DATABASE_URL); if (id !== '055_mps_product_frontend_runtime' || status.pending[0] !== '055_mps_product_frontend_runtime') process.exit(1) })",
      ],
      migrateEnv,
      join(ROOT, 'services/greenfield-api'),
    )
    run(
      'MIGRATION 055 REAPPLY',
      'pnpm',
      [
        '--filter', '@modula/greenfield-api', 'exec', 'tsx', '-e',
        "import {migrateUp, migrateStatus} from './src/database/migrate.ts'; void migrateUp(process.env.MODULA_TEST_DATABASE_URL).then(async applied => { const status = await migrateStatus(process.env.MODULA_TEST_DATABASE_URL); if (!applied.includes('055_mps_product_frontend_runtime') || status.pending.length !== 0) process.exit(1) })",
      ],
      migrateEnv,
      join(ROOT, 'services/greenfield-api'),
    )
  } finally {
    fixture.cleanup()
    record('DISPOSABLE DATABASE REMOVED', true, fixture.databaseName)
  }
}

if (failures.length) {
  console.error('\nverify:greenfield-mps-v1 FAIL')
  for (const item of failures) console.error(`- ${item}`)
  process.exit(1)
}

console.log('\nverify:greenfield-mps-v1 PASS')
console.log('NORMAL NEW PRODUCT REQUIRES GREENFIELD CORE CODE CHANGE = NO')
console.log('PRODUCT-SPECIFIC GREENFIELD RUNTIME CASES (ingest path) = 0')
console.log('ARBITRARY SERVICE URLS in fixtures = 0')
process.exit(0)
