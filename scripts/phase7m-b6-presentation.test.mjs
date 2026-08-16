#!/usr/bin/env node
/**
 * Phase 7M-B6 presentation lifecycle tests.
 * Covers search state machine, permission grouping, and install CTA reachability invariants.
 */
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function section(title) {
  console.log(`\n# ${title}`)
}

section('Search state machine')
const machine = read('src/features/modules/state/productHubSearchMachine.ts')
for (const state of [
  'IDLE_LARGE_HEADER',
  'COMPACT_HEADER',
  'SEARCH_TRIGGER',
  'SEARCH_EXPANDING',
  'SEARCH_ACTIVE',
  'SEARCH_RESULTS',
  'SEARCH_COLLAPSING',
]) {
  assert.match(machine, new RegExp(state), `missing ${state}`)
}
assert.match(machine, /TAP_SEARCH/)
assert.match(machine, /GEOMETRY_SETTLED/)
assert.match(machine, /CANCEL/)
console.log('SEARCH MACHINE                 PASS')

section('Permission presentation')
const permissions = read('src/features/modules/identity/permissionPresentation.ts')
assert.match(permissions, /YOUR DATA/)
assert.match(permissions, /MODULA INTEGRATION/)
assert.match(permissions, /technical/)
assert.match(permissions, /complexity/)
assert.match(permissions, /Register |schema|route|function/)
console.log('PERMISSION GROUPS              PASS')

section('Install sheet CTA invariant')
const sheet = read('src/features/modules/components/InstallPreviewSheet.tsx')
assert.match(sheet, /footer=\{footer\}/)
assert.match(sheet, /Install \$\{copy\.name\}/)
assert.match(sheet, /module-install-confirm/)
assert.match(sheet, /Technical permissions/)
assert.doesNotMatch(
  sheet,
  /<ScrollView[\s\S]*Install \$\{copy\.name\}/,
  'Install CTA must not live inside a ScrollView',
)
const layout = read('src/platform/ui/sheets/modula-sheet-layout.tsx')
assert.match(layout, /HEADER/)
assert.match(layout, /FOOTER/)
assert.match(layout, /testID \? `\$\{testID\}-footer`/)
console.log('INSTALL CTA REACHABLE          PASS')

section('Product copy')
const copy = read('src/features/modules/identity/productCopy.ts')
assert.match(copy, /Private notes and knowledge, built into Modula/)
assert.doesNotMatch(copy, /First-party Greenfield module/)
console.log('PRODUCT COPY                   PASS')

section('Install presentation verbs')
const install = read('src/features/modules/identity/installPresentation.ts')
assert.match(install, /'Update'/)
assert.match(install, /'Soon'/)
assert.doesNotMatch(install, /primaryAction: 'Coming soon'/)
console.log('MODULE STATES                  PASS')

section('Generic host')
const host = read('src/features/modules/runtime/module-host.tsx')
assert.doesNotMatch(host, /digital\.modula\.vault-notes/)
assert.doesNotMatch(host, /if \(moduleId === /)
console.log('VAULT SPECIAL CASES            PASS')

console.log('\nphase7m-b6 presentation tests passed')
