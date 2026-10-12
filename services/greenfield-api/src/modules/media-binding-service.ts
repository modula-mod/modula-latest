import {resolveCanonicalModuleId} from '@modula/greenfield-contracts'
import {sql, type Transaction} from 'kysely'
import type {Database} from '../database/types.js'
import type {ModulaDb} from '../database/client.js'
import type {AppConfig} from '../config/index.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {GreenfieldEventBus} from '../events/index.js'
import {uuidv7} from '../lib/uuidv7.js'
import {moduleError} from './module-errors.js'
import {GreenfieldModuleRecordAccessService} from './record-access-service.js'
import {collectionPermission, GreenfieldModuleRuntimeAccessService, mediaPermission, type GreenfieldModuleRuntimeContext} from './runtime-access.js'

type RecordTarget = {
  ownerAccountId: string
  installationId: string | null
  revision: number
}

export class GreenfieldModuleMediaBindingService {
  private readonly access: GreenfieldModuleRuntimeAccessService
  private readonly recordAccess: GreenfieldModuleRecordAccessService

  constructor(private readonly db: ModulaDb, config?: Pick<AppConfig, 'environment' | 'moduleAllowUntrustedDevelopmentReleases'>) {
    this.access = new GreenfieldModuleRuntimeAccessService(db, config)
    this.recordAccess = new GreenfieldModuleRecordAccessService(db, config)
  }

  async list(accountId: string, moduleId: string, recordType: string, recordId: string) {
    const runtime = await this.requireRuntime(accountId, moduleId, recordType, 'read')
    const target = await this.requireRecordAccess(accountId, runtime.moduleId, recordType, recordId, false)
    const rows = await this.db.selectFrom('greenfield_module_record_media_bindings').selectAll()
      .where('record_owner_account_id', '=', target.ownerAccountId)
      .where('module_id', '=', runtime.moduleId)
      .where('record_type', '=', recordType)
      .where('record_id', '=', recordId)
      .orderBy('order_index').execute()
    return {record: {moduleId: runtime.moduleId, recordType, recordId}, bindings: rows.map(toBinding)}
  }

  async bind(accountId: string, moduleId: string, recordType: string, recordId: string, input: {
    bindingId?: unknown; assetId?: unknown; fieldPath?: unknown; role?: unknown; order?: unknown; caption?: unknown; mediaType?: unknown
  }, actor: {actorId?: string; requestId?: string} = {}) {
    const runtime = await this.requireRuntime(accountId, moduleId, recordType, 'write')
    const target = await this.requireRecordAccess(accountId, runtime.moduleId, recordType, recordId, true)
    const assetId = requiredText(input.assetId, 'assetId', 200)
    const bindingId = optionalText(input.bindingId, 'bindingId', 200) ?? uuidv7()
    const fieldPath = optionalText(input.fieldPath, 'fieldPath', 300)
    const role = optionalText(input.role, 'role', 100)
    const caption = optionalText(input.caption, 'caption', 2_000)
    const mediaType = optionalText(input.mediaType, 'mediaType', 100)
    const requestedOrder = input.order === undefined ? null : nonNegativeInteger(input.order, 'order')

    return this.db.transaction().execute(async trx => {
      const record = await trx.selectFrom('greenfield_module_records').select(['revision', 'installation_id'])
        .where('account_id', '=', target.ownerAccountId).where('module_id', '=', runtime.moduleId)
        .where('collection', '=', recordType).where('record_id', '=', recordId).where('deleted_at', 'is', null)
        .forUpdate().executeTakeFirst()
      if (!record) throw moduleError('NOT_FOUND', 'Module record not found')
      const asset = await trx.selectFrom('attachments').selectAll().where('attachment_id', '=', assetId).forUpdate().executeTakeFirst()
      if (!asset || asset.owner_account_id !== accountId) throw moduleError('NOT_FOUND', 'Media asset not found')
      if (asset.status !== 'ready') throw moduleError('CONFLICT', 'Media asset is not ready')
      const existing = await trx.selectFrom('greenfield_module_record_media_bindings').selectAll()
        .where('record_owner_account_id', '=', target.ownerAccountId).where('module_id', '=', runtime.moduleId)
        .where('record_type', '=', recordType).where('record_id', '=', recordId).where('asset_id', '=', assetId).executeTakeFirst()
      if (existing) return toBinding(existing)
      const maximum = await trx.selectFrom('greenfield_module_record_media_bindings')
        .select(({fn}) => fn.max<number>('order_index').as('maximum'))
        .where('record_owner_account_id', '=', target.ownerAccountId).where('module_id', '=', runtime.moduleId)
        .where('record_type', '=', recordType).where('record_id', '=', recordId).executeTakeFirst()
      const order = requestedOrder ?? Number(maximum?.maximum ?? -1) + 1
      const occupied = await trx.selectFrom('greenfield_module_record_media_bindings').select('binding_id')
        .where('record_owner_account_id', '=', target.ownerAccountId).where('module_id', '=', runtime.moduleId)
        .where('record_type', '=', recordType).where('record_id', '=', recordId).where('order_index', '=', order).executeTakeFirst()
      if (occupied) throw moduleError('CONFLICT', 'Media binding order is already occupied')
      const now = new Date()
      await trx.insertInto('greenfield_module_record_media_bindings').values({
        binding_id: bindingId, record_owner_account_id: target.ownerAccountId, module_id: runtime.moduleId,
        record_type: recordType, record_id: recordId, asset_id: assetId, asset_owner_account_id: accountId,
        source_installation_id: runtime.installationId, field_path: fieldPath, role, order_index: order, caption,
        media_type: mediaType ?? asset.kind, filename: asset.original_filename, size: asset.byte_size,
        content_type: asset.mime_type, created_at: now, updated_at: now,
      }).execute()
      await trx.updateTable('attachments').set({attached_at: asset.attached_at ?? now, updated_at: now}).where('attachment_id', '=', assetId).execute()
      await this.emitChange(trx, runtime, target, recordType, recordId, record.revision, 'bind', {bindingId})
      await new AuditRepository(trx).append('module.record.media.bound', {moduleId: runtime.moduleId, recordType, bindingId}, {type: 'moduleRecord', id: recordId, actorId: actor.actorId ?? null}, {accountId: target.ownerAccountId, requestId: actor.requestId})
      await this.publishChange(trx, runtime, target, recordType, recordId, record.revision, 'bind', {bindingId})
      const created = await trx.selectFrom('greenfield_module_record_media_bindings').selectAll().where('binding_id', '=', bindingId).executeTakeFirstOrThrow()
      return toBinding(created)
    })
  }

  async unbind(accountId: string, moduleId: string, recordType: string, recordId: string, bindingId: string, actor: {actorId?: string; requestId?: string} = {}) {
    const runtime = await this.requireRuntime(accountId, moduleId, recordType, 'write')
    const target = await this.requireRecordAccess(accountId, runtime.moduleId, recordType, recordId, true)
    return this.db.transaction().execute(async trx => {
      const binding = await trx.selectFrom('greenfield_module_record_media_bindings').selectAll()
        .where('binding_id', '=', bindingId).where('record_owner_account_id', '=', target.ownerAccountId)
        .where('module_id', '=', runtime.moduleId).where('record_type', '=', recordType).where('record_id', '=', recordId)
        .forUpdate().executeTakeFirst()
      if (!binding) throw moduleError('NOT_FOUND', 'Media binding not found')
      await trx.deleteFrom('greenfield_module_record_media_bindings').where('binding_id', '=', bindingId).execute()
      await this.emitChange(trx, runtime, target, recordType, recordId, target.revision, 'unbind', {bindingId})
      await new AuditRepository(trx).append('module.record.media.unbound', {moduleId: runtime.moduleId, recordType, bindingId}, {type: 'moduleRecord', id: recordId, actorId: actor.actorId ?? null}, {accountId: target.ownerAccountId, requestId: actor.requestId})
      await this.publishChange(trx, runtime, target, recordType, recordId, target.revision, 'unbind', {bindingId})
      return {unbound: true, bindingId}
    })
  }

  async reorder(accountId: string, moduleId: string, recordType: string, recordId: string, input: {bindings?: unknown}, actor: {actorId?: string; requestId?: string} = {}) {
    const runtime = await this.requireRuntime(accountId, moduleId, recordType, 'write')
    const target = await this.requireRecordAccess(accountId, runtime.moduleId, recordType, recordId, true)
    if (!Array.isArray(input.bindings) || input.bindings.length === 0) throw moduleError('VALIDATION_FAILED', 'bindings is required')
    const requested = input.bindings.map((value, index) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw moduleError('VALIDATION_FAILED', `Invalid binding at ${index}`)
      return {bindingId: requiredText((value as any).bindingId, 'bindingId', 200), order: nonNegativeInteger((value as any).order, 'order')}
    })
    if (new Set(requested.map(item => item.bindingId)).size !== requested.length || new Set(requested.map(item => item.order)).size !== requested.length) {
      throw moduleError('VALIDATION_FAILED', 'Binding IDs and order values must be unique')
    }
    return this.db.transaction().execute(async trx => {
      const existing = await trx.selectFrom('greenfield_module_record_media_bindings').selectAll()
        .where('record_owner_account_id', '=', target.ownerAccountId).where('module_id', '=', runtime.moduleId)
        .where('record_type', '=', recordType).where('record_id', '=', recordId).forUpdate().execute()
      if (existing.length !== requested.length || requested.some(item => !existing.some(row => row.binding_id === item.bindingId))) {
        throw moduleError('VALIDATION_FAILED', 'Reorder must include every record binding exactly once')
      }
      await sql`SET CONSTRAINTS greenfield_module_record_media_order_unique DEFERRED`.execute(trx)
      const now = new Date()
      for (const item of requested) {
        await trx.updateTable('greenfield_module_record_media_bindings').set({order_index: item.order, updated_at: now})
          .where('binding_id', '=', item.bindingId).execute()
      }
      await this.emitChange(trx, runtime, target, recordType, recordId, target.revision, 'reorder', {bindings: requested})
      await new AuditRepository(trx).append('module.record.media.reordered', {moduleId: runtime.moduleId, recordType, count: requested.length}, {type: 'moduleRecord', id: recordId, actorId: actor.actorId ?? null}, {accountId: target.ownerAccountId, requestId: actor.requestId})
      await this.publishChange(trx, runtime, target, recordType, recordId, target.revision, 'reorder', {bindings: requested})
      return {record: {moduleId: runtime.moduleId, recordType, recordId}, bindings: requested}
    })
  }

  async updateMetadata(accountId: string, moduleId: string, recordType: string, recordId: string, bindingId: string, input: {fieldPath?: unknown; role?: unknown; caption?: unknown; mediaType?: unknown}, actor: {actorId?: string; requestId?: string} = {}) {
    const runtime = await this.requireRuntime(accountId, moduleId, recordType, 'write')
    const target = await this.requireRecordAccess(accountId, runtime.moduleId, recordType, recordId, true)
    const changes = {
      field_path: nullableText(input.fieldPath, 'fieldPath', 300), role: nullableText(input.role, 'role', 100),
      caption: nullableText(input.caption, 'caption', 2_000), media_type: nullableText(input.mediaType, 'mediaType', 100), updated_at: new Date(),
    }
    return this.db.transaction().execute(async trx => {
      const row = await trx.updateTable('greenfield_module_record_media_bindings').set(changes)
        .where('binding_id', '=', bindingId).where('record_owner_account_id', '=', target.ownerAccountId)
        .where('module_id', '=', runtime.moduleId).where('record_type', '=', recordType).where('record_id', '=', recordId)
        .returningAll().executeTakeFirst()
      if (!row) throw moduleError('NOT_FOUND', 'Media binding not found')
      await this.emitChange(trx, runtime, target, recordType, recordId, target.revision, 'metadata', {bindingId})
      await new AuditRepository(trx).append('module.record.media.updated', {moduleId: runtime.moduleId, recordType, bindingId}, {type: 'moduleRecord', id: recordId, actorId: actor.actorId ?? null}, {accountId: target.ownerAccountId, requestId: actor.requestId})
      await this.publishChange(trx, runtime, target, recordType, recordId, target.revision, 'metadata', {bindingId})
      return toBinding(row)
    })
  }

  private async requireRuntime(accountId: string, moduleId: string, recordType: string, operation: 'read' | 'write') {
    const canonicalId = resolveCanonicalModuleId(moduleId)
    const runtime = await this.access.resolve(accountId, canonicalId, {requireEnabled: true})
    this.access.enforceCapability(runtime, collectionPermission(canonicalId, recordType, operation))
    this.access.enforceCapability(runtime, mediaPermission(canonicalId, recordType, operation))
    const declared = await this.db.selectFrom('greenfield_module_record_collections').select('collection_id')
      .where('release_id', '=', runtime.releaseId).where('module_id', '=', canonicalId).where('collection', '=', recordType)
      .where('registration_status', '=', 'registered').executeTakeFirst()
    if (!declared) throw moduleError('FORBIDDEN', 'Module collection is not declared')
    return runtime
  }

  private async requireRecordAccess(accountId: string, moduleId: string, recordType: string, recordId: string, edit: boolean): Promise<RecordTarget> {
    const resolved = await this.recordAccess.resolve(accountId, moduleId, recordType, recordId, {operation: edit ? 'write' : 'read'})
    return {ownerAccountId: resolved.ownerAccountId, installationId: resolved.record.installation_id, revision: resolved.record.revision}
  }

  private async emitChange(trx: Transaction<Database>, runtime: GreenfieldModuleRuntimeContext, target: RecordTarget, recordType: string, recordId: string, revision: number, operation: 'bind' | 'unbind' | 'reorder' | 'metadata', details: Record<string, unknown>) {
    const audiences = new Map<string, string | null>()
    audiences.set(target.ownerAccountId, target.installationId)
    audiences.set(runtime.accountId, runtime.installationId)
    const shares = await trx.selectFrom('greenfield_module_record_shares').select('recipient_account_id')
      .where('owner_account_id', '=', target.ownerAccountId).where('module_id', '=', runtime.moduleId)
      .where('record_type', '=', recordType).where('record_id', '=', recordId).where('revoked_at', 'is', null)
      .where(eb => eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', new Date())])).execute()
    for (const share of shares) {
      if (audiences.has(share.recipient_account_id)) continue
      const installation = await trx.selectFrom('greenfield_extension_installations as installation')
        .innerJoin('greenfield_module_releases as release', 'release.extension_version_id', 'installation.extension_version_id')
        .select('installation.installation_id').where('installation.account_id', '=', share.recipient_account_id)
        .where('installation.status', '=', 'enabled').where('release.module_id', '=', runtime.moduleId).executeTakeFirst()
      if (installation) audiences.set(share.recipient_account_id, installation.installation_id)
    }
    const now = new Date()
    await trx.insertInto('greenfield_module_record_changes').values([...audiences].map(([accountId, installationId]) => ({
      account_id: accountId, installation_id: installationId, owner_account_id: target.ownerAccountId,
      module_id: runtime.moduleId, record_type: recordType, record_id: recordId, revision,
      operation, change_kind: 'media' as const, details, deleted: false, created_at: now,
    }))).execute()
  }

  private async publishChange(trx: Transaction<Database>, runtime: GreenfieldModuleRuntimeContext, target: RecordTarget, recordType: string, recordId: string, revision: number, operation: 'bind' | 'unbind' | 'reorder' | 'metadata', details: Record<string, unknown>) {
    await new GreenfieldEventBus(trx).publish({
      eventType: 'module.record.media.changed.v1',
      aggregateType: 'module-record',
      aggregateId: recordId,
      aggregateVersion: revision,
      accountId: target.ownerAccountId,
      producerKind: 'product',
      producerId: runtime.moduleId,
      productId: runtime.moduleId,
      installationId: runtime.installationId,
      releaseId: runtime.releaseId,
      visibility: 'account',
      classification: 'private',
      payload: {record: {moduleId: runtime.moduleId, recordType, recordId}, operation, ...details},
      metadata: {source: 'greenfield.module-record-media'},
    })
  }
}

function toBinding(row: Database['greenfield_module_record_media_bindings']) {
  return {
    bindingId: row.binding_id,
    record: {moduleId: row.module_id, recordType: row.record_type, recordId: row.record_id},
    assetId: row.asset_id, fieldPath: row.field_path ?? undefined, role: row.role ?? undefined,
    order: row.order_index, caption: row.caption ?? undefined, mediaType: row.media_type ?? undefined,
    filename: row.filename, size: Number(row.size), contentType: row.content_type, createdAt: row.created_at.toISOString(),
  }
}

function requiredText(value: unknown, field: string, maximum: number): string {
  const result = optionalText(value, field, maximum)
  if (!result) throw moduleError('VALIDATION_FAILED', `${field} is required`)
  return result
}

function optionalText(value: unknown, field: string, maximum: number): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.length > maximum) throw moduleError('VALIDATION_FAILED', `Invalid ${field}`)
  return value
}

function nullableText(value: unknown, field: string, maximum: number): string | null | undefined {
  return value === undefined ? undefined : optionalText(value, field, maximum)
}

function nonNegativeInteger(value: unknown, field: string): number {
  const result = Number(value)
  if (!Number.isInteger(result) || result < 0) throw moduleError('VALIDATION_FAILED', `Invalid ${field}`)
  return result
}
