import type {GreenfieldModuleToolContribution} from '@modula/greenfield-module-manifest'
import {moduleContributionId} from './identifiers.js'

export function defineTool(
  moduleId: string,
  suffix: string,
  input: Omit<GreenfieldModuleToolContribution, 'id' | 'toolId'>,
): GreenfieldModuleToolContribution {
  const id = moduleContributionId(moduleId, `tool.${suffix}`)
  return {...input, id, toolId: id}
}
