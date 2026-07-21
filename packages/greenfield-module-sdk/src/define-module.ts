import {
  GREENFIELD_MODULE_MANIFEST_VERSION,
  validateGreenfieldModuleManifest,
  type GreenfieldModuleManifestV1,
} from '@modula/greenfield-module-manifest'

export function defineModule(input: Omit<GreenfieldModuleManifestV1, 'manifestVersion'>): GreenfieldModuleManifestV1 {
  const manifest = {manifestVersion: GREENFIELD_MODULE_MANIFEST_VERSION, ...input} as GreenfieldModuleManifestV1
  const result = validateGreenfieldModuleManifest(manifest)
  if (!result.valid) {
    throw new Error(`Invalid Greenfield module manifest: ${result.issues.map(issue => `${issue.path} ${issue.message}`).join('; ')}`)
  }
  return manifest
}
