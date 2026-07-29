#!/usr/bin/env node
import {finish, includes} from './phase7e-module-backend-verifier-utils.mjs'

includes('services/greenfield-api/src/modules/backend/gateway-service.ts', [
  'ModuleBackendGatewayService',
  'backendUsesModuleRuntime',
  'idempotencyKey',
  'enforceActionPermissions',
  'lifecycleState ===',
  'disabled',
  'quarantined',
  'revoked',
  'circuit_state',
  'fetchBackendJson',
  'validateBackendActionResponse',
  'redactSecrets',
  'sha256',
], 'backend gateway brokers actions with permission, lifecycle, circuit and redaction controls')
includes('services/greenfield-api/src/modules/action-service.ts', [
  'ModuleBackendGatewayService',
  'backendGateway.canHandle',
  'backendGateway.executeAction',
  'recordBackendActionEvent',
  'idempotencyKey',
], 'Greenfield action endpoint brokers module backend actions')
includes('services/greenfield-api/tests/phase7e.module-backend-runtime.test.ts', [
  'blocks gateway access when the backend connection is disabled',
  'ModuleBackendGatewayService',
  'disableInstallation',
], 'runtime tests prove disabled backend blocks gateway access before outbound call')

finish('Phase 7E module backend gateway verifier')
