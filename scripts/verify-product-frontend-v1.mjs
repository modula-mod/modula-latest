#!/usr/bin/env node
import {spawnSync} from 'node:child_process'
import {existsSync, readFileSync, readdirSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createGreenfieldVerifierDatabaseFixture} from './greenfield-backend-v1-database-fixture.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

function record(label, passed, detail = '') {
  console.log(`${label.padEnd(58)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!passed) failures.push(`${label}: ${detail || 'failed'}`)
}

function source(rel, needles, label) {
  const text = readFileSync(join(ROOT, rel), 'utf8')
  const missing = needles.filter(needle => !text.includes(needle))
  record(label, missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : rel)
}

function run(label, command, args, env = process.env, cwd = ROOT) {
  console.log(`\n$ ${command} ${args.join(' ')}  # ${label}`)
  const result = spawnSync(command, args, {cwd, env, encoding: 'utf8', shell: false})
  record(label, result.status === 0, result.status === 0 ? '' : (result.stderr || result.stdout || `exit ${result.status}`).slice(0, 3000))
}

function runStreaming(label, command, args, env = process.env, cwd = ROOT) {
  console.log(`\n$ ${command} ${args.join(' ')}  # ${label}`)
  const result = spawnSync(command, args, {cwd, env, stdio: 'inherit', shell: false})
  record(label, result.status === 0, result.status === 0 ? '' : `exit ${String(result.status)}`)
}

function scan(dir, matcher, label) {
  const hits = []
  const visit = current => {
    if (!existsSync(current)) return
    for (const entry of readdirSync(current, {withFileTypes: true})) {
      const file = join(current, entry.name)
      if (entry.isDirectory()) visit(file)
      else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name) && matcher.test(readFileSync(file, 'utf8'))) hits.push(file.slice(ROOT.length + 1))
    }
  }
  visit(join(ROOT, dir))
  record(label, hits.length === 0, hits.join(', '))
}

console.log('MODULA')
console.log('PRODUCT-OWNED FRONTEND V1')
console.log('VERIFIER\n')

source('packages/greenfield-product-standard/src/frontend.ts', [
  'validateMpsFrontendArtifact',
  'MPS-FRONTEND-SECURITY-001',
  'Frontend component tree exceeds safety limits',
], 'MPS FRONTEND VALIDATOR')
source('services/greenfield-api/migrations/055_mps_product_frontend_runtime.sql', [
  'greenfield_release_frontends',
  'runtime_projection',
  'greenfield_release_frontends_immutable',
], 'RELEASE FRONTEND PROJECTION')
source('services/greenfield-api/src/product-standard/frontend-service.ts', [
  "source: 'legacy'",
  "source: 'mps'",
  ".where('release_id', '=', context.releaseId)",
], 'EXACT RELEASE RESOLUTION')
source('src/features/modules/runtime/module-host.tsx', [
  'useModuleFrontendQuery',
  'resolveMpsFrontendRoute',
  'adaptMpsFrontendView',
  'No legacy or unverified UI was loaded',
], 'GENERIC MODULE HOST')
source('src/features/modules/runtime/mps-frontend-adapter.ts', [
  'resolveMpsFrontendRoute',
  'adaptMpsFrontendView',
], 'EXISTING RENDERER ADAPTER')
source('services/greenfield-api/scripts/publish-mps-products.ts', [
  'frontend: product.frontend',
  'schemas: product.schemas',
  'resolveProductArtifact',
], 'GENERIC FRONTEND PUBLISH')

scan('src/features/modules/runtime', /if\s*\([^)]*(?:productId|moduleId)[^)]*(?:===|==)[^)]*(?:vault-notes|reference-tasks)/i, 'PRODUCT-SPECIFIC HOST BRANCHES')
scan('src/features/modules/runtime', /(?:eval\s*\(|from\s+['\"]react-native-webview['\"]|remoteBundle)/i, 'ARBITRARY FRONTEND EXECUTION')

run('API WORKSPACE CONTRACTS BUILD', 'pnpm', ['--filter', '@modula/greenfield-api^...', 'build'])
run('PRODUCT STANDARD TESTS', 'pnpm', ['--filter', '@modula/greenfield-product-standard', 'test'], {...process.env, CI: 'true'})
run(
  'MPS RECORD RUNTIME PROJECTION',
  'pnpm',
  ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-mps-record-projection.test.ts'],
  {...process.env, CI: 'true'},
)
run('HOST TYPES', 'pnpm', ['exec', 'tsc', '--noEmit'])
run(
  'GENERIC RENDERER ADAPTER',
  'pnpm',
  ['--filter', '@modula/greenfield-api', 'exec', 'tsx', '--tsconfig', '../../tsconfig.json', '../../scripts/test-mps-frontend-adapter.ts', '--require-vault'],
)

const fixture = createGreenfieldVerifierDatabaseFixture('product_frontend_v1')
if (!fixture) {
  record('DISPOSABLE DATABASE AVAILABLE', false, 'required')
} else {
  record('DISPOSABLE DATABASE AVAILABLE', true, fixture.databaseName)
  try {
    run(
      'FRONTEND INGEST AND SECURITY DB TESTS',
      'pnpm',
      ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-mps-v1.ingest.test.ts'],
      {...process.env, CI: 'true', NODE_ENV: 'test', MODULA_TEST_DATABASE_URL: fixture.testUrl},
    )
    run(
      'EXACT RELEASE FRONTEND RUNTIME',
      'pnpm',
      ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield-product-frontend-v1.runtime.test.ts'],
      {...process.env, CI: 'true', NODE_ENV: 'test', MODULA_TEST_DATABASE_URL: fixture.testUrl},
    )
  } finally {
    fixture.cleanup()
    record('DISPOSABLE DATABASE REMOVED', true, fixture.databaseName)
  }
}

runStreaming(
  'REFERENCE TASKS ZERO-CORE RUNTIME',
  'node',
  ['scripts/verify-reference-tasks-zero-core.mjs'],
  {...process.env, CI: 'true', MODULA_HOST_ROOT: ROOT},
)

if (failures.length) {
  console.error('\nverify:product-frontend-v1 FAIL')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('\nverify:product-frontend-v1 PASS')
console.log('REMOTE ARBITRARY JS = 0')
console.log('PRODUCT-SPECIFIC HOST CASES = 0')
