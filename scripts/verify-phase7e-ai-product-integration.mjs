#!/usr/bin/env node
import {
  finish,
  includes,
  pass,
  root,
  rollbackLatestMigration,
  run,
  verifyTableAbsent,
  withIsolatedDatabase,
} from './phase7e-vault-notes-verifier-utils.mjs'

for (const script of [
  'scripts/verify-phase7e-ai-product-actions.mjs',
  'scripts/verify-phase7e-ai-context-boundaries.mjs',
  'scripts/verify-phase7e-ai-product-streaming.mjs',
  'scripts/verify-phase7e-ai-result-application.mjs',
  'scripts/verify-phase7e-ai-product-security.mjs',
  'scripts/verify-phase7e-vault-notes-ai-standard.mjs',
  'scripts/verify-phase7e-vault-notes-ai-integration.mjs',
]) {
  run('node', [script], `${script} passes`)
}

includes('src/features/modules/components/ModuleAIActionMenu.tsx', [
  'mutations.execute',
  'mutations.apply',
  'Generated content may be inaccurate',
], 'frontend AI UI invokes generic module AI APIs only')

run('pnpm', ['--filter', '@modula/api-contracts', 'build'], 'API contracts build')
run('pnpm', ['--filter', '@modula/greenfield-module-manifest', 'build'], 'Greenfield module manifest package builds')
run('pnpm', ['--filter', '@modula/greenfield-api', 'typecheck'], 'Greenfield API typecheck passes')
run('pnpm', ['typecheck'], 'main app typecheck passes')

await withIsolatedDatabase('AI product action final DB proof', async env => {
  run(
    'pnpm',
    ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/phase7e.ai-product-actions.test.ts'],
    'isolated AI product action optional-permission, preview/apply, provenance and security test',
    root,
    env,
  )
  await rollbackLatestMigration(env, '026_phase7e_ai_product_actions')
  await verifyTableAbsent(env, 'ai_product_action_executions')
  await verifyTableAbsent(env, 'ai_product_action_results')
  await verifyTableAbsent(env, 'ai_product_action_applications')
  pass('disposable migration 026 apply and rollback verified')
})

pass('No production deployment is performed by this verifier')
finish('Phase 7E AI product integration verifier')
