#!/usr/bin/env node
import {existsSync} from 'node:fs'
import {join} from 'node:path'
import {fail, finish, includes, pass, root, vaultNotesRoot} from './phase7e-vault-notes-verifier-utils.mjs'

for (const path of ['src/features/vault-notes', 'app/vault-notes', 'app/(tabs)/vault-notes']) {
  if (existsSync(join(root, path))) fail(`hardcoded Vault Notes app path exists: ${path}`)
  else pass(`hardcoded Vault Notes app path absent: ${path}`)
}

includes('src/document/index.ts', [
  'safeUrl',
  'https:',
  'UNSAFE_URL',
  'UNKNOWN_TYPE',
  'DOCUMENT_TOO_LARGE',
  'DOCUMENT_TOO_DEEP',
], 'Vault Notes structured document security', vaultNotesRoot)
includes('src/events/index.ts', [
  'payload: {',
  'noteId',
  'revision',
  'documentHash',
], 'Vault Notes content-redacted events', vaultNotesRoot)
includes('services/greenfield-api/src/modules/runtime-access.ts', [
  'account_id',
  'Module must be enabled',
  'Module release is quarantined',
  'Module capability denied',
], 'generic module runtime access enforcement')
includes('services/greenfield-api/src/modules/record-service.ts', [
  'account_id',
  'NOTE_REVISION_CONFLICT',
  'Permanent deletion requires confirmation',
  'redactedRecordEventPayload',
  'validateJsonField',
], 'generic module record security enforcement')
includes('services/greenfield-worker/src/search/vault-notes-projector.ts', [
  "visibility: 'account'",
  'metadata:',
  'plainTextProjection',
], 'Vault Notes search isolation and projection')
includes('services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts', [
  'otherRead.statusCode',
  'NOTE_REVISION_CONFLICT',
  'purgeDenied.statusCode',
  'not.toContain',
  'blocked.statusCode',
], 'Vault Notes security integration test')

finish('Phase 7E Vault Notes security verifier')
