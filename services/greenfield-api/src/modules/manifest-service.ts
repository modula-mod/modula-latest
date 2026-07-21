import {validateGreenfieldModuleManifest, type GreenfieldModuleManifestV1} from '@modula/greenfield-module-manifest'
import {moduleError} from './module-errors.js'

export class GreenfieldModuleManifestService {
  parse(input: unknown): GreenfieldModuleManifestV1 {
    const result = validateGreenfieldModuleManifest(input)
    if (!result.valid || !result.manifest) {
      throw moduleError(
        'VALIDATION_FAILED',
        `Invalid module manifest: ${result.issues.map(issue => `${issue.code} at ${issue.path}`).join('; ')}`,
      )
    }
    return result.manifest
  }
}
