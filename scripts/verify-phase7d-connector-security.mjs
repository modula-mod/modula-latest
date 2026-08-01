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

requireIncludes('services/greenfield-api/src/security/encryption/connector-credentials.ts', [
  'AES-256-GCM',
  'ConnectorCredentialEncryptionService',
  'keyVersion',
  'nonce',
  'authTag',
  'setAAD',
  'decryptCredentials',
], 'connector credential encryption service')

requireIncludes('services/greenfield-api/src/config/env.ts', [
  'MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY',
  'MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY_PREVIOUS',
  'connectorCredentialEncryptionKeysByVersion',
  "NODE_ENV === 'test'",
], 'connector credential key configuration')

requireIncludes('services/greenfield-api/src/domains/connectors/credentials/repository.ts', [
  'persistEncrypted',
  'encrypted_payload',
  'encrypted_auxiliary_data',
  'nonce',
  'auth_tag',
  'loadEnvelopeForTrustedBackend',
  "where('account_id', '=', accountId)",
  "where('provider_id', '=', providerId)",
], 'credential persistence boundary')

requireIncludes('services/greenfield-api/src/domains/connectors/oauth-state/service.ts', [
  'randomBytes(32)',
  'hashState',
  'accountId',
  'providerId',
  'redirectUri',
  'pkceChallenge',
  'oauth-pkce-verifier',
  'markReplay',
  'OAuth callback rejected',
  'sanitizeConnectorOAuthCallbackFailure',
], 'OAuth state lifecycle')

requireIncludes('services/greenfield-api/migrations/017_phase7d_connector_security_lifecycle.sql', [
  'greenfield_connector_oauth_states',
  'state_hash TEXT NOT NULL UNIQUE',
  'account_id TEXT NOT NULL',
  'provider_id TEXT NOT NULL',
  'redirect_uri TEXT NOT NULL',
  'pkce_verifier_ciphertext BYTEA',
  'replay_detected_at TIMESTAMPTZ',
  'encrypted_payload BYTEA',
  'health_checked_at TIMESTAMPTZ',
  'revocation_metadata JSONB',
  "schema_version','017",
], 'connector security migration')

const routes = requireIncludes('services/greenfield-api/src/app/register-routes.ts', [
  "app.get('/v1/connectors'",
  "app.get('/v1/connectors/:providerId'",
  "app.post('/v1/connectors/:providerId/authorise'",
  "app.get('/v1/connections'",
  "app.post('/v1/connections/:connectionId/refresh'",
  'ConnectorCredentialService',
  'TrustedConnectorAdapterRegistry',
], 'connector API routes')

for (const forbiddenResponse of ['accessToken:', 'refreshToken:', 'pkceVerifier:', 'encrypted_payload:', 'auth_tag:']) {
  if (routes.includes(`successEnvelope(${forbiddenResponse}`)) {
    fail(`connector routes expose secret field ${forbiddenResponse}`)
  }
}
pass('connector API responses avoid direct secret envelopes')

requireIncludes('services/greenfield-api/src/connectors/adapter-registry.ts', [
  'TrustedConnectorProviderAdapter',
  'getAuthorisationUrl',
  'completeAuthorisation',
  'refreshCredentials',
  'revokeConnection',
  'getHealth',
  'TrustedConnectorAdapterRegistry',
], 'trusted server-side adapter registry')

requireIncludes('services/greenfield-api/tests/phase7d.connector-security.test.ts', [
  'round-trips credential envelopes',
  'rejects corrupted ciphertext',
  'wrong-key decrypts',
  'binds decrypts to account/provider/connection',
  'already been consumed',
  'account/provider-bound OAuth state',
  'invalid-redirect states',
], 'connector security tests')

requireIncludes('docs/security/phase7d-connector-credential-key-rotation.md', [
  'MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY',
  'MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY_PREVIOUS',
  're-encryption job',
  'must not place plaintext credentials in queue payloads',
], 'connector key rotation procedure')

requireIncludes('services/greenfield-api/src/app/create-server.ts', [
  'accessToken',
  'refreshToken',
  'credentials',
  'pkceVerifier',
  'clientSecret',
], 'server logger redaction')

if (failures > 0) {
  console.error(`Phase 7D connector security verifier failed: ${failures} issue(s)`)
  process.exit(1)
}

console.log('Phase 7D connector security verifier passed')
