import {describe, expect, it} from 'vitest'
import {isGreenfieldConnectorCapability} from '@modula/greenfield-connector-contracts'
import {
  GREENFIELD_INITIAL_CONNECTOR_PROVIDER_IDS,
  GreenfieldConnectorProviderRegistry,
  loadGreenfieldConnectorProviderDefinitions,
  transitionGreenfieldConnectionState,
} from '../src/connectors/index.js'

function registry(): GreenfieldConnectorProviderRegistry {
  const providerRegistry = new GreenfieldConnectorProviderRegistry()
  providerRegistry.registerMany(loadGreenfieldConnectorProviderDefinitions())
  return providerRegistry
}

describe('Phase 7D connector foundation', () => {
  it('loads the initial metadata-only provider catalogue without marking providers operational', () => {
    const providers = loadGreenfieldConnectorProviderDefinitions()
    expect(providers.map(provider => provider.providerId)).toEqual([...GREENFIELD_INITIAL_CONNECTOR_PROVIDER_IDS])
    for (const provider of providers) {
      expect(provider.availabilityStatus).toBe('available')
      expect(provider.configuredStatus).toBe('not-configured')
      expect(provider.health.status).toBe('not-checked')
      expect(provider.operational).toBe(false)
    }
  })

  it('registers trusted provider metadata and rejects duplicate providers', () => {
    const providers = loadGreenfieldConnectorProviderDefinitions()
    const providerRegistry = new GreenfieldConnectorProviderRegistry()
    providerRegistry.register(providers[0]!)
    expect(providerRegistry.get(providers[0]!.providerId)?.displayName).toBe(providers[0]!.displayName)
    expect(() => providerRegistry.register(providers[0]!)).toThrow(/already registered/)
  })

  it('validates connector capabilities and rejects wildcards', () => {
    expect(isGreenfieldConnectorCapability('email.messages.read')).toBe(true)
    expect(isGreenfieldConnectorCapability('calendar.events.create')).toBe(true)
    expect(isGreenfieldConnectorCapability('email.*')).toBe(false)
    expect(isGreenfieldConnectorCapability('storage.files.*')).toBe(false)
  })

  it('resolves provider discovery by kind and capability', () => {
    const providerRegistry = registry()
    expect(providerRegistry.listByKind('source-control').map(provider => provider.providerId)).toEqual(['modula.github'])
    expect(providerRegistry.findByCapability('messaging.messages.send').map(provider => provider.providerId)).toEqual(['modula.slack'])
    expect(providerRegistry.findByCapability('rest.request.execute.reviewed').map(provider => provider.providerId)).toEqual(['modula.generic-rest'])
  })

  it('returns not-configured compatibility until real provider configuration exists', () => {
    const result = registry().resolveCompatibility({
      providerId: 'modula.github',
      requestedCapabilities: ['source-control.issues.read'],
      grantedCapabilities: ['source-control.issues.read'],
    })
    expect(result.status).toBe('not-configured')
    expect(result.reasonCodes).toContain('connector.not-configured')
    expect(result.reasonCodes).toContain('connector.health-not-checked')
    expect(result.missingCapabilities).toEqual([])
    expect(result.deniedCapabilities).toEqual([])
  })

  it('reports missing and denied capabilities without contacting providers', () => {
    const result = registry().resolveCompatibility({
      providerId: 'modula.github',
      requestedCapabilities: ['source-control.issues.create', 'email.messages.send'],
      grantedCapabilities: ['source-control.issues.create'],
    })
    expect(result.status).toBe('incompatible')
    expect(result.grantedCapabilities).toEqual(['source-control.issues.create'])
    expect(result.deniedCapabilities).toEqual(['email.messages.send'])
    expect(result.missingCapabilities).toEqual(['email.messages.send'])
    expect(result.reasonCodes).toContain('capability.missing:email.messages.send')
    expect(result.reasonCodes).toContain('capability.denied:email.messages.send')
  })

  it('enforces the connector lifecycle state machine', () => {
    expect(transitionGreenfieldConnectionState('available', 'authorising')).toBe('authorising')
    expect(transitionGreenfieldConnectionState('authorising', 'connected')).toBe('connected')
    expect(transitionGreenfieldConnectionState('connected', 'disabled')).toBe('disabled')
    expect(() => transitionGreenfieldConnectionState('available', 'connected')).toThrow(/Invalid Greenfield connection transition/)
    expect(() => transitionGreenfieldConnectionState('disconnected', 'connected')).toThrow(/Invalid Greenfield connection transition/)
  })
})
