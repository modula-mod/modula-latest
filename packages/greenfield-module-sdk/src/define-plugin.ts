import type {GreenfieldModulePluginContribution} from '@modula/greenfield-module-manifest'
import {moduleContributionId} from './identifiers.js'

export function definePlugin(
  moduleId: string,
  suffix: string,
  input: Omit<GreenfieldModulePluginContribution, 'id' | 'pluginId'>,
): GreenfieldModulePluginContribution {
  const id = moduleContributionId(moduleId, `plugin.${suffix}`)
  return {...input, id, pluginId: id}
}
