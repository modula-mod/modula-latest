import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {moduleError} from './module-errors.js'
import {GreenfieldModuleInstallationService} from './installation-service.js'
import {GreenfieldModuleRegistryService} from './registry-service.js'
import {GreenfieldModulePermissionService} from './permission-service.js'
import {satisfiesSemverRange} from '@modula/greenfield-module-manifest'
import {GreenfieldExtensionFabricService} from './extension-fabric-service.js'

export class GreenfieldModuleUpdateService {
  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
  ) {}

  async update(accountId: string, moduleId: string, input: {version?: string; idempotencyKey: string; approvedPermissionIncrease?: boolean}) {
    const installations = new GreenfieldModuleInstallationService(this.db, this.config)
    const installed = await installations.getInstalled(accountId, moduleId)
    if (!installed) throw moduleError('NOT_FOUND', 'Module installation not found')
    const registry = new GreenfieldModuleRegistryService(this.db)
    const current = await registry.getVersion(moduleId, installed.version)
    const next = input.version ? await registry.getVersion(moduleId, input.version) : await registry.latestPublished(moduleId)
    const diff = new GreenfieldModulePermissionService(this.db).comparePermissions(current.manifest.permissions, next.manifest.permissions)
    if (diff.highRiskIncrease && !input.approvedPermissionIncrease) {
      throw moduleError('VALIDATION_FAILED', 'High-risk permission increase requires renewed approval')
    }
    const extensionFabric = new GreenfieldExtensionFabricService(this.db)
    const targetReview = await extensionFabric.targetReview(accountId, next)
    if (targetReview.errors.length > 0) throw moduleError('CONFLICT', `Extension update is incompatible: ${targetReview.errors.join(', ')}`)
    const dependantExtensions = await extensionFabric.activeDependants(accountId, moduleId, {recursive: false})
    const incompatibleExtensions = dependantExtensions
      .filter(dependant => !satisfiesSemverRange(next.version, dependant.versionRange))
      .map(dependant => ({productId: dependant.productId, installationId: dependant.installationId, versionRange: dependant.versionRange}))
    return installations.enqueueTransition(accountId, moduleId, 'updating', 'module.update.requested', 'module.update', input.idempotencyKey, {
      targetReleaseId: next.releaseId,
      targetVersion: next.version,
      rollbackSnapshot: {
        previousVersion: installed.version,
        previousStatus: installed.status,
        previousExtensionVersionId: installed.extensionVersionId,
      },
      permissionIncrease: diff.permissionIncrease,
      incompatibleExtensions,
    })
  }
}
