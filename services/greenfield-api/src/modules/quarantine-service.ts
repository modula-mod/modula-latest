import type {ModulaDb} from '../database/client.js'
import {GreenfieldModuleReleaseService} from './release-service.js'

export class GreenfieldModuleQuarantineService {
  constructor(private readonly db: ModulaDb) {}

  quarantineRelease(releaseId: string, reason: string, policyAction: 'warn' | 'disableExecutableContributions' | 'block' = 'block') {
    return new GreenfieldModuleReleaseService(this.db).quarantineRelease(releaseId, reason, policyAction)
  }

  revokeRelease(releaseId: string, reason: string) {
    return new GreenfieldModuleReleaseService(this.db).revokeRelease(releaseId, reason)
  }
}
