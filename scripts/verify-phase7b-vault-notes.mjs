#!/usr/bin/env node
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import {validateGreenfieldModuleManifest} from '@modula/greenfield-module-manifest'

const root = process.cwd()
const vaultRoot = process.env.MODULA_VAULT_NOTES_ROOT ?? '/root/modula-mod/modula-vault-notes'
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
  const moduleDescriptor = json(path.join(vaultRoot, 'modula.module.json'))
  const manifestResult = validateGreenfieldModuleManifest(manifest)
  if (!manifestResult.valid) errors.push(`Vault manifest invalid: ${manifestResult.issues.map(issue => `${issue.code} ${issue.path}`).join('; ')}`)
  if (manifest.version !== '1.1.0') errors.push(`Vault Notes version is ${manifest.version}, expected 1.1.0`)
  if (moduleDescriptor.standardVersion !== '1.2.0') errors.push(`Vault Notes Standard is ${moduleDescriptor.standardVersion}, expected 1.2.0`)
  if (moduleDescriptor.moduleVersion !== '1.1.0') errors.push(`Vault Notes moduleVersion is ${moduleDescriptor.moduleVersion}, expected 1.1.0`)

  const recordIds = new Set((moduleDescriptor.records ?? []).map(record => String(record.id ?? '')))
  for (const id of [
    'modula.vault-notes.record.note',
    'modula.vault-notes.record.folder',
    'modula.vault-notes.record.tag',
    'modula.vault-notes.record.note-link',
    'modula.vault-notes.record.note-version',
    'modula.vault-notes.record.saved-source',
  ]) {
    if (!recordIds.has(id)) errors.push(`Vault Notes descriptor missing record ${id}`)
  }

  const viewIds = new Set((moduleDescriptor.views ?? []).map(view => String(view.id ?? '')))
  for (const id of [
    'modula.vault-notes.view.home',
    'modula.vault-notes.view.collection',
    'modula.vault-notes.view.detail',
    'modula.vault-notes.view.editor',
    'modula.vault-notes.view.search',
    'modula.vault-notes.view.settings',
  ]) {
    if (!viewIds.has(id)) errors.push(`Vault Notes descriptor missing view ${id}`)
  }

  const functionIds = new Set((moduleDescriptor.functions ?? []).map(fn => String(fn.id ?? '')))
  const actionIds = new Set((moduleDescriptor.actions ?? []).map(action => String(action.id ?? '')))
  for (const id of ['create', 'open', 'update', 'archive', 'restore', 'delete-permanently']) {
    if (!functionIds.has(`modula.vault-notes.function.note.${id}`)) errors.push(`Vault Notes descriptor missing note function ${id}`)
    if (!actionIds.has(`modula.vault-notes.action.note.${id}`)) errors.push(`Vault Notes descriptor missing note action ${id}`)
  }

  try {
    sh(['node', 'scripts/verify-release.mjs'], vaultRoot)
  } catch {
    errors.push('Vault Notes external release verifier failed')
  }

  const repoText = maybeRg(['rg', '-n', 'end-to-end encrypted|zero knowledge|cryptographically private', '.'], vaultRoot)
  if (/end-to-end encrypted|zero knowledge|cryptographically private/i.test(repoText)) {
    errors.push('Vault Notes makes unverified encryption/privacy claims')
  }
  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions.map(permission => String(permission.permission ?? '')) : []
  if (permissions.some(permission => permission.startsWith('network:') || permission.startsWith('dimon:'))) {
    errors.push('Vault Notes declares forbidden network or DIMON permissions')
  }

  const schemaTargets = ['schemas', 'module.manifest.json', 'modula.module.json'].filter(target => fs.existsSync(path.join(vaultRoot, target)))
  const schemaText = maybeRg(['rg', '-n', 'defaultVisibility|visibility|searchableFields|sourceUrl|source URI|tags', ...schemaTargets], vaultRoot)
  for (const needle of ['private', 'searchableFields', 'sourceUrl', 'tags']) {
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
