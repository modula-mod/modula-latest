#!/usr/bin/env node
import {finish, includes, json, pass, vaultNotesRoot} from './phase7e-vault-notes-verifier-utils.mjs'

for (const schema of ['note', 'folder', 'tag', 'note-link', 'note-version', 'saved-source']) {
  const parsed = json(`schemas/${schema}.schema.json`)
  if (parsed.$schema && parsed.type === 'object') pass(`${schema} schema is a JSON object schema`)
}

includes('src/document/index.ts', [
  'VaultStructuredDocument',
  'unsupported',
  'Unsupported content',
  'MAX_DOCUMENT_BYTES',
  'safeUrl',
], 'Vault structured document validator', vaultNotesRoot)
includes('src/records/store.ts', [
  'NOTE_REVISION_CONFLICT',
  'idempotencyKey',
  'versions',
  'permanentlyDeleteNote',
  'confirm',
], 'external Vault Notes record store', vaultNotesRoot)
includes('services/greenfield-api/src/modules/record-service.ts', [
  'NOTE_REVISION_CONFLICT',
  'greenfield_module_record_versions',
  'validateJsonField',
  'payloadHash',
  'redactedRecordEventPayload',
], 'generic module record integrity service')
includes('services/greenfield-api/migrations/022_phase7e_module_records_and_vault_notes.sql', [
  'greenfield_module_record_versions',
  'greenfield_module_export_jobs',
  'CHECK (operation IN',
  "'purge'",
], 'module record version/export migration')

finish('Phase 7E Vault Notes data-integrity verifier')
