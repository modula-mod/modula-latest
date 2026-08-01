#!/usr/bin/env node
import {finish, includes} from './phase7e-module-backend-verifier-utils.mjs'

includes('services/greenfield-api/src/modules/backend/health-service.ts', [
  'ModuleBackendHealthService',
  'diagnostics',
  'lastSuccessfulHealthCheck',
  'tokenExchangeStatus',
  'resolvedEndpoint',
  'mode: backend.mode',
  'fetchBackendJson',
  'recordHealth',
], 'module backend health and diagnostics expose safe operational state')
includes('services/greenfield-api/src/modules/routes/index.ts', [
  '/v1/modules/:moduleId/backend',
  '/v1/modules/:moduleId/backend/health',
  '/v1/modules/:moduleId/backend/disable',
  'backendHealth.diagnostics',
  'backendHealth.check',
  'backendLifecycle.disable',
], 'backend diagnostics, health and disable routes are wired')
includes('services/greenfield-api/migrations/023_phase7e_module_backend_runtime.sql', [
  'module_backend_health',
  'discovery',
  'identity',
  'authentication',
  'database',
  'queue',
  'webhooks',
  'storage',
  'circuit_state',
], 'backend health table tracks required components and circuit state')

finish('Phase 7E module backend health verifier')
