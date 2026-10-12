import type {GreenfieldModuleFunctionContribution} from '@modula/greenfield-module-manifest'
import {moduleContributionId} from './identifiers.js'

type GreenfieldModuleFunctionInput = GreenfieldModuleFunctionContribution extends infer Contribution
  ? Contribution extends GreenfieldModuleFunctionContribution
    ? Omit<Contribution, 'id' | 'functionId'>
    : never
  : never

export function defineFunction(
  moduleId: string,
  suffix: string,
  input: GreenfieldModuleFunctionInput,
): GreenfieldModuleFunctionContribution {
  const id = moduleContributionId(moduleId, `function.${suffix}`)
  return {...input, id, functionId: id} as GreenfieldModuleFunctionContribution
}
