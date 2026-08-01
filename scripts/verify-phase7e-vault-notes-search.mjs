#!/usr/bin/env node
import {fail, finish, includes, json, pass} from './phase7e-vault-notes-verifier-utils.mjs'

const manifest = json('modula.module.json')
const searchEntities = JSON.stringify(manifest.search ?? {})
if (searchEntities.includes('"note"') && searchEntities.includes('"vault-folder"')) pass('Vault Notes declares note and vault-folder search entities')
else fail('Vault Notes search entities missing')

includes('packages/greenfield-contracts/src/search.ts', [
  "'note'",
  "'vault-folder'",
], 'canonical search contract')
includes('packages/api-contracts/src/search.ts', [
  "'note'",
  "'vault-folder'",
], 'public search API contract')
includes('services/greenfield-api/src/domains/search/query-parser.ts', [
  'note',
  'vault-folder',
  'notes',
], 'search parser note aliases')
includes('services/greenfield-api/src/domains/search/visibility.ts', [
  'module.record',
  'sourceTitle',
  'sourceAuthor',
], 'search result metadata allowlist')
includes('services/greenfield-worker/src/search/subscribers.ts', [
  'vault-notes.note.created',
  'vault-notes.note.updated',
  'vault-notes.note.deleted',
  'vault-notes.note.restored',
  'search.vault-notes-projector',
], 'Vault Notes search subscriptions')
includes('services/greenfield-worker/src/search/vault-notes-projector.ts', [
  "visibility: 'account'",
  'plainTextProjection',
  'sourceTitle',
  'sourceAuthor',
  'tombstone',
], 'Vault Notes search projector')
includes('services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts', [
  'expectSearch',
  'other.results',
  "entityTypes: ['note']",
], 'Vault Notes account-scoped search test')

finish('Phase 7E Vault Notes search verifier')
