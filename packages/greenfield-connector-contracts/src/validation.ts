import {isGreenfieldConnectorCapability} from './connector-capability.js'
import type {
  GreenfieldConnectorDefinition,
  GreenfieldConnectorReadiness,
  GreenfieldConnectorReadinessReasonCode,
} from './connector-definition.js'
import {isGreenfieldConnectorKind} from './connector-kind.js'

export type GreenfieldConnectorValidationIssue = {
  code: string
  path: string
  message: string
}

export type GreenfieldConnectorValidationResult = {
  valid: boolean
  issues: GreenfieldConnectorValidationIssue[]
}

const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9-]*)+$/

export function isGreenfieldConnectorProviderId(value: string): boolean {
  return PROVIDER_ID_PATTERN.test(value)
}

export function validateGreenfieldConnectorDefinition(
  definition: GreenfieldConnectorDefinition,
): GreenfieldConnectorValidationResult {
  const issues: GreenfieldConnectorValidationIssue[] = []
  if (!isGreenfieldConnectorProviderId(definition.providerId)) {
    issues.push(issue('PROVIDER_ID_INVALID', 'providerId', 'Provider ID must be namespace-qualified'))
  }
  if (!definition.displayName.trim()) {
    issues.push(issue('DISPLAY_NAME_REQUIRED', 'displayName', 'Display name is required'))
  }
  if (!definition.connectorKinds.length) {
    issues.push(issue('CONNECTOR_KIND_REQUIRED', 'connectorKinds', 'At least one connector kind is required'))
  }
  for (const [index, kind] of definition.connectorKinds.entries()) {
    if (!isGreenfieldConnectorKind(kind)) {
      issues.push(issue('CONNECTOR_KIND_INVALID', `connectorKinds.${index}`, `Unsupported connector kind: ${kind}`))
    }
  }
  if (!definition.capabilities.length) {
    issues.push(issue('CAPABILITY_REQUIRED', 'capabilities', 'At least one capability is required'))
  }
  const seenCapabilities = new Set<string>()
  for (const [index, capability] of definition.capabilities.entries()) {
    if (!isGreenfieldConnectorCapability(capability)) {
      issues.push(issue('CAPABILITY_INVALID', `capabilities.${index}`, `Invalid connector capability: ${capability}`))
    }
    if (seenCapabilities.has(capability)) {
      issues.push(issue('CAPABILITY_DUPLICATE', `capabilities.${index}`, `Duplicate connector capability: ${capability}`))
    }
    seenCapabilities.add(capability)
  }
  if (definition.authorisation.method === 'oauth2' && !definition.authorisation.requiresBackendFlow) {
    issues.push(issue('OAUTH_BACKEND_FLOW_REQUIRED', 'authorisation.requiresBackendFlow', 'OAuth connectors must use backend-owned flows'))
  }
  if (definition.webhook.supported && !definition.webhook.signatureRequired) {
    issues.push(issue('WEBHOOK_SIGNATURE_REQUIRED', 'webhook.signatureRequired', 'Privileged webhooks must require signatures'))
  }
  if (definition.operational && !computeConnectorReadiness(definition).operational) {
    issues.push(issue('OPERATIONAL_STATE_INVALID', 'operational', 'Connector cannot be operational until readiness checks pass'))
  }
  return {valid: issues.length === 0, issues}
}

export function computeConnectorReadiness(definition: GreenfieldConnectorDefinition): GreenfieldConnectorReadiness {
  const reasonCodes: GreenfieldConnectorReadinessReasonCode[] = []
  if (!definition.adapterTrusted) reasonCodes.push('connector.adapter-untrusted')
  if (definition.configuredStatus !== 'configured') reasonCodes.push('connector.not-configured')
  if (definition.availabilityStatus === 'unavailable') reasonCodes.push('connector.unavailable')
  if (definition.availabilityStatus === 'coming-later') reasonCodes.push('connector.coming-later')
  if (definition.health.status === 'not-checked') reasonCodes.push('connector.health-not-checked')
  if (definition.health.status === 'unhealthy' || definition.health.status === 'unavailable') {
    reasonCodes.push('connector.unhealthy')
  }
  if (definition.authorisation.method === 'oauth2' && !definition.authorisation.callbackPath) {
    reasonCodes.push('connector.callback-missing')
  }
  if (definition.capabilities.some(capability => !isGreenfieldConnectorCapability(capability))) {
    reasonCodes.push('connector.capability-invalid')
  }
  if (reasonCodes.length === 0) reasonCodes.push('connector.ready')
  return {
    operational: reasonCodes.length === 1 && reasonCodes[0] === 'connector.ready',
    reasonCodes,
  }
}

function issue(code: string, path: string, message: string): GreenfieldConnectorValidationIssue {
  return {code, path, message}
}
