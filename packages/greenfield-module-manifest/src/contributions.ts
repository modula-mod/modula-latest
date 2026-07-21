import type {GreenfieldModulePlatform} from './compatibility.js'

export type GreenfieldModuleContributionBase = {
  id: string
  title: string
  description?: string
  platforms?: GreenfieldModulePlatform[]
  enabledByDefault?: boolean
}

export type GreenfieldModuleRouteContribution = GreenfieldModuleContributionBase & {
  path: string
  routeKind: 'module' | 'detail' | 'settings'
}

export type GreenfieldModuleProfileTabContribution = GreenfieldModuleContributionBase & {
  ownerOnly: boolean
  disabledByDefault: boolean
}

export type GreenfieldModuleBoardContribution = GreenfieldModuleContributionBase & {
  surface: 'launcher' | 'summary' | 'panel'
}

export type GreenfieldModuleSettingsContribution = GreenfieldModuleContributionBase & {
  schemaRef: string
  scope: 'account' | 'installation' | 'team'
}

export type GreenfieldModuleSchemaContribution = GreenfieldModuleContributionBase & {
  schemaRef: string
  collection: string
  defaultVisibility: 'private' | 'teams' | 'followers' | 'public' | 'system'
}

export type GreenfieldModuleToolContribution = GreenfieldModuleContributionBase & {
  toolId: string
  functionId?: string
  surfaces: string[]
}

export type GreenfieldModuleFunctionContribution = GreenfieldModuleContributionBase & {
  functionId: string
  mode: 'declarative' | 'builtIn' | 'backgroundJob' | 'remoteHttp'
  inputSchemaRef: string
  outputSchemaRef: string
  executionRequired: boolean
}

export type GreenfieldModuleWidgetContribution = GreenfieldModuleContributionBase & {
  widgetId: string
  surface: 'profile' | 'board' | 'module'
}

export type GreenfieldModulePluginContribution = GreenfieldModuleContributionBase & {
  pluginId: string
  lifecycle: string[]
  executionRequired: boolean
}

export type GreenfieldModuleConnectorContribution = GreenfieldModuleContributionBase & {
  connectorId: string
  provider: string
  executionRequired: boolean
}

export type GreenfieldModuleJobContribution = GreenfieldModuleContributionBase & {
  jobType: string
  mode: 'builtIn' | 'backgroundJob'
}

export type GreenfieldModuleEventContribution = GreenfieldModuleContributionBase & {
  eventType: string
  direction: 'emits' | 'subscribes'
}

export type GreenfieldModuleContributions = {
  routes?: GreenfieldModuleRouteContribution[]
  profileTabs?: GreenfieldModuleProfileTabContribution[]
  boardSurfaces?: GreenfieldModuleBoardContribution[]
  settings?: GreenfieldModuleSettingsContribution[]
  schemas?: GreenfieldModuleSchemaContribution[]
  tools?: GreenfieldModuleToolContribution[]
  functions?: GreenfieldModuleFunctionContribution[]
  widgets?: GreenfieldModuleWidgetContribution[]
  plugins?: GreenfieldModulePluginContribution[]
  connectors?: GreenfieldModuleConnectorContribution[]
  jobs?: GreenfieldModuleJobContribution[]
  events?: GreenfieldModuleEventContribution[]
}

export const CONTRIBUTION_GROUPS = [
  'routes',
  'profileTabs',
  'boardSurfaces',
  'settings',
  'schemas',
  'tools',
  'functions',
  'widgets',
  'plugins',
  'connectors',
  'jobs',
  'events',
] as const

export type GreenfieldModuleContributionGroup = (typeof CONTRIBUTION_GROUPS)[number]

export function flattenContributionIds(contributions: GreenfieldModuleContributions): string[] {
  const ids: string[] = []
  for (const group of CONTRIBUTION_GROUPS) {
    for (const contribution of contributions[group] ?? []) {
      ids.push(contribution.id)
    }
  }
  return ids
}

export function contributionCounts(contributions: GreenfieldModuleContributions): Record<GreenfieldModuleContributionGroup, number> {
  return Object.fromEntries(CONTRIBUTION_GROUPS.map(group => [group, contributions[group]?.length ?? 0])) as Record<
    GreenfieldModuleContributionGroup,
    number
  >
}
