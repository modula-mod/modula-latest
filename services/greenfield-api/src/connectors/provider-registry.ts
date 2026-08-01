import type {
  GreenfieldConnectorCapability,
  GreenfieldConnectorDefinition,
  GreenfieldConnectorKind,
  GreenfieldConnectorReadiness,
} from '@modula/greenfield-connector-contracts'
import {
  GreenfieldConnectorError,
  computeConnectorReadiness,
  isGreenfieldConnectorCapability,
  validateGreenfieldConnectorDefinition,
} from '@modula/greenfield-connector-contracts'

export type GreenfieldConnectorCompatibilityStatus =
  | 'operational'
  | 'not-configured'
  | 'unavailable'
  | 'incompatible'

export type GreenfieldConnectorCompatibilityResult = {
  providerId: string
  status: GreenfieldConnectorCompatibilityStatus
  readiness: GreenfieldConnectorReadiness
  requestedCapabilities: GreenfieldConnectorCapability[]
  grantedCapabilities: GreenfieldConnectorCapability[]
  deniedCapabilities: GreenfieldConnectorCapability[]
  missingCapabilities: GreenfieldConnectorCapability[]
  reasonCodes: string[]
}

export class GreenfieldConnectorProviderRegistry {
  private readonly definitions = new Map<string, GreenfieldConnectorDefinition>()

  register(definition: GreenfieldConnectorDefinition): void {
    if (this.definitions.has(definition.providerId)) {
      throw new GreenfieldConnectorError('CONNECTOR_DUPLICATE', `Connector provider already registered: ${definition.providerId}`)
    }
    const validation = validateGreenfieldConnectorDefinition(definition)
    if (!validation.valid) {
      throw new GreenfieldConnectorError('CONNECTOR_INVALID', validation.issues.map(issue => issue.code).join(', '))
    }
    this.definitions.set(definition.providerId, definition)
  }

  registerMany(definitions: readonly GreenfieldConnectorDefinition[]): void {
    for (const definition of definitions) this.register(definition)
  }

  get(providerId: string): GreenfieldConnectorDefinition | undefined {
    return this.definitions.get(providerId)
  }

  list(): GreenfieldConnectorDefinition[] {
    return [...this.definitions.values()].sort((left, right) => left.displayName.localeCompare(right.displayName))
  }

  listByKind(kind: GreenfieldConnectorKind): GreenfieldConnectorDefinition[] {
    return this.list().filter(definition => definition.connectorKinds.includes(kind))
  }

  findByCapability(capability: GreenfieldConnectorCapability): GreenfieldConnectorDefinition[] {
    return this.list().filter(definition => definition.capabilities.includes(capability))
  }

  resolveCompatibility(input: {
    providerId: string
    requestedCapabilities: GreenfieldConnectorCapability[]
    grantedCapabilities?: GreenfieldConnectorCapability[]
  }): GreenfieldConnectorCompatibilityResult {
    const definition = this.get(input.providerId)
    if (!definition) {
      throw new GreenfieldConnectorError('CONNECTOR_NOT_FOUND', `Connector provider not found: ${input.providerId}`)
    }
    const invalidCapabilities = input.requestedCapabilities.filter(capability => !isGreenfieldConnectorCapability(capability))
    if (invalidCapabilities.length > 0) {
      throw new GreenfieldConnectorError('CAPABILITY_INVALID', `Invalid connector capability: ${invalidCapabilities.join(', ')}`)
    }

    const granted = new Set(input.grantedCapabilities ?? [])
    const missingCapabilities = input.requestedCapabilities.filter(capability => !definition.capabilities.includes(capability))
    const deniedCapabilities = input.requestedCapabilities.filter(capability => !granted.has(capability))
    const readiness = computeConnectorReadiness(definition)
    const reasonCodes = new Set<string>(readiness.reasonCodes)
    for (const capability of missingCapabilities) reasonCodes.add(`capability.missing:${capability}`)
    for (const capability of deniedCapabilities) reasonCodes.add(`capability.denied:${capability}`)

    let status: GreenfieldConnectorCompatibilityStatus = 'operational'
    if (missingCapabilities.length > 0 || deniedCapabilities.length > 0) status = 'incompatible'
    else if (definition.configuredStatus !== 'configured') status = 'not-configured'
    else if (definition.availabilityStatus !== 'available' || !readiness.operational) status = 'unavailable'

    return {
      providerId: definition.providerId,
      status,
      readiness,
      requestedCapabilities: input.requestedCapabilities,
      grantedCapabilities: input.requestedCapabilities.filter(capability => granted.has(capability)),
      deniedCapabilities,
      missingCapabilities,
      reasonCodes: [...reasonCodes],
    }
  }
}
