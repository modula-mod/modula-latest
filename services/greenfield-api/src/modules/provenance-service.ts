import {isGitHubRepository, isImmutableGitCommit, isSafeManifestPath, type GreenfieldGitHubModuleSource} from '@modula/greenfield-module-manifest'
import {moduleError} from './module-errors.js'

export class GreenfieldModuleProvenanceService {
  validateGitHubSource(source: GreenfieldGitHubModuleSource): void {
    if (!isGitHubRepository(source.repository)) throw moduleError('VALIDATION_FAILED', 'GitHub repository must be owner/repository')
    if (!isImmutableGitCommit(source.commit)) throw moduleError('VALIDATION_FAILED', 'GitHub source commit must be immutable full SHA')
    if (!isSafeManifestPath(source.manifestPath)) throw moduleError('VALIDATION_FAILED', 'Manifest path must be a safe relative JSON path')
  }

  readiness() {
    return {
      manualTrustedCheckoutImport: true,
      automaticPrivateGithubSync: false,
      githubAvailabilityRequired: false,
      permanentPersonalAccessTokenAllowed: false,
    }
  }
}
