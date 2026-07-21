import {
  classifyPermissionRisk,
  isDimonPermission,
  validatePermissionRequest,
  type GreenfieldModuleManifestV1,
  type GreenfieldModulePermission,
} from '@modula/greenfield-module-manifest'
import type {ModulaDb} from '../database/client.js'
import {moduleError} from './module-errors.js'

export class GreenfieldModulePermissionService {
  constructor(private readonly db: ModulaDb) {}

  review(manifest: GreenfieldModuleManifestV1) {
    const firstParty = manifest.trust.requestedLevel === 'firstParty'
    const community = !firstParty
    const errors = manifest.permissions.flatMap(permission => validatePermissionRequest(permission, {firstParty, community}))
    if (errors.length) throw moduleError('VALIDATION_FAILED', errors.join('; '))
    return manifest.permissions.map(permission => ({
      permission: permission.permission,
      reason: permission.reason,
      risk: permission.risk ?? classifyPermissionRisk(permission.permission),
    }))
  }

  comparePermissions(previous: GreenfieldModulePermission[], next: GreenfieldModulePermission[]) {
    const previousSet = new Set(previous.map(permission => permission.permission))
    const added = next.filter(permission => !previousSet.has(permission.permission))
    return {
      added,
      permissionIncrease: added.length > 0,
      highRiskIncrease: added.some(permission => ['high', 'restricted'].includes(permission.risk ?? classifyPermissionRisk(permission.permission))),
    }
  }

  async enforceModuleInstallCapability(accountId: string): Promise<void> {
    const account = await this.db.selectFrom('greenfield_accounts').select(['account_id', 'status']).where('account_id', '=', accountId).executeTakeFirst()
    if (!account || account.status !== 'active') throw moduleError('FORBIDDEN', 'module:install capability requires an active Greenfield account')
  }

  assertDimonBoundary(manifest: GreenfieldModuleManifestV1): void {
    if (!manifest.moduleId.startsWith('digital.dimon') && manifest.permissions.some(permission => isDimonPermission(permission.permission))) {
      throw moduleError('FORBIDDEN', 'DIMON permissions are reserved and inactive in Phase 7A')
    }
  }
}
