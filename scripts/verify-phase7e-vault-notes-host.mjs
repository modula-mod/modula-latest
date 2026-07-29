#!/usr/bin/env node
import {existsSync} from 'node:fs'
import {join} from 'node:path'
import {fail, finish, includes, pass, root} from './phase7e-vault-notes-verifier-utils.mjs'

for (const path of ['src/features/vault-notes', 'app/vault-notes', 'src/data/repositories/api/VaultNotesRepository.ts']) {
  if (existsSync(join(root, path))) fail(`hardcoded Vault Notes host path exists: ${path}`)
  else pass(`hardcoded Vault Notes host path absent: ${path}`)
}

includes('src/features/modules/runtime/module-route-resolver.ts', [
  'settings',
  'view.collection === requested',
  "view.kind === 'collection'",
], 'generic module route resolver')
includes('src/features/modules/runtime/module-field-renderer.tsx', [
  "field.type === 'json'",
  "field.type === 'number'",
  'JSON.parse',
  'keyboardType',
], 'generic module JSON/number field renderer')
includes('src/features/modules/runtime/module-host.tsx', [
  'ModulePermissionGate',
  'Release quarantined',
  'Configuration required',
  'Module disabled',
], 'generic module host states')
includes('src/features/modules/screens/ModuleManagementScreen.tsx', [
  'useModuleHealthQuery',
  'Diagnostics',
  'SchemaSettingsRenderer',
  'formatDiagnosticCounts',
], 'generic module settings and health renderer')
includes('src/data/repositories/api/ApiModuleRepository.ts', [
  '/v1/modules/',
  '/health',
  'decodeHealth',
  'recordOrUndefined',
], 'module repository health API client')

finish('Phase 7E Vault Notes host verifier')
