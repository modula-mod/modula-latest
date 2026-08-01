#!/usr/bin/env node
import {finish, includes} from './phase7e-module-backend-verifier-utils.mjs'

includes('services/greenfield-api/src/modules/backend/webhook-service.ts', [
  'ModuleBackendWebhookService',
  'verifySignature',
  'canonicalJsonStringify',
  'hasWebhookDelivery',
  'recordWebhookDelivery',
  'signatureValid',
  'INVALID_SIGNATURE',
  'eventType.startsWith(`module.${moduleId}.`)',
], 'module backend webhook receipt signs, scopes, deduplicates and rejects invalid signatures')
includes('services/greenfield-api/src/modules/backend/repository.ts', [
  'module_backend_webhook_deliveries',
  'payload_hash',
  'signature_valid',
  "status: 'duplicate'",
], 'module backend webhook deliveries record hashes, signature state and duplicates')
includes('services/greenfield-api/migrations/023_phase7e_module_backend_runtime.sql', [
  'module_backend_webhook_deliveries',
  'signature_valid',
  'UNIQUE(installation_id, webhook_id, idempotency_key)',
], 'module backend webhook integration table exists')
includes('services/greenfield-api/tests/phase7e.module-backend-runtime.test.ts', [
  'accepts signed webhooks once',
  'privatePayload',
  'not.toContain',
  'signature_valid === false',
], 'runtime tests cover webhook replay rejection and diagnostics redaction')

finish('Phase 7E module backend webhooks verifier')
