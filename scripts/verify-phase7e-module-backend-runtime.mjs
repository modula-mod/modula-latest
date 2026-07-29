#!/usr/bin/env node
import {existsSync, readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {
  fail,
  failures,
  finish,
  includes,
  pass,
  root,
  run,
  standardRoot,
} from './phase7e-module-backend-verifier-utils.mjs'

for (const verifier of [
  'verify-phase7e-module-backend-standard.mjs',
  'verify-phase7e-module-backend-discovery.mjs',
  'verify-phase7e-module-backend-auth.mjs',
  'verify-phase7e-module-backend-gateway.mjs',
  'verify-phase7e-module-backend-events.mjs',
  'verify-phase7e-module-backend-webhooks.mjs',
  'verify-phase7e-module-backend-health.mjs',
  'verify-phase7e-module-backend-security.mjs',
  'verify-phase7e-module-backend-conformance.mjs',
]) {
  run('node', [`scripts/${verifier}`], verifier)
}

run('pnpm', ['verify'], 'external Standard 1.1 verifier passes', process.env, standardRoot)
includes('src/features/marketplace/screens/ModuleDetailScreen.tsx', [
  'Section title="Backend"',
  'Section title="Data location"',
  'Platform permissions',
  'Module backend permissions',
  'External service permissions',
], 'Product Hub module detail displays backend ownership, data location and permission groups')
includes('src/features/modules/screens/ModuleManagementScreen.tsx', [
  'SettingsSection title="Backend"',
  'Reverify',
  'Health check',
  'Disable backend',
  'useModuleBackendDiagnosticsQuery',
], 'Settings module management displays backend diagnostics and controls')
includes('src/data/repositories/api/ApiModuleRepository.ts', [
  '/backend/discover',
  '/backend/health',
  '/backend/disable',
  'decodeBackendMetadata',
  'greenfield-managed',
  'module-managed',
  'frontend-only',
], 'frontend module repository consumes backend diagnostics and management routes')
run('pnpm', ['--filter', '@modula/greenfield-module-manifest', 'build'], 'Greenfield manifest package builds')
run('pnpm', ['--filter', '@modula/greenfield-api', 'build'], 'Greenfield API builds')
await runIsolatedRuntimeTest()

finish('Phase 7E module backend runtime verifier')

async function runIsolatedRuntimeTest() {
  const env = {...process.env}
  loadEnvFile('services/greenfield-api/.env', env)
  const baseUrl = env.MODULA_TEST_DATABASE_URL ?? env.MODULA_DATABASE_MIGRATOR_URL ?? env.MODULA_DATABASE_URL
  if (!baseUrl) {
    fail('isolated runtime test requires MODULA_TEST_DATABASE_URL, MODULA_DATABASE_MIGRATOR_URL, or MODULA_DATABASE_URL')
    return
  }
  const parsed = new URL(baseUrl)
  const dbName = `modula_backend_verify_${process.pid}_${Date.now()}`.toLowerCase()
  const create = spawnSync(
    'docker',
    ['compose', '-f', 'ops/docker/compose.preview.yml', 'exec', '-T', 'greenfield-postgres', 'createdb', '-U', 'modula_admin', '-O', parsed.username || 'modula_migrator', dbName],
    {cwd: root, encoding: 'utf8', shell: false},
  )
  if (create.status !== 0) {
    fail(`unable to create isolated module backend verifier database through preview Postgres container`)
    return
  }
  try {
    parsed.pathname = `/${dbName}`
    const testEnv = {
      ...env,
      MODULA_TEST_DATABASE_URL: parsed.toString(),
      MODULA_DATABASE_URL: parsed.toString(),
      MODULA_DATABASE_MIGRATOR_URL: parsed.toString(),
      MODULA_RATE_LIMIT_ENABLED: 'false',
    }
    run('pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/phase7e.module-backend-runtime.test.ts'], 'isolated module backend runtime tests', testEnv)
  } finally {
    spawnSync(
      'docker',
      ['compose', '-f', 'ops/docker/compose.preview.yml', 'exec', '-T', 'greenfield-postgres', 'dropdb', '-U', 'modula_admin', '--if-exists', dbName],
      {cwd: root, stdio: 'ignore', shell: false},
    )
    pass('dropped isolated module backend verifier database')
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
