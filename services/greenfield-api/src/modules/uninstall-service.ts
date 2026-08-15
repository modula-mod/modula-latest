import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {moduleError} from './module-errors.js'
import {GreenfieldModuleDependencyResolver} from './dependency-resolver.js'
import {GreenfieldModuleInstallationService} from './installation-service.js'
import {moduleIdFamily, resolveCanonicalModuleId} from '@modula/greenfield-contracts'

export type GreenfieldModuleUninstallChoice = 'keepData' | 'exportThenDelete' | 'deleteData' | 'cancel'

export class GreenfieldModuleUninstallService {
  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
  ) {}

  async preview(accountId: string, moduleId: string) {
    const canonicalId = resolveCanonicalModuleId(moduleId)
    const installed = await new GreenfieldModuleInstallationService(this.db, this.config).getInstalled(accountId, canonicalId)
    if (!installed) throw moduleError('NOT_FOUND', 'Module installation not found')
    const dependants = await new GreenfieldModuleDependencyResolver(this.db).activeDependants(accountId, canonicalId)
    const contributions = await this.db
      .selectFrom('greenfield_module_contributions')
      .innerJoin('greenfield_module_releases', 'greenfield_module_releases.release_id', 'greenfield_module_contributions.release_id')
      .select(['contribution_type', 'contribution_key'])
      .where('greenfield_module_releases.module_id', 'in', [...moduleIdFamily(canonicalId)])
      .where('greenfield_module_releases.version', '=', installed.version)
      .execute()
    const recordCounts = await this.db
      .selectFrom('greenfield_module_records')
      .select(({fn}) => fn.countAll<number>().as('count'))
      .where('account_id', '=', accountId)
      .where('module_id', 'in', [...moduleIdFamily(canonicalId)])
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return {
      moduleId: canonicalId,
      version: installed.version,
      dependantModules: dependants,
      activeJobs: [],
      registeredContributions: contributions,
      recordCounts: Number(recordCounts?.count ?? 0),
      settings: await this.db.selectFrom('greenfield_module_installation_settings').selectAll().where('installation_id', '=', installed.installationId).executeTakeFirst(),
      dataRetentionChoices: ['keepData', 'exportThenDelete', 'deleteData', 'cancel'],
      defaultChoice: 'keepData',
    }
  }

  async uninstall(accountId: string, moduleId: string, input: {choice?: GreenfieldModuleUninstallChoice; confirmDelete?: boolean; recentAuth?: boolean; idempotencyKey: string}) {
    const canonicalId = resolveCanonicalModuleId(moduleId)
    const choice = input.choice ?? 'keepData'
    if (choice === 'cancel') return {cancelled: true}
    const preview = await this.preview(accountId, canonicalId)
    if (preview.dependantModules.length > 0) throw moduleError('CONFLICT', 'Active dependant modules must be resolved before uninstall')
    if (choice === 'deleteData' && (!input.confirmDelete || !input.recentAuth)) {
      throw moduleError('VALIDATION_FAILED', 'Deleting module records requires recent authentication and explicit confirmation')
    }
    return new GreenfieldModuleInstallationService(this.db, this.config).enqueueTransition(
      accountId,
      canonicalId,
      'uninstalling',
      'module.uninstall.requested',
      'module.uninstall',
      input.idempotencyKey,
      {dataRetentionChoice: choice, exportOffered: choice !== 'keepData'},
    )
  }
}
