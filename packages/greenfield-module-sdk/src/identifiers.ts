import {assertGreenfieldModuleId} from '@modula/greenfield-module-manifest'

export function moduleContributionId(moduleId: string, suffix: string): string {
  assertGreenfieldModuleId(moduleId)
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(suffix)) {
    throw new Error('Contribution suffix must be lowercase dot-separated identifier parts')
  }
  return `${moduleId}.${suffix}`
}

export function moduleRecordCollection(moduleId: string, collection: string): string {
  assertGreenfieldModuleId(moduleId)
  if (!/^[a-z0-9-]+$/.test(collection)) throw new Error('Collection suffix must be lowercase kebab identifier')
  return `module.${moduleId}.${collection}`
}
