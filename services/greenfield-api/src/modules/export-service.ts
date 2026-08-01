import {createHash} from 'node:crypto'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {GreenfieldEventBus} from '../events/index.js'
import {uuidv7} from '../lib/uuidv7.js'
import {moduleError} from './module-errors.js'
import {collectionPermission, GreenfieldModuleRuntimeAccessService} from './runtime-access.js'
import {GreenfieldModuleViewService} from './view-service.js'

type ExportFormat = 'json' | 'markdown' | 'plain-text' | 'zip'

export class GreenfieldModuleExportService {
  private readonly access: GreenfieldModuleRuntimeAccessService
  private readonly views: GreenfieldModuleViewService

  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
  ) {
    this.access = new GreenfieldModuleRuntimeAccessService(db)
    this.views = new GreenfieldModuleViewService(db)
  }

  async create(accountId: string, moduleId: string, input: {format?: string} = {}) {
    const format = normalizeFormat(input.format)
    const context = await this.access.resolve(accountId, moduleId, {requireEnabled: true})
    const collections = await this.views.collectionsForRelease(context)
    for (const collection of collections) this.access.enforceCapability(context, collectionPermission(moduleId, collection.collection, 'read'))

    const rows = await this.db
      .selectFrom('greenfield_module_records')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('module_id', '=', moduleId)
      .where('deleted_at', 'is', null)
      .orderBy('collection')
      .orderBy('updated_at', 'desc')
      .limit(1000)
      .execute()
    const manifest = {
      moduleId,
      moduleVersion: context.version,
      standardVersion: standardVersion(context.manifest),
      dataSchemaVersion: dataSchemaVersion(context.manifest),
      exportedAt: new Date().toISOString(),
      recordCount: rows.length,
    }
    const body = renderExport(format, manifest, rows.map(row => ({
      recordId: row.record_id,
      collection: row.collection,
      revision: row.revision,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      data: row.data,
    })))
    const outputHash = sha256(typeof body === 'string' ? body : canonicalJsonStringify(body))
    const exportId = uuidv7()
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_module_export_jobs')
        .values({
          export_id: exportId,
          account_id: accountId,
          module_id: moduleId,
          installation_id: context.installationId,
          format,
          state: 'completed',
          manifest,
          record_count: rows.length,
          output_ref: `sha256:${outputHash}`,
          failure_code: null,
          created_by: accountId,
          created_at: now,
          updated_at: now,
          completed_at: now,
        })
        .execute()
      await new GreenfieldEventBus(trx).publish({
        eventType: `${moduleId.split('.').at(-1) ?? moduleId}.note.exported`,
        aggregateType: 'noteExport',
        aggregateId: exportId,
        aggregateVersion: 1,
        accountId,
        visibility: 'account',
        classification: 'sensitive',
        idempotencyKey: `module-export:${exportId}`,
        payload: {exportId, moduleId, format, recordCount: rows.length, outputHash},
        metadata: {source: 'greenfield.module-export'},
      })
    })
    return {exportId, format, manifest, outputHash, body}
  }
}

function normalizeFormat(value: unknown): ExportFormat {
  if (value === 'json' || value === 'markdown' || value === 'plain-text' || value === 'zip') return value
  throw moduleError('VALIDATION_FAILED', 'Unsupported export format')
}

function renderExport(format: ExportFormat, manifest: Record<string, unknown>, rows: Array<Record<string, unknown>>) {
  if (format === 'json') return JSON.stringify({manifest, records: rows}, null, 2)
  if (format === 'markdown') return rows.map(row => {
    const data = record(row.data)
    return `# ${stringField(data.title) ?? row.recordId}\n\n${stringField(data.plainTextProjection) ?? ''}\n`
  }).join('\n---\n')
  if (format === 'plain-text') return rows.map(row => {
    const data = record(row.data)
    return `${stringField(data.title) ?? row.recordId}\n${stringField(data.plainTextProjection) ?? ''}`
  }).join('\n\n')
  return {
    'manifest.json': JSON.stringify(manifest, null, 2),
    'records.json': JSON.stringify(rows, null, 2),
  }
}

function standardVersion(manifest: {extensions?: Record<string, unknown>}) {
  return stringField(record(record(manifest.extensions).standard).standardVersion) ?? 'unknown'
}

function dataSchemaVersion(manifest: {extensions?: Record<string, unknown>}) {
  return stringField(record(record(manifest.extensions).standard).dataSchemaVersion) ?? 'unknown'
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}
