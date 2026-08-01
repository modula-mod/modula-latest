#!/usr/bin/env node
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'

const root = process.cwd()
let failures = 0

function fail(message) {
  failures += 1
  console.error(`FAIL ${message}`)
}

function pass(message) {
  console.log(`PASS ${message}`)
}

function read(path) {
  const absolute = join(root, path)
  if (!existsSync(absolute)) {
    fail(`missing ${path}`)
    return ''
  }
  pass(`found ${path}`)
  return readFileSync(absolute, 'utf8')
}

function requireIncludes(path, required, label = path) {
  const text = read(path)
  for (const item of required) {
    if (!text.includes(item)) fail(`${label} missing ${item}`)
  }
  if (required.every(item => text.includes(item))) pass(`${label} includes required markers`)
  return text
}

requireIncludes('services/greenfield-api/src/domains/connectors/connections/repository.ts', [
  'ConnectorConnectionRepository',
  'greenfield_connections',
  'greenfield_connection_scopes',
  'greenfield_connection_permissions',
  'greenfield_connection_events',
  "where('account_id', '=', accountId)",
  "where('connection_id', '=', input.connectionId)",
  'assertGreenfieldConnectionTransition',
  'appendEvent',
  'AuditRepository',
], 'connection persistence and ownership repository')

requireIncludes('services/greenfield-api/src/domains/connectors/connections/service.ts', [
  'ConnectorConnectionService',
  'enable',
  'disable',
  'reconnect',
  'expire',
  'revoke',
  'disconnect',
  'beginRefresh',
  'completeRefresh',
  'fail',
], 'connection lifecycle service')

requireIncludes('services/greenfield-api/src/connectors/adapter-registry.ts', [
  'TrustedConnectorProviderAdapter',
  'TrustedConnectorAdapterRegistry',
  'getAuthorisationUrl',
  'completeAuthorisation',
  'refreshCredentials',
  'revokeConnection',
  'getHealth',
], 'trusted adapter contract')

requireIncludes('services/greenfield-api/src/app/register-routes.ts', [
  "app.get('/v1/connections'",
  "app.get('/v1/connections/:connectionId'",
  "app.post('/v1/connections/:connectionId/enable'",
  "app.post('/v1/connections/:connectionId/disable'",
  "app.post('/v1/connections/:connectionId/refresh'",
  "app.delete('/v1/connections/:connectionId'",
  'connectorConnections',
  'connectorCredentials',
], 'connection management APIs')

requireIncludes('services/greenfield-api/migrations/017_phase7d_connector_security_lifecycle.sql', [
  'health_checked_at',
  'health_reason_code',
  'revocation_reason',
  'revoked_by',
  'revocation_metadata',
  'external_identity_metadata',
  'last_transition_idempotency_key',
], 'connection lifecycle migration fields')

requireIncludes('services/greenfield-api/tests/phase7d.connection-lifecycle.test.ts', [
  'legal enable/disable transitions',
  'account isolation',
  'rejects illegal transitions without partial mutation',
  'expire, reconnect, failure, revoke and disconnect',
  'audit events',
  'Persists encrypted credentials'.toLowerCase(),
], 'connection lifecycle tests')

const routeText = read('services/greenfield-api/src/app/register-routes.ts')
for (const forbidden of ['encryptedCredential', 'encrypted_payload:', 'encrypted_access_token:', 'encrypted_refresh_token:']) {
  if (routeText.includes(forbidden)) fail(`connection API route leaks credential storage marker ${forbidden}`)
}
pass('connection APIs avoid credential storage fields')

if (failures > 0) {
  console.error(`Phase 7D connection lifecycle verifier failed: ${failures} issue(s)`)
  process.exit(1)
}

console.log('Phase 7D connection lifecycle verifier passed')
