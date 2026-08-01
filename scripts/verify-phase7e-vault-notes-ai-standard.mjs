#!/usr/bin/env node
import {existsSync} from 'node:fs'
import {join} from 'node:path'
import {fail, finish, includes, json, pass, run, standardRoot, vaultNotesRoot} from './phase7e-vault-notes-verifier-utils.mjs'

if (!existsSync(join(standardRoot, 'package.json'))) fail('external Module Standard repository is missing')
else pass('external Module Standard repository exists')
if (!existsSync(join(vaultNotesRoot, 'package.json'))) fail('external Vault Notes repository is missing')
else pass('external Vault Notes repository exists')

includes('packages/module-standard/src/index.ts', [
  'ModuleAIProductActionDefinition',
  'ModuleAIProductActionContextSource',
  'productActions?: ModuleAIProductActionDefinition[]',
], 'external Module Standard owns provider-neutral AI product action types', standardRoot)

includes('packages/module-validator/src/index.ts', [
  'validateAIProductActions',
  'PROVIDER_BOUND_AI_PRODUCT_ACTION',
  'MODULA_MODULE_STANDARD_VERSION',
], 'external Module Standard validator covers AI product actions and provider-binding rejection', standardRoot)

includes('schemas/module-manifest-1.2.schema.json', [
  'productActions',
  'requiredPermissions',
  'requiredCapabilities',
  'explicitConfirmation',
], 'external Module Standard 1.2 schema includes AI product actions', standardRoot)

const vaultManifest = json('modula.module.json')
if (vaultManifest.standardVersion === '1.2.0') pass('Vault Notes standardVersion is 1.2.0')
else fail(`Vault Notes standardVersion must be 1.2.0, got ${vaultManifest.standardVersion ?? 'missing'}`)
if (vaultManifest.moduleVersion === '1.1.0') pass('Vault Notes moduleVersion is 1.1.0')
else fail(`Vault Notes moduleVersion must be 1.1.0, got ${vaultManifest.moduleVersion ?? 'missing'}`)
if (vaultManifest.manifestSchemaVersion === '1.2.0') pass('Vault Notes manifestSchemaVersion is 1.2.0')
else fail(`Vault Notes manifestSchemaVersion must be 1.2.0, got ${vaultManifest.manifestSchemaVersion ?? 'missing'}`)

includes('src/ai/index.ts', [
  'vault-notes.ai.summarise',
  'vault-notes.ai.suggest-title',
  'vault-notes.ai.rewrite-selection',
  'vault-notes.ai.extract-action-items',
  'vault-notes.ai.suggest-tags',
  'requiredCapabilities',
], 'Vault Notes declares bounded AI product actions without provider credentials', vaultNotesRoot)

run('pnpm', ['verify'], 'external Module Standard verifier passes', standardRoot)
run('pnpm', ['verify'], 'external Vault Notes verifier passes', vaultNotesRoot)

finish('Phase 7E Vault Notes AI standard verifier')
