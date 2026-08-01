import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {moduleError} from './module-errors.js'
import {GreenfieldModuleRuntimeAccessService} from './runtime-access.js'
import {GreenfieldModuleViewService} from './view-service.js'

type HealthStatus = 'healthy' | 'degraded' | 'failed' | 'disabled' | 'quarantined'

export class GreenfieldModuleHealthService {
  private readonly access: GreenfieldModuleRuntimeAccessService
  private readonly views: GreenfieldModuleViewService

  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
  ) {
    this.access = new GreenfieldModuleRuntimeAccessService(db)
    this.views = new GreenfieldModuleViewService(db)
  }

  async get(accountId: string, moduleId: string) {
    void this.config
    const context = await this.access.resolve(accountId, moduleId, {requireEnabled: false})
    const collections = await this.views.collectionsForRelease(context)
    const [records, deletedRecords, versions, failedActions, exports, failedExports, searchProjection] = await Promise.all([
      this.countRecords(accountId, moduleId, false),
      this.countRecords(accountId, moduleId, true),
      this.countVersions(accountId, moduleId),
      this.countFailedActions(accountId, moduleId),
      this.countExports(accountId, moduleId, false),
      this.countExports(accountId, moduleId, true),
      this.searchProjection(moduleId, accountId),
    ])
    const runtimeStatus = runtimeHealth(context.installationStatus, context.releaseState)
    const searchStatus = searchProjection.failedCount > 0 ? 'degraded' : 'healthy'
    const exportStatus = failedExports > 0 ? 'degraded' : 'healthy'
    const overall = [runtimeStatus, searchStatus, exportStatus].includes('failed')
      ? 'failed'
      : runtimeStatus === 'quarantined'
        ? 'quarantined'
        : runtimeStatus === 'disabled'
          ? 'disabled'
          : [runtimeStatus, searchStatus, exportStatus].includes('degraded')
            ? 'degraded'
            : 'healthy'

    return {
      moduleId,
      version: context.version,
      standardVersion: standardVersion(context.manifest),
      dataSchemaVersion: dataSchemaVersion(context.manifest),
      overall,
      manifest: {status: 'healthy' as HealthStatus},
      compatibility: {status: 'healthy' as HealthStatus},
      permissions: {status: context.grantedPermissions.length > 0 ? 'healthy' : 'degraded' as HealthStatus},
      recordSchemas: {status: collections.length > 0 ? 'healthy' : 'degraded' as HealthStatus, collectionCount: collections.length},
      dataSchema: {status: 'healthy' as HealthStatus, currentDataSchemaVersion: dataSchemaVersion(context.manifest)},
      runtime: {status: runtimeStatus, installationStatus: context.installationStatus, releaseState: context.releaseState},
      searchProjection: {status: searchStatus, details: searchProjection},
      settings: {status: 'healthy' as HealthStatus},
      exports: {status: exportStatus, exportCount: exports, failedExportCount: failedExports},
      diagnostics: {
        recordCounts: records,
        deletedRecordCounts: deletedRecords,
        versionCount: versions,
        failedActions,
        exportFailures: failedExports,
        currentDataSchemaVersion: dataSchemaVersion(context.manifest),
      },
    }
  }

  private async countRecords(accountId: string, moduleId: string, deleted: boolean) {
    const rows = await this.db
      .selectFrom('greenfield_module_records')
      .select(['collection', this.db.fn.countAll().as('count')])
      .where('account_id', '=', accountId)
      .where('module_id', '=', moduleId)
      .where('deleted_at', deleted ? 'is not' : 'is', null)
      .groupBy('collection')
      .execute()
    return Object.fromEntries(rows.map(row => [row.collection, Number(row.count)]))
  }

  private async countVersions(accountId: string, moduleId: string) {
    const row = await this.db.selectFrom('greenfield_module_record_versions').select(this.db.fn.countAll().as('count')).where('account_id', '=', accountId).where('module_id', '=', moduleId).executeTakeFirst()
    return Number(row?.count ?? 0)
  }

  private async countFailedActions(accountId: string, moduleId: string) {
    const row = await this.db.selectFrom('greenfield_module_action_events').select(this.db.fn.countAll().as('count')).where('account_id', '=', accountId).where('module_id', '=', moduleId).where('status', '=', 'failed').executeTakeFirst()
    return Number(row?.count ?? 0)
  }

  private async countExports(accountId: string, moduleId: string, failed: boolean) {
    const row = await this.db.selectFrom('greenfield_module_export_jobs').select(this.db.fn.countAll().as('count')).where('account_id', '=', accountId).where('module_id', '=', moduleId).where('state', failed ? '=' : '!=', 'failed').executeTakeFirst()
    return Number(row?.count ?? 0)
  }

  private async searchProjection(moduleId: string, accountId: string) {
    const documents = await this.db.selectFrom('search_documents').select(this.db.fn.countAll().as('count')).where('account_id', '=', accountId).where('metadata', '@>' as any, {moduleId} as any).executeTakeFirst()
    const projection = await this.db
      .selectFrom('search_projection_state')
      .select(({fn}) => [fn.max('lag_seconds').as('lag_seconds'), fn.sum('failed_count').as('failed_count')])
      .where('projector_id', '=', projectorIdFor(moduleId))
      .executeTakeFirst()
    return {
      indexedRecords: Number(documents?.count ?? 0),
      lagSeconds: Number(projection?.lag_seconds ?? 0),
      failedCount: Number(projection?.failed_count ?? 0),
    }
  }
}

function runtimeHealth(installationStatus: string, releaseState: string): HealthStatus {
  if (releaseState === 'quarantined' || installationStatus === 'quarantined') return 'quarantined'
  if (installationStatus === 'disabled' || installationStatus === 'installedDisabled') return 'disabled'
  if (installationStatus === 'failed') return 'failed'
  if (installationStatus !== 'enabled') return 'degraded'
  return 'healthy'
}

function standardVersion(manifest: {extensions?: Record<string, unknown>}) {
  return stringField(record(record(manifest.extensions).standard).standardVersion) ?? 'unknown'
}

function dataSchemaVersion(manifest: {extensions?: Record<string, unknown>}) {
  return stringField(record(record(manifest.extensions).standard).dataSchemaVersion) ?? 'unknown'
}

function projectorIdFor(moduleId: string) {
  const slug = moduleId.split('.').at(-1)
  if (!slug) throw moduleError('VALIDATION_FAILED', 'Invalid module id')
  return `search.${slug}-projector`
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
