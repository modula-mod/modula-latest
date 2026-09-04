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
    version: '1.6.0',
    tag: 'vault-notes-v1.6.0',
    commit: '30f73030c32f9ab49f96fe89f22d28a1320d2ad1',
    packageSha256: 'e44daa477920baf0293d27dfe4082844ba47dc91887bb4dc932bff5868334d27',
    frontendMode: 'declarative',
    frontendSha256: '56251e8c5aaa28c3db0a74c38700df1adc7c68d287cf98de4a2bb9dc3066d9f7',
  },
  {
    root: resolve(process.env.MODULA_VAULT_FORMATTING_ROOT ?? '/root/modula-mod/modula-vault-formatting'),
    productId: 'digital.modula.vault-notes.formatting',
    version: '0.4.0',
    tag: 'vault-formatting-v0.4.0',
    commit: 'f38525c315586b094637e12ee281d61dd07f167a',
    packageSha256: '6e31038086a603e02f07d14f52319ace0b3efe9dddae70ad2b15252c13bd0d2e',
    frontendMode: 'host-contribution',
    frontendSha256: 'bc4318287f602e0f25d3707cbbb4fc6b2a7f754ff8d4fb6fd2460df920a93216',
  },
  {
    root: resolve(process.env.MODULA_VAULT_AI_ROOT ?? '/root/modula-mod/modula-vault-ai'),
    productId: 'digital.modula.vault-notes.ai',
    version: '0.5.0',
    tag: 'vault-ai-v0.5.0',
    commit: 'c748b9414eb10192d3911b08741491f6da87a57c',
    packageSha256: '7206a84d353871dcdcebaa4a5fdfc232e36cd2f41b9c25dc0afbe27da6eabdae',
    frontendMode: 'host-contribution',
    frontendSha256: 'a3cded86aa979b44c5cbb4a65d7ae652749580fba76313ea2569c8d7e99497a9',
  },
  {
    root: resolve(process.env.MODULA_VAULT_VOICE_ROOT ?? '/root/modula-mod/modula-vault-voice'),
    productId: 'digital.modula.vault-notes.voice',
    version: '0.4.0',
    tag: 'vault-voice-v0.4.0',
    commit: '40f24340091255c410bcac359d394374fe244fb8',
    packageSha256: '123d55de1af744b00e82112c8dd51fe453360a6af49f90f4c354eef85bccfa10',
    frontendMode: 'host-contribution',
    frontendSha256: '5a6e72d0b4d460331262d8d307bad5bce8e11fb3a24d6b00ba13fce73d0b009f',
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
          && row.mps_version === '1.0',
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
