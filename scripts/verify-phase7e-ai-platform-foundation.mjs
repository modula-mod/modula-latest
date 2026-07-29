#!/usr/bin/env node
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

includes('packages/greenfield-contracts/src/ai.ts', [
  'GreenfieldAIProviderDefinition',
  'GreenfieldAIModelRegistryEntry',
  'GreenfieldAIRequestContract',
  'GreenfieldAIUsageLedgerEntry',
  "'openai'",
  "'anthropic'",
  "'ollama'",
  "'azure-openai'",
], 'provider-neutral AI contracts exist')

includes('packages/greenfield-module-manifest/src/ai.ts', [
  'validateGreenfieldModuleAi',
  'PROVIDER_BOUND_AI_DECLARATION',
  'features',
  'tools',
  'requiredCapabilities',
], 'module manifests declare AI capabilities without providers')

includes('services/greenfield-api/migrations/024_phase7e_ai_platform_foundation.sql', [
  'greenfield_ai_providers',
  'greenfield_ai_models',
  'greenfield_ai_prompts',
  'greenfield_ai_request_ledger',
  'greenfield_ai_tool_declarations',
  'greenfield_ai_tool_runs',
  'greenfield_ai_streams',
  'Provider credentials, autonomous planning',
], 'AI platform migration contains registry, prompt, ledger, tool and stream tables')

includes('services/greenfield-api/src/ai/gateway-service.ts', [
  'GreenfieldAIGatewayService',
  'rejectProviderBoundPayload',
  'GreenfieldPolicyEngine',
  'createRequestLedger',
  'ai.requested',
], 'AI gateway enforces policy, rejects provider payloads and records ledger/events')

includes('services/greenfield-api/src/ai/context-builder.ts', [
  'GreenfieldAIContextBuilder',
  'ai.context.build',
  'allowedResources',
  'redactedResources',
], 'AI context builder filters resources through policy')

includes('services/greenfield-api/src/ai/tool-broker.ts', [
  'GreenfieldAIToolBroker',
  'ai.tool.call',
  'confirmation_required',
  'createToolRun',
], 'AI tool broker validates permissions, schemas, side effects and confirmation')

includes('services/greenfield-api/src/ai/streaming-runtime.ts', [
  'GreenfieldAIStreamingRuntime',
  'appendToken',
  'reconnect',
  'cancel',
  'ai.stream.progress',
], 'AI streaming runtime is provider-neutral')

includes('services/greenfield-api/src/app/register-routes.ts', [
  'registerAiRoutes',
  'greenfieldAiGateway',
], 'AI routes are wired into the Greenfield API')

includes('docs/architecture/phase7e-ai-platform-foundation.md', [
  'Every AI request',
  'Module Service Mesh',
  'Explicit Deferrals',
  'does not implement Gaia autonomous planning',
], 'AI foundation architecture and deferrals are documented')

run('pnpm', ['--filter', '@modula/greenfield-contracts', 'build'], 'Greenfield AI contracts build')
run('pnpm', ['--filter', '@modula/greenfield-module-manifest', 'test'], 'Greenfield module manifest AI tests pass')
run('pnpm', ['--filter', '@modula/greenfield-module-manifest', 'build'], 'Greenfield module manifest builds')
run('pnpm', ['--filter', '@modula/greenfield-module-sdk', 'build'], 'Greenfield module SDK builds')
run('pnpm', ['--filter', '@modula/greenfield-schema-registry', 'build'], 'Greenfield schema registry builds')
run('pnpm', ['--filter', '@modula/greenfield-api', 'build'], 'Greenfield API builds')
await runIsolatedAiTest()

finish('Phase 7E AI platform foundation verifier')

async function runIsolatedAiTest() {
  const env = {...process.env}
  loadEnvFile('services/greenfield-api/.env', env)
  const baseUrl = env.MODULA_TEST_DATABASE_URL ?? env.MODULA_DATABASE_MIGRATOR_URL ?? env.MODULA_DATABASE_URL
  if (!baseUrl) {
    fail('isolated AI verifier requires MODULA_TEST_DATABASE_URL, MODULA_DATABASE_MIGRATOR_URL, or MODULA_DATABASE_URL')
    return
  }
  const parsed = new URL(baseUrl)
  const dbName = `modula_ai_verify_${process.pid}_${Date.now()}`.toLowerCase()
  const create = spawnSync(
    'docker',
    ['compose', '-f', 'ops/docker/compose.preview.yml', 'exec', '-T', 'greenfield-postgres', 'createdb', '-U', 'modula_admin', '-O', parsed.username || 'modula_migrator', dbName],
    {cwd: root, encoding: 'utf8', shell: false},
  )
  if (create.status !== 0) {
    fail('unable to create isolated AI verifier database through preview Postgres container')
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
      GREENFIELD_AI_GATEWAY_ENABLED: 'true',
    }
    run('pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/phase7e.ai-platform-foundation.test.ts'], 'isolated AI platform foundation tests', testEnv)
  } finally {
    spawnSync(
      'docker',
      ['compose', '-f', 'ops/docker/compose.preview.yml', 'exec', '-T', 'greenfield-postgres', 'dropdb', '-U', 'modula_admin', '--if-exists', dbName],
      {cwd: root, stdio: 'ignore', shell: false},
    )
    pass('dropped isolated AI verifier database')
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
