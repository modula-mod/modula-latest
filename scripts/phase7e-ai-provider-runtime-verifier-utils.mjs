import {existsSync, readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {
  fail,
  finish,
  includes,
  pass,
  root,
  run,
} from './phase7e-module-backend-verifier-utils.mjs'

export {
  fail,
  finish,
  includes,
  pass,
  root,
  run,
}

export function verifierIncludes(path, markers, label) {
  return includes(path, markers, label)
}

export async function runIsolatedProviderRuntimeTest() {
  const env = {...process.env}
  loadEnvFile('services/greenfield-api/.env', env)
  const baseUrl = env.MODULA_TEST_DATABASE_URL ?? env.MODULA_DATABASE_MIGRATOR_URL ?? env.MODULA_DATABASE_URL
  if (!baseUrl) {
    fail('isolated AI provider runtime verifier requires MODULA_TEST_DATABASE_URL, MODULA_DATABASE_MIGRATOR_URL, or MODULA_DATABASE_URL')
    return
  }
  const parsed = new URL(baseUrl)
  const dbName = `modula_ai_runtime_verify_${process.pid}_${Date.now()}`.toLowerCase()
  const create = spawnSync(
    'docker',
    ['compose', '-f', 'ops/docker/compose.preview.yml', 'exec', '-T', 'greenfield-postgres', 'createdb', '-U', 'modula_admin', '-O', parsed.username || 'modula_migrator', dbName],
    {cwd: root, encoding: 'utf8', shell: false},
  )
  if (create.status !== 0) {
    fail('unable to create isolated AI provider runtime verifier database through preview Postgres container')
    return
  }
  try {
    parsed.pathname = `/${dbName}`
    const testEnv = {
      ...env,
      NODE_ENV: 'test',
      MODULA_TEST_DATABASE_URL: parsed.toString(),
      MODULA_DATABASE_URL: parsed.toString(),
      MODULA_DATABASE_MIGRATOR_URL: parsed.toString(),
      MODULA_RATE_LIMIT_ENABLED: 'false',
      GREENFIELD_AI_GATEWAY_ENABLED: 'true',
    }
    run('pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/phase7e.ai-provider-runtime.test.ts'], 'isolated AI provider runtime tests', testEnv)
    run(
      'pnpm',
      [
        '--filter',
        '@modula/greenfield-api',
        'exec',
        'tsx',
        '-e',
        "import {migrateDown, migrateUp} from './src/database/migrate.ts'; void (async () => { const down = await migrateDown(process.env.MODULA_TEST_DATABASE_URL); if (down !== '025_phase7e_ai_provider_runtime') { console.error(`expected 025 rollback, got ${down}`); process.exit(1) } const applied = await migrateUp(process.env.MODULA_TEST_DATABASE_URL); if (!applied.includes('025_phase7e_ai_provider_runtime')) { console.error(`025 migration did not reapply: ${applied.join(',')}`); process.exit(1) } })().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1) })",
      ],
      'AI provider runtime migration rolls back and reapplies',
      testEnv,
      `${root}/services/greenfield-api`,
    )
  } finally {
    spawnSync(
      'docker',
      ['compose', '-f', 'ops/docker/compose.preview.yml', 'exec', '-T', 'greenfield-postgres', 'dropdb', '-U', 'modula_admin', '--if-exists', dbName],
      {cwd: root, stdio: 'ignore', shell: false},
    )
    pass('dropped isolated AI provider runtime verifier database')
  }
}

function loadEnvFile(path, env) {
  if (!existsSync(path)) return
  const text = readFileSync(path, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index)
    const value = trimmed.slice(index + 1)
    if (!env[key]) env[key] = value
  }
}
