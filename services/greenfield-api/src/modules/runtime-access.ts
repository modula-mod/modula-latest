import type {GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import {NOT_INSTALLED_STATUSES} from './installation-status.js'
import {moduleIdFamily, resolveCanonicalModuleId, rewriteModuleIdentityAliases} from '@modula/greenfield-contracts'
import type {ModulaDb} from '../database/client.js'
import type {GreenfieldModuleInstallationStatus} from '@modula/greenfield-module-registry-contracts'
import {moduleError} from './module-errors.js'

export type GreenfieldModuleRuntimeContext = {
  accountId: string
  moduleId: string
  installationId: string
  installationStatus: GreenfieldModuleInstallationStatus
  releaseId: string
  version: string
  extensionVersionId: string
  releaseState: string
  manifest: GreenfieldModuleManifest
  permissionReviewRequired: boolean
  grantedPermissions: string[]
}

export class GreenfieldModuleRuntimeAccessService {
  constructor(private readonly db: ModulaDb) {}

  async resolve(accountId: string, moduleId: string, options: {requireEnabled?: boolean} = {}): Promise<GreenfieldModuleRuntimeContext> {
    const canonicalId = resolveCanonicalModuleId(moduleId)
    const row = await this.db
      .selectFrom('greenfield_extension_installations')
      .innerJoin('greenfield_module_releases', 'greenfield_module_releases.extension_version_id', 'greenfield_extension_installations.extension_version_id')
      .innerJoin('greenfield_module_versions', 'greenfield_module_versions.module_version_id', 'greenfield_module_releases.module_version_id')
      .select([
        'greenfield_extension_installations.installation_id',
        'greenfield_extension_installations.status as installation_status',
        'greenfield_module_releases.release_id',
        'greenfield_module_releases.module_id',
        'greenfield_module_releases.version',
        'greenfield_module_releases.extension_version_id',
        'greenfield_module_releases.release_state',
        'greenfield_module_versions.manifest',
      ])
      .where('greenfield_extension_installations.account_id', '=', accountId)
      .where('greenfield_module_releases.module_id', 'in', [...moduleIdFamily(canonicalId)])
      .where('greenfield_extension_installations.status', 'not in', [...NOT_INSTALLED_STATUSES])
      .executeTakeFirst()

    if (!row) throw moduleError('NOT_FOUND', 'Module installation not found')
    const status = row.installation_status as GreenfieldModuleInstallationStatus
    if (row.release_state === 'quarantined' || status === 'quarantined') throw moduleError('FORBIDDEN', 'Module release is quarantined')
    if (row.release_state !== 'published') throw moduleError('FORBIDDEN', 'Module release is not available')
    if (options.requireEnabled && status !== 'enabled') throw moduleError('FORBIDDEN', 'Module must be enabled')

    const review = await this.db
      .selectFrom('greenfield_module_permission_reviews')
      .select(['granted_permissions'])
      .where('account_id', '=', accountId)
      .where('installation_id', '=', row.installation_id)
      .where('release_id', '=', row.release_id)
      .orderBy('reviewed_at', 'desc')
      .executeTakeFirst()
    const manifest = row.manifest as GreenfieldModuleManifest
    return {
      accountId,
      moduleId: canonicalId,
      installationId: row.installation_id,
      installationStatus: status,
      releaseId: row.release_id,
      version: row.version,
      extensionVersionId: row.extension_version_id,
      releaseState: row.release_state,
      manifest,
      permissionReviewRequired: !review,
      // A manifest is a request, never an authorization decision. An absent
      // review therefore grants nothing; an explicit review may also grant an
      // intentionally empty set.
      grantedPermissions: arrayOfStrings(review?.granted_permissions).map(rewriteModuleIdentityAliases),
    }
  }

  enforceCapability(context: GreenfieldModuleRuntimeContext, capability: string): void {
    if (context.permissionReviewRequired) {
      throw moduleError('PERMISSION_REVIEW_REQUIRED', 'Module permission review is required')
    }
    if (!capability || !context.grantedPermissions.includes(capability)) {
      throw moduleError('FORBIDDEN', `Module capability denied: ${capability}`)
    }
  }
}

export function collectionPermission(moduleId: string, collection: string, operation: 'read' | 'write' | 'delete'): string {
  return `records:module.${moduleId}.${collection}:${operation}`
}

export function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}
