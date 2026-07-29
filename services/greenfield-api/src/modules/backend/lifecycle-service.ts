import type {ModulaDb} from '../../database/client.js'
import {moduleError} from '../module-errors.js'
import type {GreenfieldModuleRuntimeContext} from '../runtime-access.js'
import {ModuleBackendRepository} from './repository.js'

export class ModuleBackendLifecycleService {
  private readonly repository: ModuleBackendRepository

  constructor(db: ModulaDb) {
    this.repository = new ModuleBackendRepository(db)
  }

  async establish(context: GreenfieldModuleRuntimeContext, origin?: string | null) {
    return this.repository.ensureInstallation(context, origin)
  }

  async disable(context: GreenfieldModuleRuntimeContext) {
    await this.repository.ensureInstallation(context, null)
    return this.repository.disableInstallation(context.installationId)
  }

  assertAccessAllowed(context: GreenfieldModuleRuntimeContext, lifecycleState: string) {
    if (context.installationStatus !== 'enabled') throw moduleError('FORBIDDEN', 'Module must be enabled')
    if (lifecycleState === 'disabled' || lifecycleState === 'quarantined' || lifecycleState === 'revoked') {
      throw moduleError('FORBIDDEN', 'Module backend is not available')
    }
  }
}
