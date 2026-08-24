#!/usr/bin/env node
import {existsSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {fail, finish, includes, json, pass, root, run, standardRoot, vaultNotesRoot} from './phase7e-vault-notes-verifier-utils.mjs'

const vaultAiRoot = resolve(root, '../modula-mod/modula-vault-ai')

if (!existsSync(join(standardRoot, 'package.json'))) fail('external Module Standard repository is missing')
else pass('external Module Standard repository exists')
if (!existsSync(join(vaultNotesRoot, 'package.json'))) fail('external Vault Notes repository is missing')
else pass('external Vault Notes repository exists')
if (!existsSync(join(vaultAiRoot, 'package.json'))) fail('external Vault AI repository is missing')
else pass('external Vault AI repository exists')

includes('packages/module-standard/src/index.ts', [
  'ModuleAIProductActionDefinition',
  'ModuleAIProductActionContextSource',
  'productActions?: ModuleAIProductActionDefinition[]',
], 'external Module Standard owns provider-neutral AI product action types', standardRoot)

includes('packages/module-validator/src/index.ts', [
  'validateAIProductActions',
  'PROVIDER_BOUND_AI_PRODUCT_ACTION',
  'validateExtensionProduct',
  'EXTENSION_PRODUCT_REQUIRES_STANDARD_2_1',
], 'external Module Standard validator covers AI product actions and provider-binding rejection', standardRoot)

includes('packages/module-standard/src/standard-2.ts', [
  'ModulaExtensionProductKind',
  'ModulaExtensionContribution',
  'ModulaExtensionGraphPolicy',
  'addon',
], 'external Module Standard 2.1 owns extension products and contributions', standardRoot)

includes('schemas/module-manifest-2.1.schema.json', ['extensionProduct', 'contributions', 'retention', 'graphPolicy'], 'external Module Standard 2.1 schema includes extension products', standardRoot)

const vaultManifest = json('modula.module.json')
if (vaultManifest.standardVersion === '2.1.0') pass('Vault Notes standardVersion is 2.1.0')
else fail(`Vault Notes standardVersion must be 2.1.0, got ${vaultManifest.standardVersion ?? 'missing'}`)
if (vaultManifest.moduleVersion === '1.2.0') pass('Vault Notes moduleVersion is 1.2.0')
else fail(`Vault Notes moduleVersion must be 1.2.0, got ${vaultManifest.moduleVersion ?? 'missing'}`)
if (vaultManifest.manifestSchemaVersion === '2.1.0') pass('Vault Notes manifestSchemaVersion is 2.1.0')
else fail(`Vault Notes manifestSchemaVersion must be 2.1.0, got ${vaultManifest.manifestSchemaVersion ?? 'missing'}`)

if (!existsSync(join(vaultNotesRoot, 'src/ai'))) pass('Vault Notes core contains no embedded AI implementation')
else fail('Vault Notes core must not contain src/ai')

const aiManifest = json('modula.module.json', vaultAiRoot)
if (aiManifest.id === 'digital.modula.vault-notes.ai' && aiManifest.extensionProduct?.kind === 'addon') pass('Vault AI is a separate add-on product')
else fail('Vault AI add-on identity mismatch')
if (aiManifest.extensionProduct?.targets?.[0]?.productId === 'digital.modula.vault-notes') pass('Vault AI targets Vault Notes declaratively')
else fail('Vault AI target mismatch')
includes('src/index.ts', ['ModulaAIProvider', 'AI_PROVIDER_UNAVAILABLE', 'VAULT_AI_TEST_ONLY', 'TEST_ONLY'], 'Vault AI provider abstraction and honest unavailable state', vaultAiRoot)

run('pnpm', ['verify'], 'external Module Standard verifier passes', standardRoot)
run('pnpm', ['verify'], 'external Vault Notes verifier passes', vaultNotesRoot)
run('pnpm', ['verify'], 'external Vault AI verifier passes', vaultAiRoot)

finish('Phase 7E Vault Notes AI standard verifier')
