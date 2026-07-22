import type {GreenfieldModuleManifestV1} from '@modula/greenfield-module-manifest'
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
  manifest: GreenfieldModuleManifestV1
  grantedPermissions: string[]
}

export class GreenfieldModuleRuntimeAccessService {
  constructor(private readonly db: ModulaDb) {}

  async resolve(accountId: string, moduleId: string, options: {requireEnabled?: boolean} = {}): Promise<GreenfieldModuleRuntimeContext> {
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
      .where('greenfield_module_releases.module_id', '=', moduleId)
      .where('greenfield_extension_installations.status', '!=', 'removed')
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
    const manifest = row.manifest as GreenfieldModuleManifestV1
    const fallbackPermissions = (manifest.permissions ?? []).map(permission => permission.permission)
    return {
      accountId,
      moduleId: row.module_id,
      installationId: row.installation_id,
      installationStatus: status,
      releaseId: row.release_id,
      version: row.version,
      extensionVersionId: row.extension_version_id,
      releaseState: row.release_state,
      manifest,
      grantedPermissions: arrayOfStrings(review?.granted_permissions).length ? arrayOfStrings(review?.granted_permissions) : fallbackPermissions,
    }
  }

  enforceCapability(context: GreenfieldModuleRuntimeContext, capability: string): void {
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
