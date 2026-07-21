import type {GreenfieldModuleFunctionContribution} from '@modula/greenfield-module-manifest'
import {moduleContributionId} from './identifiers.js'

export function defineFunction(
  moduleId: string,
  suffix: string,
  input: Omit<GreenfieldModuleFunctionContribution, 'id' | 'functionId'>,
): GreenfieldModuleFunctionContribution {
  const id = moduleContributionId(moduleId, `function.${suffix}`)
  return {...input, id, functionId: id}
}
