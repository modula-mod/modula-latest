#!/usr/bin/env node
import {finish, includes} from './phase7e-module-backend-verifier-utils.mjs'

includes('services/greenfield-api/src/modules/backend/event-service.ts', [
  'ModuleBackendEventService',
  'verifySignature',
  'canonicalJsonStringify',
  'hasEventDelivery',
  'recordEventDelivery',
  "direction: 'backend-to-greenfield'",
  'moduleBackendEvent',
  'payloadHashOnly',
  'eventType.startsWith(`module.${moduleId}.`)',
], 'module backend event ingestion signs, scopes, deduplicates and stores metadata-only Greenfield events')
includes('services/greenfield-api/src/modules/backend/repository.ts', [
  'module_backend_event_deliveries',
  'payload_hash',
  "status: 'duplicate'",
], 'module backend event deliveries record hashes and duplicates')
includes('services/greenfield-api/migrations/023_phase7e_module_backend_runtime.sql', [
  'module_backend_event_subscriptions',
  'module_backend_event_deliveries',
  'UNIQUE(installation_id, event_id, direction)',
], 'module backend event integration tables exist')
includes('services/greenfield-api/tests/phase7e.module-backend-runtime.test.ts', [
  'accepts signed module backend events once',
  'duplicate: true',
  'metadata-only Greenfield events',
  'bad-signature',
], 'runtime tests cover signed backend events and replay rejection')

finish('Phase 7E module backend events verifier')
