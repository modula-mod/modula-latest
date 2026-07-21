import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'

export type ContributionFilters = {
  surface?: string
  moduleId?: string
  platform?: string
  accountState?: string
  route?: string
  enabledOnly?: boolean
}

export class GreenfieldModuleContributionService {
  constructor(
    private readonly db: ModulaDb,
    private readonly _config: AppConfig,
  ) {}

  async list(accountId: string, filters: ContributionFilters = {}) {
    const rows = await this.db
      .selectFrom('greenfield_module_contributions')
      .innerJoin('greenfield_module_releases', 'greenfield_module_releases.release_id', 'greenfield_module_contributions.release_id')
      .innerJoin('greenfield_extension_installations', 'greenfield_extension_installations.extension_version_id', 'greenfield_module_releases.extension_version_id')
      .select([
        'greenfield_module_contributions.contribution_id',
        'greenfield_module_contributions.module_id',
        'greenfield_module_contributions.contribution_type',
        'greenfield_module_contributions.contribution_key',
        'greenfield_module_contributions.manifest',
        'greenfield_module_contributions.execution_required',
        'greenfield_module_contributions.registration_status',
        'greenfield_module_releases.version',
        'greenfield_extension_installations.status',
      ])
      .where('greenfield_extension_installations.account_id', '=', accountId)
      .where('greenfield_module_releases.release_state', '=', 'published')
      .where('greenfield_module_contributions.registration_status', '!=', 'quarantined')
      .$if(Boolean(filters.moduleId), qb => qb.where('greenfield_module_contributions.module_id', '=', filters.moduleId!))
      .$if(Boolean(filters.enabledOnly), qb => qb.where('greenfield_extension_installations.status', '=', 'enabled'))
      .orderBy('greenfield_module_contributions.contribution_key')
      .execute()
    return rows
      .map(row => {
        const requiresEnabled = row.execution_required
        const available = !requiresEnabled || row.status === 'enabled'
        return {
          moduleId: row.module_id,
          version: row.version,
          type: row.contribution_type,
          id: row.contribution_key,
          manifest: row.manifest,
          available,
          disabledReason: available ? null : 'MODULE_NOT_ENABLED',
          installationStatus: row.status,
        }
      })
      .filter(row => (filters.enabledOnly ? row.available : true))
      .filter(row => (filters.surface ? JSON.stringify(row.manifest).includes(filters.surface) : true))
      .filter(row => (filters.route ? JSON.stringify(row.manifest).includes(filters.route) : true))
  }
}
