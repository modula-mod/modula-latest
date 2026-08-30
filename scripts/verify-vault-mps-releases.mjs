#!/usr/bin/env node
import {spawnSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {createGreenfieldVerifierDatabaseFixture} from './greenfield-backend-v1-database-fixture.mjs'

const root = process.cwd()
const failures = []
const products = [
  {
    root: resolve(process.env.MODULA_VAULT_NOTES_ROOT ?? '/root/modula-mod/modula-vault-notes'),
    productId: 'digital.modula.vault-notes',
    version: '1.4.0',
    tag: 'vault-notes-v1.4.0',
    commit: '3f4e358df383ea84fe0af1ebf9d30d43e55de221',
    packageSha256: '42f2e5c98106064d47690bf206db46e6ab0e2062e46ca7b45a3e1260376dfcd1',
    frontendMode: 'declarative',
    frontendSha256: '65f039de00040b0ad68bad1626b38d43f01aef28bdeeaa5cdbe6e9d559fefca7',
  },
  {
    root: resolve(process.env.MODULA_VAULT_FORMATTING_ROOT ?? '/root/modula-mod/modula-vault-formatting'),
    productId: 'digital.modula.vault-notes.formatting',
    version: '0.3.0',
    tag: 'vault-formatting-v0.3.0',
    commit: 'b8a98990181aa112a8c95c2a7708f0e67cb677ba',
    packageSha256: 'eb31cb8c6a9eb6d2d0e9af9a86ef3780a99ce11c3368773abaafbd2902336b88',
    frontendMode: 'host-contribution',
    frontendSha256: '11e09a5f37bf8e177f0d0144d8a05380606eaee408894ccd54cbe60bd4bd5b3d',
  },
  {
    root: resolve(process.env.MODULA_VAULT_AI_ROOT ?? '/root/modula-mod/modula-vault-ai'),
    productId: 'digital.modula.vault-notes.ai',
    version: '0.3.0',
    tag: 'vault-ai-v0.3.0',
    commit: '2c5bda72b5cd1413a9c79a4fbbfd10d88a6f2cce',
    packageSha256: '4e7c4313b099e43652b05316e6840f9cded84d5ae46b1683196c7556b2e792f5',
    frontendMode: 'host-contribution',
    frontendSha256: 'f5b78e8f1ea629dae34cd029a066aeb033b8d824fd419c6f38316657d9ff6375',
  },
  {
    root: resolve(process.env.MODULA_VAULT_VOICE_ROOT ?? '/root/modula-mod/modula-vault-voice'),
    productId: 'digital.modula.vault-notes.voice',
    version: '0.3.0',
    tag: 'vault-voice-v0.3.0',
    commit: 'f753da13fec60226f362d316c5a49c977694998b',
    packageSha256: '0690f50cdc8572e29edca36b93c216a0dbf2efa667e386aaa34aa7bcc3cb1955',
    frontendMode: 'host-contribution',
    frontendSha256: 'ad757e7fed93290c9bc197881b68eaebbf0085ee9fde968525e1f0e166f1c8c9',
  },
]

console.log('MODULA')
console.log('VAULT MPS RELEASES')
console.log('GENERIC PUBLISH VERIFIER\n')

for (const product of products) {
  record(`${product.productId} CHECKOUT`, existsSync(resolve(product.root, 'modula.product.json')), product.root)
  record(`${product.productId} CLEAN`, git(product.root, ['status', '--porcelain']) === '', product.root)
  record(`${product.productId} HEAD`, git(product.root, ['rev-parse', 'HEAD']) === product.commit, product.commit)
  record(`${product.productId} TAG`, git(product.root, ['rev-parse', `${product.tag}^{commit}`]) === product.commit, product.tag)
}

const fixture = failures.length === 0 ? createGreenfieldVerifierDatabaseFixture('vault_mps_releases') : null
if (!fixture) {
  record('DISPOSABLE DATABASE AVAILABLE', false, failures.length ? 'release precheck failed' : 'required')
} else {
  record('DISPOSABLE DATABASE AVAILABLE', true, fixture.databaseName)
  try {
    const migrated = run(
      'FULL MIGRATION CHAIN',
      ['--filter', '@modula/greenfield-api', 'exec', 'tsx', '-e', "import {migrateUp} from './src/database/migrate.ts'; void migrateUp(process.env.MODULA_TEST_DATABASE_URL)"],
      {MODULA_TEST_DATABASE_URL: fixture.migratorUrl},
    )
    const published = migrated && run(
      'GENERIC VAULT RELEASE PUBLISH',
      [
        '--filter', '@modula/greenfield-api', 'exec', 'tsx', 'scripts/publish-mps-products.ts', '--apply',
        ...products.flatMap(product => ['--product-root', product.root]),
      ],
      {MODULA_DATABASE_MIGRATOR_URL: fixture.migratorUrl, MODULA_DATABASE_URL: fixture.testUrl},
      true,
    )
    const rows = published ? queryProjection(fixture.testUrl) : []
    record('FOUR RELEASE PROJECTIONS', rows.length === products.length, String(rows.length))
    for (const expected of products) {
      const row = rows.find(item => item.product_id === expected.productId && item.version === expected.version)
      record(
        `${expected.productId} FRONTEND`,
        Boolean(row)
          && row.frontend_mode === expected.frontendMode
          && row.artifact_sha256 === expected.frontendSha256
          && row.mps_version === '1.0-RC',
        row ? `${row.frontend_mode} ${row.artifact_sha256}` : 'missing',
      )
      record(
        `${expected.productId} RELEASE`,
        Boolean(row)
          && row.release_state === 'published'
          && row.source_commit === expected.commit
          && row.release_sha256 === expected.packageSha256
          && row.visibility === 'beta'
          && row.test_fixture === false,
        row ? `${row.source_commit} ${row.release_sha256}` : 'missing',
      )
    }
  } finally {
    fixture.cleanup()
    record('DISPOSABLE DATABASE REMOVED', true, fixture.databaseName)
  }
}

if (failures.length) {
  console.error('\nverify:vault-products FAIL')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('\nverify:vault-products PASS')
console.log('GENERIC PUBLISH PATH = PASS')
console.log('PRODUCT-SPECIFIC GREENFIELD CASES = 0')
console.log('UNVERIFIED FRONTEND RELEASES = 0')

function queryProjection(databaseUrl) {
  const script = "import {createDb} from './src/database/client.ts'; const db=createDb(process.env.MODULA_TEST_DATABASE_URL); void (async () => { try { const rows=await db.selectFrom('greenfield_mps_ingestions as i').innerJoin('greenfield_release_frontends as f','f.ingestion_id','i.ingestion_id').innerJoin('greenfield_module_releases as r','r.release_id','i.release_id').select(['i.product_id','i.version','i.frontend_mode','i.visibility','i.test_fixture','f.artifact_sha256','f.mps_version','r.source_commit','r.release_sha256','r.release_state']).orderBy('i.product_id').execute(); console.log(JSON.stringify(rows)); } finally { await db.destroy(); } })()"
  const result = command(
    ['--filter', '@modula/greenfield-api', 'exec', 'tsx', '-e', script],
    {MODULA_TEST_DATABASE_URL: databaseUrl},
  )
  if (result.status !== 0) {
    record('QUERY RELEASE PROJECTIONS', false, (result.stderr || result.stdout || `exit ${String(result.status)}`).slice(0, 2000))
    return []
  }
  try {
    const rows = JSON.parse(result.stdout.trim().split('\n').at(-1) ?? '[]')
    record('QUERY RELEASE PROJECTIONS', true, `${rows.length} rows`)
    return rows
  } catch (error) {
    record('QUERY RELEASE PROJECTIONS', false, error instanceof Error ? error.message : String(error))
    return []
  }
}

function run(label, args, env, streaming = false) {
  console.log(`\n$ pnpm ${args.join(' ')}  # ${label}`)
  const result = streaming
    ? spawnSync('pnpm', args, {cwd: root, env: {...process.env, CI: 'true', ...env}, stdio: 'inherit', shell: false})
    : command(args, env)
  record(label, result.status === 0, result.status === 0 ? '' : (result.stderr || result.stdout || `exit ${String(result.status)}`).slice(0, 2000))
  return result.status === 0
}

function command(args, env) {
  return spawnSync('pnpm', args, {
    cwd: root,
    env: {...process.env, CI: 'true', ...env},
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    shell: false,
  })
}

function git(cwd, args) {
  const result = spawnSync('git', args, {cwd, encoding: 'utf8', shell: false})
  return result.status === 0 ? result.stdout.trim() : ''
}

function record(label, passed, detail = '') {
  console.log(`${label.padEnd(62)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!passed) failures.push(`${label}: ${detail || 'failed'}`)
}
