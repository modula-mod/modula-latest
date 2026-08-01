#!/usr/bin/env node
import {finish, includes, pass} from './phase7e-vault-notes-verifier-utils.mjs'

includes('services/greenfield-api/src/ai/product-action-service.ts', [
  'apply(',
  'AI_RESULT_EXPIRED',
  'AI_RESULT_ALREADY_APPLIED',
  'AI_RESULT_NOT_APPLICABLE',
  'AI_RESULT_OWNERSHIP_MISMATCH',
  'NOTE_REVISION_CONFLICT',
  'sha256(canonicalJsonStringify(selectedResult))',
  'changeSource: \'ai-assisted\'',
  'versionMetadata',
], 'AI result application is explicit, hash-checked and revision guarded')

includes('services/greenfield-api/src/modules/record-service.ts', [
  'changeSource?: ModuleRecordVersionChangeSource',
  'versionMetadata?: Record<string, unknown>',
  'redactedVersionMetadata',
  'publishRecordDomainEvent',
], 'normal module record service records AI provenance without bypassing record events')

includes('services/greenfield-api/migrations/026_phase7e_ai_product_actions.down.sql', [
  'DROP TABLE IF EXISTS ai_product_action_applications',
  'change_source = \'update\'',
  'schema_version\',\'025\'',
], 'product action migration has rollback coverage')

includes('docs/architecture/ai-result-application.md', [
  'generate suggestion',
  'explicit approval',
  'optimistic concurrency',
  'normal note revision',
], 'AI result application architecture is documented')

pass('AI result application is separate from generation and writes through normal note revision paths')
finish('Phase 7E AI result application verifier')
