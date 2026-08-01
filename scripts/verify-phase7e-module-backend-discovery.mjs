#!/usr/bin/env node
import {finish, includes} from './phase7e-module-backend-verifier-utils.mjs'

includes('services/greenfield-api/src/modules/backend/discovery-service.ts', [
  'ModuleBackendDiscoveryService',
  'validateModuleBackendDiscovery',
  '/.well-known/modula-module',
  'verifyDiscovery',
  'markDiscovered',
  'markUnavailable',
], 'backend discovery validates well-known document and records lifecycle')
includes('services/greenfield-api/src/modules/backend/network-policy.ts', [
  'assertSafeHttpsUrl',
  'safeFetch',
  'resolveBackendEndpoint',
  'allowedHosts',
  'allowedOrigins',
  'maxRedirects: 0',
], 'backend discovery uses SSRF-safe endpoint resolution')
includes('services/greenfield-api/src/modules/backend/trust-service.ts', [
  'MODULA_MODULE_BACKEND_PROTOCOL_VERSION',
  'moduleId',
  'moduleVersion',
  'healthUrl',
  'allowedOrigins',
  'quarantined',
], 'backend discovery verifies module identity, protocol and trust origin')
includes('services/greenfield-api/src/modules/routes/index.ts', [
  '/v1/modules/:moduleId/backend/discover',
  'backendDiscovery.discover',
], 'backend discovery route is wired')

finish('Phase 7E module backend discovery verifier')
