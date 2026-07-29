#!/usr/bin/env node
import {finish, includes, standardRoot} from './phase7e-module-backend-verifier-utils.mjs'

includes('packages/module-backend-protocol/src/index.ts', [
  'MODULA_MODULE_BACKEND_DISCOVERY_PATH',
  '/.well-known/modula-module',
  '/v1/health',
  '/v1/capabilities',
  '/v1/session/exchange',
  'MODULA_MODULE_BACKEND_ACTIONS_PATH',
  '/v1/events',
  '/v1/webhooks/modula',
  'validateModuleBackendDiscovery',
], 'module backend protocol package defines canonical endpoints and discovery validation', standardRoot)
includes('packages/module-backend-testing/src/index.ts', [
  'runModuleBackendConformancePlan',
  'discovery',
  'health',
  'token',
  'idempotency',
  'webhook',
  'diagnostics',
], 'module backend testing package provides conformance plan', standardRoot)
includes('packages/module-backend-fixtures/src/index.ts', [
  'referenceModuleBackendDefinition',
  'referenceModuleBackendDiscovery',
  'referenceModuleSessionClaims',
], 'module backend fixtures package exposes reusable conformance fixtures', standardRoot)
includes('examples/reference-module-backend/server.mjs', [
  '/.well-known/modula-module',
  '/v1/health',
  '/v1/capabilities',
  "request.url?.startsWith('/v1/actions/')",
  'supportedActions',
  '/v1/events',
  '/v1/webhooks/modula',
  '/v1/diagnostics',
], 'reference backend demonstrates discovery, health, actions, events, webhooks and diagnostics', standardRoot)
includes('tests/module-standard.test.mjs', [
  'runModuleBackendConformancePlan',
  'referenceModuleBackendDefinition',
  'referenceModuleBackendDiscovery',
], 'standard repo tests include backend conformance fixtures', standardRoot)

finish('Phase 7E module backend conformance verifier')
