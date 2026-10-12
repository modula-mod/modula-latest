import {createHash} from 'node:crypto'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import {resolveCanonicalModuleId} from '@modula/greenfield-contracts'
import type {Transaction} from 'kysely'
import type {Database} from '../database/types.js'
import type {ModulaDb} from '../database/client.js'
import type {AppConfig} from '../config/index.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {GreenfieldEventBus} from '../events/index.js'
import {uuidv7} from '../lib/uuidv7.js'
import {moduleError} from './module-errors.js'
import {GreenfieldModuleRecordService} from './record-service.js'
import {collectionPermission, GreenfieldModuleRuntimeAccessService, sharingPermission, type GreenfieldModuleRuntimeContext} from './runtime-access.js'

export class GreenfieldModuleRecordSharingService {
  private readonly access: GreenfieldModuleRuntimeAccessService
  private readonly records: GreenfieldModuleRecordService

  constructor(private readonly db: ModulaDb, private readonly config?: Pick<AppConfig, 'environment' | 'moduleAllowUntrustedDevelopmentReleases'> & Partial<Pick<AppConfig, 'checkpointSigningKey' | 'sessionPepper'>>) {
    this.access = new GreenfieldModuleRuntimeAccessService(db, config)
    this.records = new GreenfieldModuleRecordService(db, config)
  }

  async create(accountId: string, moduleId: string, recordType: string, recordId: string, input: {
    shareId?: unknown; mutationId?: unknown; recipientAccountId?: unknown; permission?: unknown; expiresAt?: unknown
  }, actor: {actorId?: string; requestId?: string} = {}) {
    const runtime = await this.requireRuntime(accountId, moduleId, recordType, 'write')
    const mutationId = requiredText(input.mutationId, 'mutationId', 200)
    const shareId = optionalText(input.shareId, 'shareId', 200) ?? uuidv7()
    const recipientAccountId = requiredText(input.recipientAccountId, 'recipientAccountId', 200)
    const permission = sharePermission(input.permission)
    const expiresAt = optionalDate(input.expiresAt, 'expiresAt')
    if (expiresAt && expiresAt <= new Date()) throw moduleError('VALIDATION_FAILED', 'expiresAt must be in the future')
    if (recipientAccountId === accountId) throw moduleError('VALIDATION_FAILED', 'A record cannot be shared with its owner')
    const payloadHash = sha256(canonicalJsonStringify({
      moduleId: runtime.moduleId,
      recordType,
      recordId,
      recipientAccountId,
      permission,
      expiresAt: expiresAt?.toISOString() ?? null,
      requestedShareId: input.shareId ?? null,
    }))

    return this.db.transaction().execute(async trx => {
      const replay = await trx.selectFrom('greenfield_module_record_shares').selectAll()
        .where('owner_account_id', '=', accountId).where('source_installation_id', '=', runtime.installationId)
        .where('mutation_id', '=', mutationId).executeTakeFirst()
      if (replay) {
        if (replay.payload_hash !== payloadHash) {
          throw moduleError('MUTATION_REUSE_CONFLICT', 'Mutation ID was already used for a different share')
        }
        return toShare(replay)
      }
      const record = await trx.selectFrom('greenfield_module_records').select(['revision'])
        .where('account_id', '=', accountId).where('module_id', '=', runtime.moduleId).where('collection', '=', recordType)
        .where('record_id', '=', recordId).where('deleted_at', 'is', null).forUpdate().executeTakeFirst()
      if (!record) throw moduleError('NOT_FOUND', 'Module record not found')
      const recipient = await trx.selectFrom('greenfield_accounts').select('account_id').where('account_id', '=', recipientAccountId).executeTakeFirst()
      if (!recipient) throw moduleError('NOT_FOUND', 'Recipient account not found')
      const active = await trx.selectFrom('greenfield_module_record_shares').select('share_id')
        .where('owner_account_id', '=', accountId).where('recipient_account_id', '=', recipientAccountId)
        .where('module_id', '=', runtime.moduleId).where('record_type', '=', recordType).where('record_id', '=', recordId)
        .where('revoked_at', 'is', null).executeTakeFirst()
      if (active) throw moduleError('CONFLICT', 'An active record share already exists')
      const now = new Date()
      await trx.insertInto('greenfield_module_record_shares').values({
        share_id: shareId, owner_account_id: accountId, recipient_account_id: recipientAccountId,
        source_installation_id: runtime.installationId, module_id: runtime.moduleId, record_type: recordType,
        record_id: recordId, permission, mutation_id: mutationId, payload_hash: payloadHash, created_at: now, updated_at: now,
        expires_at: expiresAt, revoked_at: null, visibility_lost_at: null,
      }).execute()
      await this.emitRecipientChange(trx, runtime, recipientAccountId, recordType, recordId, record.revision, 'share', {shareId, permission})
      await new AuditRepository(trx).append('module.record.share.created', {moduleId: runtime.moduleId, recordType, shareId, permission, recipientAccountId}, {type: 'moduleRecord', id: recordId, actorId: actor.actorId ?? null}, {accountId, requestId: actor.requestId})
      await this.publishChange(trx, runtime, recordType, recordId, record.revision, 'share', {shareId, permission, recipientAccountId})
      const created = await trx.selectFrom('greenfield_module_record_shares').selectAll().where('share_id', '=', shareId).executeTakeFirstOrThrow()
      return toShare(created)
    })
  }

  async listOwned(accountId: string, moduleId: string, recordType?: string, recordId?: string) {
    if (recordId && !recordType) throw moduleError('VALIDATION_FAILED', 'recordType is required when recordId is provided')
    const runtime = await this.requireRuntime(accountId, moduleId, recordType, 'read')
    let query = this.db.selectFrom('greenfield_module_record_shares').selectAll()
      .where('owner_account_id', '=', accountId).where('module_id', '=', runtime.moduleId)
    if (recordType) query = query.where('record_type', '=', recordType)
    if (recordId) query = query.where('record_id', '=', recordId)
    const rows = await query.orderBy('created_at', 'desc').execute()
    if (recordType) return {shares: rows.map(toShare)}
    const readable = []
    for (const row of rows) {
      try {
        this.access.enforceCapability(runtime, collectionPermission(runtime.moduleId, row.record_type, 'read'))
        this.access.enforceCapability(runtime, sharingPermission(runtime.moduleId, row.record_type, 'read'))
        readable.push(toShare(row))
      } catch {
        // Per-collection grants remain authoritative for an unfiltered list.
      }
    }
    return {shares: readable}
  }

  async listReceived(accountId: string, moduleId: string) {
    const runtime = await this.requireRuntime(accountId, moduleId, undefined, 'read')
    const rows = await this.db.selectFrom('greenfield_module_record_shares').selectAll()
      .where('recipient_account_id', '=', accountId).where('module_id', '=', runtime.moduleId)
      .where('revoked_at', 'is', null)
      .where(eb => eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', new Date())]))
      .orderBy('created_at', 'desc').execute()
    const readable = []
    for (const row of rows) {
      try {
        this.access.enforceCapability(runtime, collectionPermission(runtime.moduleId, row.record_type, 'read'))
        this.access.enforceCapability(runtime, sharingPermission(runtime.moduleId, row.record_type, 'read'))
        readable.push(toShare(row))
      } catch {
        // Collection grants remain authoritative; a share never grants module-wide access.
      }
    }
    return {shares: readable}
  }

  async read(accountId: string, moduleId: string, shareId: string) {
    const {runtime, share} = await this.requireActiveShare(accountId, moduleId, shareId, false)
    const record = await this.db.selectFrom('greenfield_module_records').selectAll()
      .where('account_id', '=', share.owner_account_id).where('module_id', '=', runtime.moduleId)
      .where('collection', '=', share.record_type).where('record_id', '=', share.record_id)
      .where('deleted_at', 'is', null).executeTakeFirst()
    if (!record) throw moduleError('NOT_FOUND', 'Shared record not found')
    return {share: toShare(share), record}
  }

  async history(accountId: string, moduleId: string, shareId: string, limit = 25) {
    const {runtime, share} = await this.requireActiveShare(accountId, moduleId, shareId, false)
    const rows = await this.db.selectFrom('greenfield_module_record_revisions').selectAll()
      .where('account_id', '=', share.owner_account_id).where('module_id', '=', runtime.moduleId)
      .where('record_type', '=', share.record_type).where('record_id', '=', share.record_id)
      // MP02B policy: a recipient can read snapshots created while this share exists,
      // never historical content from before the grant.
      .where('created_at', '>=', share.created_at).orderBy('revision', 'desc').limit(clampLimit(limit)).execute()
    return {share: toShare(share), revisions: rows.map(row => ({
      revision: row.revision, operation: row.operation, actorId: row.actor_id, deleted: row.deleted,
      createdAt: row.created_at.toISOString(), data: row.data_snapshot, visibility: row.visibility,
    }))}
  }

  async edit(accountId: string, moduleId: string, shareId: string, input: {data?: unknown; expectedRevision?: number; visibility?: string; mutationId?: string}, actor: {actorId?: string; requestId?: string}) {
    const {share} = await this.requireActiveShare(accountId, moduleId, shareId, true)
    return this.records.patchShared(accountId, share.owner_account_id, moduleId, share.record_type, share.record_id, input, actor)
  }

  async update(accountId: string, moduleId: string, shareId: string, input: {permission?: unknown; expiresAt?: unknown}, actor: {actorId?: string; requestId?: string} = {}) {
    const runtime = await this.access.resolve(accountId, resolveCanonicalModuleId(moduleId), {requireEnabled: true})
    const permission = sharePermission(input.permission)
    const expiresAt = optionalDate(input.expiresAt, 'expiresAt')
    if (expiresAt && expiresAt <= new Date()) throw moduleError('VALIDATION_FAILED', 'expiresAt must be in the future')
    return this.db.transaction().execute(async trx => {
      const current = await trx.selectFrom('greenfield_module_record_shares').selectAll().where('share_id', '=', shareId)
        .where('owner_account_id', '=', accountId).where('module_id', '=', runtime.moduleId).forUpdate().executeTakeFirst()
      if (!current || current.revoked_at) throw moduleError('NOT_FOUND', 'Record share not found')
      this.access.enforceCapability(runtime, collectionPermission(runtime.moduleId, current.record_type, 'write'))
      this.access.enforceCapability(runtime, sharingPermission(runtime.moduleId, current.record_type, 'write'))
      const now = new Date()
      const updated = await trx.updateTable('greenfield_module_record_shares').set({permission, expires_at: expiresAt, visibility_lost_at: null, updated_at: now})
        .where('share_id', '=', shareId).returningAll().executeTakeFirstOrThrow()
      const record = await trx.selectFrom('greenfield_module_records').select('revision').where('account_id', '=', accountId)
        .where('module_id', '=', runtime.moduleId).where('collection', '=', current.record_type).where('record_id', '=', current.record_id).executeTakeFirst()
      await this.emitRecipientChange(trx, runtime, current.recipient_account_id, current.record_type, current.record_id, record?.revision ?? 0, 'permission', {shareId, permission})
      await new AuditRepository(trx).append('module.record.share.updated', {moduleId: runtime.moduleId, shareId, permission}, {type: 'moduleRecord', id: current.record_id, actorId: actor.actorId ?? null}, {accountId, requestId: actor.requestId})
      await this.publishChange(trx, runtime, current.record_type, current.record_id, record?.revision ?? 0, 'permission', {shareId, permission, recipientAccountId: current.recipient_account_id})
      return toShare(updated)
    })
  }

  async revoke(accountId: string, moduleId: string, shareId: string, actor: {actorId?: string; requestId?: string} = {}) {
    const runtime = await this.access.resolve(accountId, resolveCanonicalModuleId(moduleId), {requireEnabled: true})
    return this.db.transaction().execute(async trx => {
      const current = await trx.selectFrom('greenfield_module_record_shares').selectAll().where('share_id', '=', shareId)
        .where('owner_account_id', '=', accountId).where('module_id', '=', runtime.moduleId).forUpdate().executeTakeFirst()
      if (!current) throw moduleError('NOT_FOUND', 'Record share not found')
      this.access.enforceCapability(runtime, collectionPermission(runtime.moduleId, current.record_type, 'write'))
      this.access.enforceCapability(runtime, sharingPermission(runtime.moduleId, current.record_type, 'write'))
      if (current.revoked_at) return {revoked: true, shareId, revokedAt: current.revoked_at.toISOString()}
      const now = new Date()
      await trx.updateTable('greenfield_module_record_shares').set({revoked_at: now, visibility_lost_at: now, updated_at: now}).where('share_id', '=', shareId).execute()
      const record = await trx.selectFrom('greenfield_module_records').select('revision').where('account_id', '=', accountId)
        .where('module_id', '=', runtime.moduleId).where('collection', '=', current.record_type).where('record_id', '=', current.record_id).executeTakeFirst()
      await this.emitRecipientChange(trx, runtime, current.recipient_account_id, current.record_type, current.record_id, record?.revision ?? 0, 'revoke', {shareId})
      await new AuditRepository(trx).append('module.record.share.revoked', {moduleId: runtime.moduleId, shareId, recipientAccountId: current.recipient_account_id}, {type: 'moduleRecord', id: current.record_id, actorId: actor.actorId ?? null}, {accountId, requestId: actor.requestId})
      await this.publishChange(trx, runtime, current.record_type, current.record_id, record?.revision ?? 0, 'revoke', {shareId, recipientAccountId: current.recipient_account_id})
      return {revoked: true, shareId, revokedAt: now.toISOString()}
    })
  }

  private async requireRuntime(accountId: string, moduleId: string, recordType: string | undefined, operation: 'read' | 'write') {
    const runtime = await this.access.resolve(accountId, resolveCanonicalModuleId(moduleId), {requireEnabled: true})
    if (recordType) {
      this.access.enforceCapability(runtime, collectionPermission(runtime.moduleId, recordType, operation))
      this.access.enforceCapability(runtime, sharingPermission(runtime.moduleId, recordType, operation))
    } else if (runtime.permissionReviewRequired) {
      throw moduleError('PERMISSION_REVIEW_REQUIRED', 'Module permission review is required')
    }
    return runtime
  }

  private async requireActiveShare(accountId: string, moduleId: string, shareId: string, edit: boolean) {
    const runtime = await this.access.resolve(accountId, resolveCanonicalModuleId(moduleId), {requireEnabled: true})
    const share = await this.db.selectFrom('greenfield_module_record_shares').selectAll()
      .where('share_id', '=', shareId).where('recipient_account_id', '=', accountId).where('module_id', '=', runtime.moduleId)
      .where('revoked_at', 'is', null).where(eb => eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', new Date())])).executeTakeFirst()
    if (!share || (edit && share.permission !== 'edit')) throw moduleError('NOT_FOUND', 'Record share not found')
    this.access.enforceCapability(runtime, collectionPermission(runtime.moduleId, share.record_type, edit ? 'write' : 'read'))
    this.access.enforceCapability(runtime, sharingPermission(runtime.moduleId, share.record_type, edit ? 'write' : 'read'))
    return {runtime, share}
  }

  private async emitRecipientChange(trx: Transaction<Database>, runtime: GreenfieldModuleRuntimeContext, recipientAccountId: string, recordType: string, recordId: string, revision: number, operation: 'share' | 'permission' | 'revoke', details: Record<string, unknown>) {
    const installation = await trx.selectFrom('greenfield_extension_installations as installation')
      .innerJoin('greenfield_module_releases as release', 'release.extension_version_id', 'installation.extension_version_id')
      .select('installation.installation_id').where('installation.account_id', '=', recipientAccountId)
      .where('installation.status', '=', 'enabled').where('release.module_id', '=', runtime.moduleId).executeTakeFirst()
    if (!installation) return
    await trx.insertInto('greenfield_module_record_changes').values({
      account_id: recipientAccountId, installation_id: installation.installation_id, owner_account_id: runtime.accountId,
      module_id: runtime.moduleId, record_type: recordType, record_id: recordId, revision,
      operation, change_kind: operation === 'revoke' ? 'visibility' : 'sharing', details,
      deleted: operation === 'revoke', created_at: new Date(),
    }).execute()
  }

  private async publishChange(trx: Transaction<Database>, runtime: GreenfieldModuleRuntimeContext, recordType: string, recordId: string, revision: number, operation: 'share' | 'permission' | 'revoke', details: Record<string, unknown>) {
    await new GreenfieldEventBus(trx).publish({
      eventType: 'module.record.sharing.changed.v1',
      aggregateType: 'module-record',
      aggregateId: recordId,
      aggregateVersion: revision,
      accountId: runtime.accountId,
      producerKind: 'product',
      producerId: runtime.moduleId,
      productId: runtime.moduleId,
      installationId: runtime.installationId,
      releaseId: runtime.releaseId,
      visibility: 'account',
      classification: 'private',
      payload: {record: {moduleId: runtime.moduleId, recordType, recordId}, operation, ...details},
      metadata: {source: 'greenfield.module-record-sharing'},
    })
  }
}

function toShare(row: Database['greenfield_module_record_shares']) {
  return {
    shareId: row.share_id,
    record: {moduleId: row.module_id, recordType: row.record_type, recordId: row.record_id},
    ownerAccountId: row.owner_account_id, recipientAccountId: row.recipient_account_id,
    permission: row.permission, createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at?.toISOString() ?? null, revokedAt: row.revoked_at?.toISOString() ?? null,
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

function sharePermission(value: unknown): 'read' | 'edit' {
  if (value !== 'read' && value !== 'edit') throw moduleError('VALIDATION_FAILED', 'permission must be read or edit')
  return value
}

function optionalDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw moduleError('VALIDATION_FAILED', `Invalid ${field}`)
  const result = new Date(value)
  if (Number.isNaN(result.getTime())) throw moduleError('VALIDATION_FAILED', `Invalid ${field}`)
  return result
}

function clampLimit(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(100, Math.floor(value))) : 25
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
