import type {GreenfieldEngineProvider, GreenfieldRuntimeCapability} from '@modula/greenfield-module-engine-contracts'
import type {GreenfieldRuntimeProviderAdapter} from './provider-adapter.js'

export const GREENFIELD_OPERATIONAL_BUILT_IN_PROVIDER_IDS = [
  'modula.declarative-ui',
  'modula.records',
  'modula.actions',
  'modula.functions',
] as const

export const GREENFIELD_CONTROLLED_FRAMEWORK_PROVIDER_IDS = [
  'modula.connector',
  'modula.ai',
  'modula.automation',
] as const

export type GreenfieldOperationalBuiltInProviderId = (typeof GREENFIELD_OPERATIONAL_BUILT_IN_PROVIDER_IDS)[number]
export type GreenfieldControlledFrameworkProviderId = (typeof GREENFIELD_CONTROLLED_FRAMEWORK_PROVIDER_IDS)[number]

function provider(input: Omit<GreenfieldEngineProvider, 'trust' | 'supportedPlatforms' | 'nativeBuildRequired'>): GreenfieldEngineProvider {
  return {
    trust: 'trusted-host',
    supportedPlatforms: ['web', 'ios', 'android', 'server'],
    nativeBuildRequired: false,
    ...input,
  }
}

function readyProvider(input: {
  providerId: GreenfieldOperationalBuiltInProviderId
  displayName: string
  engineKind: GreenfieldEngineProvider['engineKind']
  capabilities: GreenfieldRuntimeCapability[]
}): GreenfieldRuntimeProviderAdapter {
  return {
    provider: provider({
      providerId: input.providerId,
      displayName: input.displayName,
      engineKind: input.engineKind,
      apiVersion: '1.0.0',
      capabilities: input.capabilities,
      status: 'available',
      launchable: true,
      resourceProfile: {
        networkBudget: 'standard',
        backgroundExecution: false,
        batteryImpact: 'low',
      },
    }),
    async prepareSession() {
      return {ready: true, metadata: {trustedBuiltInProvider: true}}
    },
  }
}

function controlledFrameworkStub(input: {
  providerId: GreenfieldControlledFrameworkProviderId
  displayName: string
  engineKind: GreenfieldEngineProvider['engineKind']
  capabilities: GreenfieldRuntimeCapability[]
}): GreenfieldRuntimeProviderAdapter {
  return {
    provider: provider({
      providerId: input.providerId,
      displayName: input.displayName,
      engineKind: input.engineKind,
      apiVersion: '1.0.0',
      capabilities: input.capabilities,
      status: 'not-configured',
      launchable: false,
      reasonCodes: ['provider.not-configured'],
    }),
  }
}

export function createTrustedBuiltInRuntimeProviders(): GreenfieldRuntimeProviderAdapter[] {
  return [
    readyProvider({
      providerId: 'modula.declarative-ui',
      displayName: 'Modula Declarative UI',
      engineKind: 'declarative-ui',
      capabilities: ['declarative-ui.render', 'module.view.render', 'module.widget.render'],
    }),
    readyProvider({
      providerId: 'modula.records',
      displayName: 'Modula Records',
      engineKind: 'records',
      capabilities: ['records.read', 'records.write', 'records.delete', 'module.records.query'],
    }),
    readyProvider({
      providerId: 'modula.actions',
      displayName: 'Modula Actions',
      engineKind: 'actions',
      capabilities: ['actions.invoke', 'module.action.invoke', 'module.action.confirmed'],
    }),
    readyProvider({
      providerId: 'modula.functions',
      displayName: 'Modula Functions',
      engineKind: 'functions',
      capabilities: ['functions.invoke', 'function.reviewed.invoke', 'function.background.queue'],
    }),
    controlledFrameworkStub({
      providerId: 'modula.connector',
      displayName: 'Modula Connector Framework',
      engineKind: 'connector',
      capabilities: ['connector.oauth', 'connector.action.invoke', 'connector.sync'],
    }),
    controlledFrameworkStub({
      providerId: 'modula.ai',
      displayName: 'Modula AI Framework',
      engineKind: 'ai',
      capabilities: ['ai.chat', 'ai.generate', 'ai.tool.invoke'],
    }),
    controlledFrameworkStub({
      providerId: 'modula.automation',
      displayName: 'Modula Automation Framework',
      engineKind: 'automation',
      capabilities: ['automation.workflow', 'automation.schedule', 'automation.run'],
    }),
  ]
}
