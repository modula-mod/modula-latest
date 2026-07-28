import type {GreenfieldConnectorDefinition} from './connector-definition.js'

export type GreenfieldConnectorProviderMetadata = {
  readonly providerId: string
  readonly definition: GreenfieldConnectorDefinition
}

export type GreenfieldConnectorProviderRegistrySnapshot = {
  providers: GreenfieldConnectorDefinition[]
  generatedAt: string
}
