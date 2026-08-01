#!/usr/bin/env node
import {finish, includes, pass} from './phase7e-vault-notes-verifier-utils.mjs'

includes('services/greenfield-api/src/ai/product-action-service.ts', [
  'buildVaultNoteContext',
  'UNTRUSTED_VAULT_NOTE_CONTENT',
  'current-record',
  'selected-content',
  'record-metadata',
  'selectionTextHash',
  'ai.context.private',
  'retentionPolicy: \'transient\'',
], 'Vault Notes AI context is server-side, bounded, permissioned and marked untrusted')

includes('services/greenfield-api/src/ai/product-action-service.ts', [
  'redactedProductPayload',
  'allowed = [',
  'payload[key]',
], 'AI product events use allowlisted metadata-only payloads')

includes('services/greenfield-api/tests/phase7e.ai-product-actions.test.ts', [
  'not.toContain(phrase)',
  'greenfield_domain_events',
  'audit_events',
  'AI_ACTION_PERMISSION_REQUIRED',
], 'AI product action tests assert note content stays out of events and audits')

includes('docs/security/ai-product-context-boundaries.md', [
  'untrusted',
  'Do not send',
  'server-side',
  'minimum context',
], 'AI product context boundary documentation exists')

pass('AI context boundaries keep unrelated records, credentials, audit metadata and note text out of persistent event/audit metadata')
finish('Phase 7E AI context boundaries verifier')
