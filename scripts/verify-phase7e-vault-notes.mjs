#!/usr/bin/env node
import {
  fail,
  finish,
  pass,
  rollbackLatestMigration,
  root,
  run,
  verifyTableAbsent,
  withIsolatedDatabase,
} from './phase7e-vault-notes-verifier-utils.mjs'

for (const script of [
  'scripts/verify-phase7e-vault-notes-standard.mjs',
  'scripts/verify-phase7e-vault-notes-data-integrity.mjs',
  'scripts/verify-phase7e-vault-notes-lifecycle.mjs',
  'scripts/verify-phase7e-vault-notes-search.mjs',
  'scripts/verify-phase7e-vault-notes-security.mjs',
  'scripts/verify-phase7e-vault-notes-host.mjs',
  'scripts/verify-phase7e-vault-notes-release.mjs',
]) {
  run('node', [script], `${script} passes`)
}

run('pnpm', ['--filter', '@modula/greenfield-api', 'typecheck'], 'Greenfield API typecheck passes')
run('pnpm', ['--filter', '@modula/greenfield-worker', 'typecheck'], 'Greenfield worker typecheck passes')

await withIsolatedDatabase('Vault Notes final lifecycle proof', async env => {
  run(
    'pnpm',
    ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/phase7e.vault-notes-platform.test.ts'],
    'isolated Vault Notes API lifecycle/data/search/security test',
    root,
    env,
  )
  run(
    'pnpm',
    ['--filter', '@modula/greenfield-worker', 'exec', 'vitest', 'run', 'tests/phase7e.vault-notes-search-projector.test.ts'],
    'isolated Vault Notes worker search projector test',
    root,
    env,
  )
  await rollbackLatestMigration(env, '022_phase7e_module_records_and_vault_notes')
  await verifyTableAbsent(env, 'greenfield_module_export_jobs')
  pass('disposable migration 022 apply and rollback verified')
})

if (process.env.MODULA_VAULT_NOTES_FINAL_LINT === '1') {
  run('pnpm', ['lint'], 'main app lint passes')
  run('pnpm', ['typecheck'], 'main app typecheck passes')
} else {
  pass('main app lint/typecheck covered by explicit block gates; set MODULA_VAULT_NOTES_FINAL_LINT=1 to rerun inside final verifier')
}

finish('Phase 7E Vault Notes final verifier')
