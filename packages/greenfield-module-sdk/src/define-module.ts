import {
  GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
  GREENFIELD_MODULE_MANIFEST_VERSION,
  validateGreenfieldModuleManifest,
  type GreenfieldModuleManifestV1,
  type GreenfieldModuleManifestV2,
} from '@modula/greenfield-module-manifest'
import {MODULA_MODULE_STANDARD_2_VERSION, createDefaultModuleSectionVersions} from '@modula/module-standard'

export function defineModule(input: Omit<GreenfieldModuleManifestV1, 'manifestVersion'>): GreenfieldModuleManifestV1 {
  const manifest = {manifestVersion: GREENFIELD_MODULE_MANIFEST_VERSION, ...input} as GreenfieldModuleManifestV1
  const result = validateGreenfieldModuleManifest(manifest)
  if (!result.valid) {
    throw new Error(`Invalid Greenfield module manifest: ${result.issues.map(issue => `${issue.path} ${issue.message}`).join('; ')}`)
  }
  return manifest
}

export type DefineModule20Input = Omit<GreenfieldModuleManifestV2, 'manifestVersion' | 'standardVersion' | 'sectionVersions'> & {
  sectionVersions?: GreenfieldModuleManifestV2['sectionVersions']
}

export function defineModule20(input: DefineModule20Input): GreenfieldModuleManifestV2 {
  const manifest = {
    ...input,
    manifestVersion: GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
    standardVersion: MODULA_MODULE_STANDARD_2_VERSION,
    sectionVersions: {...createDefaultModuleSectionVersions(), ...input.sectionVersions},
  } as GreenfieldModuleManifestV2
  const result = validateGreenfieldModuleManifest(manifest)
  if (!result.valid) {
    throw new Error(`Invalid Greenfield module manifest: ${result.issues.map(issue => `${issue.path} ${issue.message}`).join('; ')}`)
  }
  return manifest
}
