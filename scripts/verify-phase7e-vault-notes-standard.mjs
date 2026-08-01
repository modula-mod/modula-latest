#!/usr/bin/env node
import {existsSync} from 'node:fs'
import {join} from 'node:path'
import {fail, finish, git, includes, json, pass, run, runQuiet, standardRoot, vaultNotesRoot} from './phase7e-vault-notes-verifier-utils.mjs'

if (!existsSync(join(vaultNotesRoot, 'package.json'))) fail('external Vault Notes repository is missing')
else pass('external Vault Notes repository exists')

run('pnpm', ['verify'], 'external Vault Notes verifier passes', vaultNotesRoot)

const standardHead = git(standardRoot, ['rev-parse', 'HEAD'])
const standardTag = git(standardRoot, ['rev-list', '-n', '1', 'mms-v1.2.0'])
if (standardHead && standardTag && isAncestor(standardRoot, standardTag, standardHead)) {
  pass('mms-v1.2.0 release commit is contained in current Module Standard HEAD')
} else {
  fail(`mms-v1.2.0 must be contained in Module Standard HEAD; head=${standardHead ?? 'unknown'} tag=${standardTag ?? 'unknown'}`)
}

const standardManifest = json('modula.module.json')
for (const [field, expected] of Object.entries({
  standardVersion: '1.2.0',
  moduleVersion: '1.1.0',
  manifestSchemaVersion: '1.2.0',
  dataSchemaVersion: '1.0.0',
})) {
  if (standardManifest[field] === expected) pass(`${field} is ${expected}`)
  else fail(`${field} must be ${expected}`)
}
if (standardManifest.id === 'modula.vault-notes') pass('stable module id is modula.vault-notes')
else fail('stable module id mismatch')

includes('package.json', [
  '@modula/module-standard',
  '@modula/module-validator',
  '@modula/module-sdk',
], 'external Standard 1.2 package dependencies', vaultNotesRoot)
includes('scripts/verify-release.mjs', ['validateModulaModuleManifest', 'Standard source is not copied'], 'Vault Notes release verifier', vaultNotesRoot)
includes('docs/operations/module-standard-package-consumption.md', [
  'development-only',
  'mms-v1.2.0',
  'provider-neutral AI product actions',
  'fail closed',
], 'main app module-standard package consumption documentation')

finish('Phase 7E Vault Notes standard verifier')

function isAncestor(cwd, ancestor, descendant) {
  return runQuiet('git', ['-C', cwd, 'merge-base', '--is-ancestor', ancestor, descendant]).status === 0
}
