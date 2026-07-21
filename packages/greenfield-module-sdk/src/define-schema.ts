import type {GreenfieldModuleSchemaContribution} from '@modula/greenfield-module-manifest'
import {moduleContributionId, moduleRecordCollection} from './identifiers.js'

export function defineSchema(
  moduleId: string,
  suffix: string,
  input: Omit<GreenfieldModuleSchemaContribution, 'id' | 'collection'> & {collectionSuffix: string},
): GreenfieldModuleSchemaContribution {
  return {
    ...input,
    id: moduleContributionId(moduleId, `schema.${suffix}`),
    collection: moduleRecordCollection(moduleId, input.collectionSuffix),
  }
}
