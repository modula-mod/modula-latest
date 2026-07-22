#!/usr/bin/env node
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import {
  validateGreenfieldModuleView,
} from '@modula/greenfield-module-ui-contracts'
import {validateGreenfieldModuleManifest} from '@modula/greenfield-module-manifest'

const root = process.cwd()
const vaultRoot = '/home/andrei/modules/modula-module-vault-notes'
const errors = []

function read(abs) {
  if (!fs.existsSync(abs)) {
    errors.push(`missing ${abs}`)
    return ''
  }
  return fs.readFileSync(abs, 'utf8')
}

function json(abs) {
  try {
    return JSON.parse(read(abs))
  } catch (error) {
    errors.push(`invalid JSON ${abs}: ${error instanceof Error ? error.message : String(error)}`)
    return {}
  }
}

function sh(args, cwd = root) {
  return execFileSync(args[0], args.slice(1), {cwd, encoding: 'utf8'}).trim()
}

function maybeRg(args, cwd = root) {
  try {
    return sh(args, cwd)
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 1) return ''
    throw error
  }
}

if (!fs.existsSync(vaultRoot)) errors.push(`external Vault Notes repo missing: ${vaultRoot}`)

const forbiddenHostDir = maybeRg(['rg', '--files', 'src/features'])
  .split('\n')
  .filter(Boolean)
  .filter(file => /src\/features\/vault[-_]/.test(file))
if (forbiddenHostDir.length) errors.push(`host contains Vault-specific feature files: ${forbiddenHostDir.join(', ')}`)

if (fs.existsSync(vaultRoot)) {
  const manifestPath = path.join(vaultRoot, 'module.manifest.json')
  const manifest = json(manifestPath)
  const manifestResult = validateGreenfieldModuleManifest(manifest)
  if (!manifestResult.valid) errors.push(`Vault manifest invalid: ${manifestResult.issues.map(issue => `${issue.code} ${issue.path}`).join('; ')}`)
  if (manifest.version !== '0.2.0') errors.push(`Vault Notes version is ${manifest.version}, expected 0.2.0`)

  const requiredViews = [
    'vault-home.v1.json',
    'note-list.v1.json',
    'note-detail.v1.json',
    'note-editor.v1.json',
    'folder-list.v1.json',
    'folder-editor.v1.json',
    'search.v1.json',
    'empty-state.v1.json',
  ]
  for (const viewFile of requiredViews) {
    const view = json(path.join(vaultRoot, 'views', viewFile))
    const result = validateGreenfieldModuleView(view)
    if (!result.valid) errors.push(`${viewFile} invalid: ${result.issues.map(issue => `${issue.code} ${issue.path}`).join('; ')}`)
  }

  const repoText = maybeRg(['rg', '-n', 'end-to-end encrypted|zero knowledge|cryptographically private', '.'], vaultRoot)
  if (/end-to-end encrypted|zero knowledge|cryptographically private/i.test(repoText)) {
    errors.push('Vault Notes makes unverified encryption/privacy claims')
  }
  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions.map(permission => String(permission.permission ?? '')) : []
  if (permissions.some(permission => permission.startsWith('network:') || permission.startsWith('dimon:'))) {
    errors.push('Vault Notes declares forbidden network or DIMON permissions')
  }

  const schemaText = maybeRg(['rg', '-n', 'defaultVisibility|visibility|searchableFields|sourceUri|source URI|tags', 'schemas', 'views'], vaultRoot)
  for (const needle of ['private', 'searchableFields', 'sourceUri', 'tags']) {
    if (!schemaText.includes(needle)) errors.push(`Vault Notes declarations missing ${needle}`)
  }
}

const importer = read(path.join(root, 'scripts/registry/import-module.mjs'))
if (!importer.includes('collectViewDeclarations') || !importer.includes('greenfield_module_record_collections')) {
  errors.push('host importer does not import external module views/collections')
}

if (errors.length) {
  console.error('Phase 7B Vault Notes verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 7B Vault Notes verification passed.')
