import {describe, expect, it} from 'vitest'
import {
  GREENFIELD_CONNECTOR_KINDS,
  assertGreenfieldConnectionTransition,
  canTransitionGreenfieldConnection,
  computeConnectorReadiness,
  isGreenfieldConnectorCapability,
  validateGreenfieldConnectorDefinition,
  type GreenfieldConnectorDefinition,
} from '../src/index.js'

const definition: GreenfieldConnectorDefinition = {
  providerId: 'modula.github',
  displayName: 'GitHub',
  providerType: 'trusted-provider',
  connectorKinds: ['source-control', 'project-management'],
  capabilities: ['source-control.repositories.read', 'source-control.issues.read'],
  authorisation: {
    method: 'oauth2',
    requiresBackendFlow: true,
    supportsPkce: true,
    requiredConfiguration: ['clientId', 'clientSecret'],
    callbackPath: '/v1/connectors/modula.github/callback',
  },
  requiredConfiguration: [
    {key: 'clientId', required: true, secret: false, description: 'GitHub OAuth client ID'},
    {key: 'clientSecret', required: true, secret: true, description: 'GitHub OAuth client secret'},
  ],
  configuredStatus: 'not-configured',
  availabilityStatus: 'available',
  health: {status: 'not-checked'},
  iconRef: 'github',
  privacySummary: 'GitHub data is used only after connection permission is granted.',
  dataAccessSummary: 'Repository and issue metadata may be read after authorisation.',
  supportedActions: [],
  sync: {supported: true, modes: ['manual'], resourceKinds: ['repository', 'issue']},
  webhook: {supported: true, signatureRequired: true, signatureAlgorithm: 'provider-managed', eventTypes: ['issues']},
  rateLimit: {windowSeconds: 60, maximumRequests: 60},
  adapterTrusted: true,
  operational: false,
}

describe('Greenfield connector contracts', () => {
  it('retains the canonical Phase 7D connector kinds', () => {
    expect(GREENFIELD_CONNECTOR_KINDS).toEqual([
      'identity',
      'email',
      'calendar',
      'contacts',
      'storage',
      'documents',
      'messaging',
      'project-management',
      'source-control',
      'social',
      'crm',
      'commerce',
      'analytics',
      'automation',
      'generic-rest',
      'webhook',
    ])
  })

  it('rejects wildcard connector capabilities', () => {
    expect(isGreenfieldConnectorCapability('email.messages.read')).toBe(true)
    expect(isGreenfieldConnectorCapability('source-control.issues.create')).toBe(true)
    expect(isGreenfieldConnectorCapability('email.*')).toBe(false)
    expect(isGreenfieldConnectorCapability('storage.files.*')).toBe(false)
  })

  it('validates provider metadata without marking unconfigured providers operational', () => {
    const result = validateGreenfieldConnectorDefinition(definition)
    expect(result.valid).toBe(true)
    const readiness = computeConnectorReadiness(definition)
    expect(readiness.operational).toBe(false)
    expect(readiness.reasonCodes).toContain('connector.not-configured')
    expect(readiness.reasonCodes).toContain('connector.health-not-checked')
  })

  it('enforces the connection lifecycle transition table', () => {
    expect(canTransitionGreenfieldConnection('available', 'authorising')).toBe(true)
    expect(canTransitionGreenfieldConnection('authorising', 'connected')).toBe(true)
    expect(canTransitionGreenfieldConnection('connected', 'refreshing')).toBe(true)
    expect(canTransitionGreenfieldConnection('connected', 'authorising')).toBe(false)
    expect(() => assertGreenfieldConnectionTransition('disconnected', 'connected')).toThrow(/Invalid Greenfield connection transition/)
  })

  it('rejects unsigned privileged webhooks', () => {
    const result = validateGreenfieldConnectorDefinition({
      ...definition,
      providerId: 'modula.unsafe-webhook',
      connectorKinds: ['webhook'],
      capabilities: ['webhook.events.receive'],
      webhook: {supported: true, signatureRequired: false, signatureAlgorithm: 'none', eventTypes: ['event']},
    })
    expect(result.valid).toBe(false)
    expect(result.issues.map(issue => issue.code)).toContain('WEBHOOK_SIGNATURE_REQUIRED')
  })
})
