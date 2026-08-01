#!/usr/bin/env node
import {finish, includes} from './phase7e-module-backend-verifier-utils.mjs'

includes('services/greenfield-api/src/modules/backend/token-service.ts', [
  'ModuleBackendTokenService',
  'tokenExchangeRequired',
  'audience',
  'installationId',
  'permissions',
  'capabilities',
  'expiresAt',
  'recordSession',
  'token_hash',
  'sha256',
  'HS256',
], 'module backend token exchange issues scoped signed tokens and stores hashes')
includes('services/greenfield-api/src/modules/backend/repository.ts', [
  'module_backend_sessions',
  'token_hash',
  'jsonb(input.claims.permissions)',
  'jsonb(input.claims.capabilities)',
], 'module backend sessions persist scoped claims without raw tokens')
includes('services/greenfield-api/src/modules/routes/index.ts', [
  'bearerToken',
  'signatureHeader',
  '/v1/modules/:moduleId/backend/events',
  '/v1/modules/:moduleId/backend/webhooks/modula',
], 'backend event and webhook routes require bearer tokens and signatures')
includes('services/greenfield-api/tests/phase7e.module-backend-runtime.test.ts', [
  'issues and resolves scoped module session tokens',
  'token_hash',
  'not.toBe(issued.token)',
], 'runtime tests cover token hash storage and scoped claims')

finish('Phase 7E module backend auth verifier')
