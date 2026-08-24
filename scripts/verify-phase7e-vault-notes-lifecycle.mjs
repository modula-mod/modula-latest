#!/usr/bin/env node
import {fail, finish, includes, json, pass, vaultNotesRoot} from './phase7e-vault-notes-verifier-utils.mjs'

const manifest = json('modula.module.json')
const actionIds = new Set((Array.isArray(manifest.actions) ? manifest.actions : []).map(action => String(action.id ?? '')))
const actionNamespace = `${String(manifest.id ?? '')}.action.`
for (const action of [
  'note.create',
  'note.open',
  'note.update',
  'note.duplicate',
  'note.archive',
  'note.unarchive',
  'note.delete',
  'note.restore',
  'note.delete-permanently',
  'note.pin',
  'note.unpin',
  'note.favourite',
  'note.unfavourite',
  'note.move',
  'note.export',
  'folder.create',
  'folder.rename',
  'folder.delete',
  'tag.create',
  'tag.assign',
  'tag.remove',
]) {
  const expectedId = `${actionNamespace}${action}`
  if (actionIds.has(expectedId)) pass(`${action} declared`)
  else fail(`${action} action missing`)
}

includes('src/records/store.ts', [
  'createNote',
  'updateNote',
  'duplicateNote',
  'archiveNote',
  'restoreNote',
  'permanentlyDeleteNote',
  'createFolder',
  'renameFolder',
  'createTag',
], 'external Vault Notes lifecycle store', vaultNotesRoot)
includes('services/greenfield-api/src/modules/routes/index.ts', [
  '/v1/modules/:moduleId/install-preview',
  '/v1/modules/:moduleId/install',
  '/v1/modules/:moduleId/enable',
  '/v1/modules/:moduleId/disable',
  '/v1/modules/:moduleId/records/:collection/:recordId/restore',
  '/v1/modules/:moduleId/records/:collection/:recordId/permanent',
], 'generic module lifecycle and record routes')
includes('services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts', [
  'install-preview',
  'setWorkerStatus',
  'digital.modula.vault-notes.actions.note.duplicate',
  'digital.modula.vault-notes.actions.note.archive',
  'disable',
  'reenable',
], 'Vault Notes lifecycle integration test')

finish('Phase 7E Vault Notes lifecycle verifier')
