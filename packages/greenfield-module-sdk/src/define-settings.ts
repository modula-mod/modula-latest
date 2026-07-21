import type {GreenfieldModuleSettingsContribution} from '@modula/greenfield-module-manifest'
import {moduleContributionId} from './identifiers.js'

export function defineSettings(
  moduleId: string,
  suffix: string,
  input: Omit<GreenfieldModuleSettingsContribution, 'id'>,
): GreenfieldModuleSettingsContribution {
  return {...input, id: moduleContributionId(moduleId, `settings.${suffix}`)}
}
