#!/usr/bin/env node
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs'
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

const connectorPackage = JSON.parse(read('packages/greenfield-connector-contracts/package.json'))
if (connectorPackage.name !== '@modula/greenfield-connector-contracts') {
  fail('connector contracts package has wrong name')
} else {
  pass('connector contracts package name')
}

requireIncludes('packages/greenfield-connector-contracts/src/connector-kind.ts', [
  "'identity'",
  "'email'",
  "'calendar'",
  "'contacts'",
  "'storage'",
  "'documents'",
  "'messaging'",
  "'project-management'",
  "'source-control'",
  "'social'",
  "'crm'",
  "'commerce'",
  "'analytics'",
  "'automation'",
  "'generic-rest'",
  "'webhook'",
], 'connector kinds')

requireIncludes('packages/greenfield-connector-contracts/src/connector-capability.ts', [
  'email.messages.read',
  'calendar.events.create',
  'storage.files.write',
  'messaging.messages.send',
  'source-control.issues.create',
  'webhook.events.receive',
  'rest.request.execute.reviewed',
  '!value.includes',
], 'connector capabilities')

requireIncludes('packages/greenfield-connector-contracts/src/connection-state.ts', [
  "'available'",
  "'authorising'",
  "'connected'",
  "'refreshing'",
  "'degraded'",
  "'expired'",
  "'revoked'",
  "'disabled'",
  "'failed'",
  "'disconnected'",
  'assertGreenfieldConnectionTransition',
], 'connection lifecycle')

requireIncludes('packages/greenfield-connector-contracts/src/connector-definition.ts', [
  'GreenfieldConnectorDefinition',
  'configuredStatus',
  'availabilityStatus',
  'privacySummary',
  'dataAccessSummary',
  'supportedActions',
  'rateLimit',
  'operational',
], 'connector definitions')

requireIncludes('packages/greenfield-connector-contracts/src/validation.ts', [
  'validateGreenfieldConnectorDefinition',
  'computeConnectorReadiness',
  'OAUTH_BACKEND_FLOW_REQUIRED',
  'WEBHOOK_SIGNATURE_REQUIRED',
  'connector.not-configured',
], 'connector validation')

const metadata = requireIncludes('services/greenfield-api/src/connectors/provider-metadata.ts', [
  'modula.google',
  'modula.microsoft',
  'modula.github',
  'modula.slack',
  'modula.notion',
  'modula.nextcloud',
  'modula.webhook',
  'modula.generic-rest',
  "configuredStatus: 'not-configured'",
  "health: {status: 'not-checked'}",
  'operational: false',
], 'initial connector metadata')

requireIncludes('services/greenfield-api/src/connectors/provider-registry.ts', [
  'GreenfieldConnectorProviderRegistry',
  'CONNECTOR_DUPLICATE',
  'validateGreenfieldConnectorDefinition',
  'resolveCompatibility',
  'findByCapability',
  'listByKind',
], 'backend connector registry')

requireIncludes('services/greenfield-api/src/connectors/connection-lifecycle.ts', [
  'transitionGreenfieldConnectionState',
  'assertGreenfieldConnectionTransition',
], 'backend connector lifecycle')

requireIncludes('services/greenfield-api/migrations/016_phase7d_connector_foundation.sql', [
  'greenfield_connector_providers',
  'greenfield_connections',
  'greenfield_connection_credentials',
  'encrypted_access_token BYTEA',
  'encrypted_refresh_token BYTEA',
  'greenfield_connection_permissions',
  'greenfield_connection_sync_state',
  "schema_version','016",
], 'connector foundation migration')

requireIncludes('packages/greenfield-connector-contracts/tests/connector-contracts.test.ts', [
  'retains the canonical Phase 7D connector kinds',
  'rejects wildcard connector capabilities',
  'enforces the connection lifecycle transition table',
  'rejects unsigned privileged webhooks',
], 'connector contract tests')

requireIncludes('services/greenfield-api/tests/phase7d.connectors.test.ts', [
  'loads the initial metadata-only provider catalogue',
  'rejects duplicate providers',
  'returns not-configured compatibility',
  'enforces the connector lifecycle state machine',
], 'backend connector tests')

if (!metadata.includes('fetch(') && !metadata.includes('http.request') && !metadata.includes('axios')) {
  pass('provider metadata makes no external network calls')
} else {
  fail('provider metadata includes external network call markers')
}

for (const path of ['packages/greenfield-connector-contracts/src', 'services/greenfield-api/src/connectors']) {
  for (const source of sourceFiles(path)) {
    const text = readFileSync(join(root, source), 'utf8')
    for (const forbidden of ['completeAuthorisation', 'refreshCredentials', 'access_token', 'refresh_token', 'oauth-client']) {
      if (text.includes(forbidden)) fail(`${source} includes deferred OAuth/credential implementation marker: ${forbidden}`)
    }
  }
}
pass('connector foundation avoids OAuth and credential implementation markers')

if (failures > 0) {
  console.error(`Phase 7D connector platform verifier failed: ${failures} issue(s)`)
  process.exit(1)
}

console.log('Phase 7D connector platform verifier passed')

function sourceFiles(path) {
  const files = []
  const stack = [path]
  while (stack.length > 0) {
    const current = stack.pop()
    const absolute = join(root, current)
    for (const entry of readdirSync(absolute)) {
      const next = `${current}/${entry}`
      const nextAbsolute = join(root, next)
      if (statSync(nextAbsolute).isDirectory()) {
        stack.push(next)
      } else if (next.endsWith('.ts')) {
        files.push(next)
      }
    }
  }
  return files
}
