#!/usr/bin/env node
/**
 * Canonical Vault Notes verifier.
 *
 * Fails if two active Vault Notes products, two source repos, missing
 * provenance fields, a legacy ID exposed as a product, or Module Host
 * special-casing Vault Notes rendering.
 */
import {existsSync, readFileSync, readdirSync} from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []

function rel(...parts) {
  return path.join(root, ...parts)
}

function record(label, ok, detail = '') {
  console.log(`${label.padEnd(42)} ${ok ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(detail ? `${label}: ${detail}` : label)
}

function read(file) {
  const full = rel(file)
  if (!existsSync(full)) {
    record(file, false, 'missing')
    return ''
  }
  return readFileSync(full, 'utf8')
}

const identity = read('packages/greenfield-contracts/src/canonical-module-identity.ts')
record('CANONICAL ID DECLARED', identity.includes("CANONICAL_VAULT_NOTES_MODULE_ID = 'digital.modula.vault-notes'"))
record('CANONICAL REPO DECLARED', identity.includes("CANONICAL_VAULT_NOTES_REPOSITORY = 'modula-mod/modula-vault-notes'"))
record('ARTIFACT SHA DECLARED', identity.includes('46f918b07dc7d9c2734be4e6bb7729c137d316ceaa3f9d272da1bd7f78ad253a'))
record('LEGACY ALIAS DECLARED', identity.includes("'modula.vault-notes'"))
record('NO THIRD PRODUCT', !identity.includes('vault-notes-something') && !identity.includes('1.2.0'))

const decision = read('docs/architecture/vault-notes-canonical-identity.md')
record('DECISION DOC', decision.includes('CANONICAL MODULE ID:') && decision.includes('digital.modula.vault-notes'))
record('ONE PRODUCT LANGUAGE', decision.includes('There is one Vault Notes') && !decision.includes('both are technically valid'))

const lineage = read('docs/architecture/vault-notes-release-lineage.md')
record('LINEAGE DOC', lineage.includes('Selected current version: 1.1.0'))
record('NO INVENTED 1.2.0', lineage.includes('Why not invent 1.2.0'))

const policy = read('services/greenfield-api/src/modules/beta-catalogue-policy.ts')
record('LEGACY PRODUCT HIDDEN', policy.includes("'modula.vault-notes': 'digital.modula.vault-notes'"))

const overlay = read('services/greenfield-api/src/modules/canonical-manifest.ts')
record('IMPORT OVERLAY', overlay.includes('canonicalizeVaultNotesManifest'))

const routes = read('services/greenfield-api/src/modules/routes/index.ts')
record('ALIAS BEFORE BUSINESS LOGIC', routes.includes('canonicalModuleParam') && routes.includes('resolveCanonicalModuleId'))

const host = read('src/features/modules/runtime/module-host.tsx')
record('MODULE HOST NO SPECIAL CASE', !/vault-notes/i.test(host))
const resolver = read('src/features/modules/runtime/module-route-resolver.ts')
record('RESOLVER NO SPECIAL CASE', !/vault-notes/i.test(resolver))

const renderer = read('src/features/modules/runtime/module-view-renderer.tsx')
record('VIEW RENDERER GENERIC', !/vault-notes/i.test(renderer))

record('NO FEATURE FOLDER', !existsSync(rel('src/features/vault-notes')))
record('NO APP FEATURE SCREEN', !existsSync(rel('src/app/vault-notes.tsx')))

const card = read('src/features/modules/components/ModuleCatalogueCard.tsx')
record('CARD HIDES MODULE ID', !card.includes('digital.modula.vault-notes') && !card.includes('checksum'))
record('CARD HAS INSTALL ACTION', card.includes("actionLabel") && card.includes('Install'))

const tabBar = read('src/platform/ui/navigation/modula-liquid-glass-tab-bar.tsx')
record(
  'TAB BAR OPAQUE CHROME',
  !tabBar.includes("from 'expo-blur'") &&
    !tabBar.includes("require('@callstack/liquid-glass')") &&
    tabBar.includes('ChromeSurface') &&
    tabBar.includes('surfaceRaised'),
)

const lab = read('src/platform/ui/dev/modula-primitives-lab.tsx')
for (const primitive of [
  'Typography',
  'Surface',
  'Icons',
  'Buttons',
  'Fields',
  'OTP',
  'Search',
  'Secure field',
  'Segmented control',
  'Switch',
  'Sheet',
  'Popover',
  'Context menu',
  'Drawer',
  'Avatar',
  'Story Ring',
  'Post Card',
  'Reaction Picker',
  'Comment Thread',
  'Module Card',
  'Install Button',
  'Install Progress',
  'Permissions',
  'Module Status',
]) {
  record(`UI LAB ${primitive.toUpperCase()}`, lab.includes(`title="${primitive}"`) || lab.includes(`title="${primitive}`))
}

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const next = path.join(dir, entry.name)
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') walk(next, acc)
    else if (entry.isFile() && /\.(ts|tsx|mjs)$/.test(entry.name)) acc.push(next)
  }
  return acc
}

const appFiles = walk(rel('src/app')).concat(walk(rel('src/features/modules/runtime')))
const specialScreens = appFiles.filter(file => {
  const text = readFileSync(file, 'utf8')
  return /VaultNotesScreen|function VaultNotes|features\/vault-notes/.test(text)
})
record('MODULE HOST SPECIAL CASES', specialScreens.length === 0, specialScreens.join(', '))

if (failures.length) {
  console.error('\nverify:vault-notes-canonical FAIL')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('\nverify:vault-notes-canonical PASS')
process.exit(0)
