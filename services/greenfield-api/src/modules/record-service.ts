import {createHash, createHmac, timingSafeEqual} from 'node:crypto'
import {canonicalJsonStringify, canonicalMutationJsonStringify} from '@modula/greenfield-protocol'
import type {GreenfieldModuleCollectionDefinition, GreenfieldModuleFieldDefinition} from '@modula/greenfield-module-ui-contracts'
import {moduleIdFamily, resolveCanonicalModuleId} from '@modula/greenfield-contracts'
import {sql, type Transaction} from 'kysely'
import type {Database} from '../database/types.js'
import type {ModulaDb} from '../database/client.js'
import type {AppConfig} from '../config/index.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {GreenfieldEventBus} from '../events/index.js'
import {uuidv7} from '../lib/uuidv7.js'
import {moduleError} from './module-errors.js'
import {collectionPermission, GreenfieldModuleRuntimeAccessService, type GreenfieldModuleRuntimeContext} from './runtime-access.js'
import {GreenfieldModuleViewService} from './view-service.js'
import {GreenfieldModuleIdentityMigrationService} from './identity-migration-service.js'

type ModuleRecordOperation = 'create' | 'update' | 'delete' | 'restore' | 'purge'
type ModuleRecordVersionChangeSource = 'update' | 'restore' | 'import' | 'delete' | 'ai-assisted'
type GenericRecordOperation = 'create' | 'update' | 'delete' | 'restore'
type RecordVisibility = 'private' | 'teams' | 'followers' | 'public' | 'system'
type RecordIdentity = {moduleId: string; recordType: string; recordId: string}
type NormalizedReference = {fieldPath: string; ordinal: number; record: RecordIdentity}
type MutationActor = {actorId?: string; requestId?: string}
type ExecuteMutationInput = {
  context: {runtime: GreenfieldModuleRuntimeContext; collectionDefinition: GreenfieldModuleCollectionDefinition}
  collectionDefinition: GreenfieldModuleCollectionDefinition
  operation: GenericRecordOperation
  recordId: string
  data?: Record<string, unknown>
  visibility?: RecordVisibility
  expectedRevision?: number
  sourceRevision?: number
  mutationId: string
  actor: MutationActor
  payloadInput: Record<string, unknown>
  references?: NormalizedReference[]
  recordAccountId?: string
}

export type ModuleRecordQuery = {
  cursor?: string
  limit?: number
  sort?: string
  direction?: 'asc' | 'desc'
  q?: string
  folder?: string
  createdFrom?: string
  createdTo?: string
  updatedFrom?: string
  updatedTo?: string
  filters?: Record<string, unknown>
  recordState?: 'active' | 'deleted'
}

export type ModuleRecordSyncQuery = {after?: string; limit?: number}
export type ModuleRecordReverseReferenceQuery = {sourceModuleId?: string; sourceRecordType?: string; fieldPath?: string; limit?: number}

export class GreenfieldModuleRecordService {
  private readonly access: GreenfieldModuleRuntimeAccessService
  private readonly views: GreenfieldModuleViewService

  constructor(
    private readonly db: ModulaDb,
    private readonly config?: Pick<AppConfig, 'environment' | 'moduleAllowUntrustedDevelopmentReleases'>
      & Partial<Pick<AppConfig, 'checkpointSigningKey' | 'sessionPepper'>>,
  ) {
    this.access = new GreenfieldModuleRuntimeAccessService(db, config)
    this.views = new GreenfieldModuleViewService(db, config)
  }

  async list(accountId: string, moduleId: string, collection: string, input: ModuleRecordQuery = {}) {
    const context = await this.resolveRecordContext(accountId, moduleId, collection, 'read')
    const definition = context.collectionDefinition
    const limit = clampLimit(input.limit, 25)
    const offset = parseCursor(input.cursor)
    const sortField = input.sort ?? 'updatedAt'
    const direction = input.direction === 'asc' ? 'asc' : 'desc'
    if (!definition.sortableFields.includes(sortField) && !['createdAt', 'updatedAt'].includes(sortField)) {
      throw moduleError('VALIDATION_FAILED', `Unsupported sort field ${sortField}`)
    }
    const filters = input.filters ?? {}
    for (const key of Object.keys(filters)) {
      if (!definition.filterableFields.includes(key)) throw moduleError('VALIDATION_FAILED', `Unsupported filter field ${key}`)
    }

    let query = this.db
      .selectFrom('greenfield_module_records')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('module_id', 'in', [...moduleIdFamily(moduleId)])
      .where('collection', '=', collection)

    query = input.recordState === 'deleted'
      ? query.where('deleted_at', 'is not', null)
      : query.where('deleted_at', 'is', null)

    for (const [field, value] of Object.entries(filters)) {
      query = value === null
        ? query.where(sql`greenfield_module_records.data ->> ${field}`, 'is', null) as typeof query
        : query.where(sql`greenfield_module_records.data ->> ${field}`, '=', String(value)) as typeof query
    }
    if (input.q) {
      if (definition.searchableFields.length === 0) throw moduleError('VALIDATION_FAILED', 'Collection is not searchable')
      query = query.where('search_text', 'ilike', `%${escapeLike(input.q)}%`)
    }
    if (input.folder) query = query.where('folder_ref', '=', input.folder)
    if (input.createdFrom) query = query.where('created_at', '>=', new Date(input.createdFrom))
    if (input.createdTo) query = query.where('created_at', '<=', new Date(input.createdTo))
    if (input.updatedFrom) query = query.where('updated_at', '>=', new Date(input.updatedFrom))
    if (input.updatedTo) query = query.where('updated_at', '<=', new Date(input.updatedTo))

    if (sortField === 'createdAt') query = query.orderBy('created_at', direction)
    else if (sortField === 'updatedAt') query = query.orderBy('updated_at', direction)
    else query = query.orderBy(sql`greenfield_module_records.data ->> ${sortField}`, direction)

    const rows = await query.limit(limit + 1).offset(offset).execute()
    const items = rows.slice(0, limit)
    return {
      moduleId,
      collection,
      items,
      nextCursor: rows.length > limit ? String(offset + limit) : null,
      limit,
    }
  }

  async get(accountId: string, moduleId: string, collection: string, recordId: string) {
    await this.resolveRecordContext(accountId, moduleId, collection, 'read')
    const record = await this.findRecord(accountId, moduleId, collection, recordId, false)
    if (!record) throw moduleError('NOT_FOUND', 'Module record not found')
    return record
  }

  private async findRecord(accountId: string, moduleId: string, collection: string, recordId: string, includeDeleted: boolean) {
    let query = this.db
      .selectFrom('greenfield_module_records')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('module_id', 'in', [...moduleIdFamily(moduleId)])
      .where('collection', '=', collection)
      .where('record_id', '=', recordId)
    if (!includeDeleted) query = query.where('deleted_at', 'is', null) as typeof query
    return query.executeTakeFirst()
  }

  async create(
    accountId: string,
    moduleId: string,
    collection: string,
    input: {data?: unknown; visibility?: string; recordId?: string; mutationId?: string},
    actor: MutationActor = {},
  ) {
    const canonicalId = resolveCanonicalModuleId(moduleId)
    const context = await this.resolveRecordContext(accountId, canonicalId, collection, 'write')
    const data = requireRecordData(input.data)
    const visibility = normalizeVisibility(input.visibility ?? context.collectionDefinition.defaultVisibility)
    const mutationId = requireMutationId(input.mutationId)
    validateRecordData(context.collectionDefinition, data, visibility, true)
    const recordId = input.recordId ?? uuidv7()
    const references = extractReferences(context.collectionDefinition, data)
    await this.validateReferenceTargets(accountId, references)
    return this.executeMutation({
      context,
      collectionDefinition: context.collectionDefinition,
      operation: 'create',
      recordId,
      data,
      visibility,
      mutationId,
      actor,
      payloadInput: {data, visibility, requestedRecordId: input.recordId ?? null},
      references,
    })
  }

  async patch(
    accountId: string,
    moduleId: string,
    collection: string,
    recordId: string,
    input: {data?: unknown; expectedRevision?: number; visibility?: string; changeSource?: ModuleRecordVersionChangeSource; versionMetadata?: Record<string, unknown>; mutationId?: string},
    actor: MutationActor = {},
  ) {
    const context = await this.resolveRecordContext(accountId, moduleId, collection, 'write')
    requireExpectedRevision(input.expectedRevision)
    const patchData = requireRecordData(input.data)
    const references = extractReferences(context.collectionDefinition, patchData)
    await this.validateReferenceTargets(accountId, references)
    return this.executeMutation({
      context,
      collectionDefinition: context.collectionDefinition,
      operation: 'update',
      recordId,
      data: patchData,
      visibility: input.visibility === undefined ? undefined : normalizeVisibility(input.visibility),
      expectedRevision: input.expectedRevision,
      mutationId: requireMutationId(input.mutationId),
      actor,
      payloadInput: {data: patchData, visibility: input.visibility ?? null, expectedRevision: input.expectedRevision},
      references,
    })
  }

  async patchShared(
    accountId: string,
    ownerAccountId: string,
    moduleId: string,
    collection: string,
    recordId: string,
    input: {data?: unknown; expectedRevision?: number; visibility?: string; mutationId?: string},
    actor: MutationActor = {},
  ) {
    const context = await this.resolveRecordContext(accountId, moduleId, collection, 'write')
    const share = await this.db.selectFrom('greenfield_module_record_shares').select('share_id')
      .where('owner_account_id', '=', ownerAccountId).where('recipient_account_id', '=', accountId)
      .where('module_id', '=', context.runtime.moduleId).where('record_type', '=', collection)
      .where('record_id', '=', recordId).where('permission', '=', 'edit').where('revoked_at', 'is', null)
      .where(eb => eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', new Date())])).executeTakeFirst()
    if (!share) throw moduleError('NOT_FOUND', 'Editable record share not found')
    requireExpectedRevision(input.expectedRevision)
    const patchData = requireRecordData(input.data)
    const references = extractReferences(context.collectionDefinition, patchData)
    await this.validateReferenceTargets(accountId, references)
    return this.executeMutation({
      context,
      collectionDefinition: context.collectionDefinition,
      operation: 'update',
      recordId,
      data: patchData,
      visibility: input.visibility === undefined ? undefined : normalizeVisibility(input.visibility),
      expectedRevision: input.expectedRevision,
      mutationId: requireMutationId(input.mutationId),
      actor,
      payloadInput: {data: patchData, visibility: input.visibility ?? null, expectedRevision: input.expectedRevision},
      references,
      recordAccountId: ownerAccountId,
    })
  }

  async delete(accountId: string, moduleId: string, collection: string, recordId: string, input: {expectedRevision?: number; mutationId?: string} = {}, actor: MutationActor = {}) {
    const context = await this.resolveRecordContext(accountId, moduleId, collection, 'delete')
    requireExpectedRevision(input.expectedRevision)
    return this.executeMutation({
      context,
      collectionDefinition: context.collectionDefinition,
      operation: 'delete',
      recordId,
      expectedRevision: input.expectedRevision,
      mutationId: requireMutationId(input.mutationId),
      actor,
      payloadInput: {expectedRevision: input.expectedRevision},
      references: [],
    })
  }

  async restore(
    accountId: string,
    moduleId: string,
    collection: string,
    recordId: string,
    input: {expectedRevision?: number; sourceRevision?: number; mutationId?: string} = {},
    actor: MutationActor = {},
  ) {
    const context = await this.resolveRecordContext(accountId, moduleId, collection, 'write')
    requireExpectedRevision(input.expectedRevision)
    if (!Number.isInteger(input.sourceRevision) || Number(input.sourceRevision) < 1) throw moduleError('VALIDATION_FAILED', 'sourceRevision is required')
    const source = await this.getRevision(accountId, moduleId, collection, recordId, Number(input.sourceRevision))
    const restoredData = requireRecordData(source.data)
    const references = extractReferences(context.collectionDefinition, restoredData)
    await this.validateReferenceTargets(accountId, references)
    return this.executeMutation({
      context,
      collectionDefinition: context.collectionDefinition,
      operation: 'restore',
      recordId,
      expectedRevision: input.expectedRevision,
      sourceRevision: input.sourceRevision,
      mutationId: requireMutationId(input.mutationId),
      actor,
      payloadInput: {expectedRevision: input.expectedRevision, sourceRevision: input.sourceRevision},
      references,
    })
  }

  async listRevisions(accountId: string, moduleId: string, collection: string, recordId: string, input: {limit?: number} = {}) {
    await this.requireReadableRecord(accountId, moduleId, collection, recordId, true)
    const limit = clampLimit(input.limit, 25)
    const rows = await this.db
      .selectFrom('greenfield_module_record_revisions')
      .select(['revision_id', 'module_id', 'record_type', 'record_id', 'revision', 'base_revision', 'operation', 'mutation_id', 'actor_id', 'deleted', 'payload_hash', 'created_at'])
      .where('account_id', '=', accountId)
      .where('module_id', '=', resolveCanonicalModuleId(moduleId))
      .where('record_type', '=', collection)
      .where('record_id', '=', recordId)
      .orderBy('revision', 'desc')
      .limit(limit)
      .execute()
    return {record: recordIdentity(moduleId, collection, recordId), revisions: rows.map(serializeRevisionMetadata)}
  }

  async getRevision(accountId: string, moduleId: string, collection: string, recordId: string, revision: number) {
    await this.requireReadableRecord(accountId, moduleId, collection, recordId, true)
    if (!Number.isInteger(revision) || revision < 1) throw moduleError('VALIDATION_FAILED', 'Invalid revision')
    const row = await this.db
      .selectFrom('greenfield_module_record_revisions')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('module_id', '=', resolveCanonicalModuleId(moduleId))
      .where('record_type', '=', collection)
      .where('record_id', '=', recordId)
      .where('revision', '=', revision)
      .executeTakeFirst()
    if (!row) throw moduleError('NOT_FOUND', 'Module record revision not found')
    return {...serializeRevisionMetadata(row), data: row.data_snapshot, visibility: row.visibility}
  }

  async currentRevision(accountId: string, moduleId: string, collection: string, recordId: string) {
    const current = await this.requireReadableRecord(accountId, moduleId, collection, recordId, true)
    return {record: recordIdentity(moduleId, collection, recordId), revision: current.revision}
  }

  async forwardReferences(accountId: string, moduleId: string, collection: string, recordId: string, fieldPath?: string) {
    await this.requireReadableRecord(accountId, moduleId, collection, recordId, false)
    let query = this.db
      .selectFrom('greenfield_module_record_references')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('source_module_id', '=', resolveCanonicalModuleId(moduleId))
      .where('source_record_type', '=', collection)
      .where('source_record_id', '=', recordId)
    if (fieldPath) query = query.where('field_path', '=', fieldPath)
    const rows = await query.orderBy('field_path').orderBy('ordinal').execute()
    const references = []
    for (const row of rows) {
      if (!await this.canReadRecord(accountId, row.target_module_id, row.target_record_type, row.target_record_id)) continue
      references.push({
        fieldPath: row.field_path,
        ordinal: row.ordinal,
        record: recordIdentity(row.target_module_id, row.target_record_type, row.target_record_id),
      })
    }
    return {record: recordIdentity(moduleId, collection, recordId), references}
  }

  async reverseReferences(
    accountId: string,
    moduleId: string,
    collection: string,
    recordId: string,
    input: ModuleRecordReverseReferenceQuery = {},
  ) {
    await this.requireReadableRecord(accountId, moduleId, collection, recordId, false)
    const limit = clampLimit(input.limit, 50)
    let query = this.db
      .selectFrom('greenfield_module_record_references')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('target_module_id', '=', resolveCanonicalModuleId(moduleId))
      .where('target_record_type', '=', collection)
      .where('target_record_id', '=', recordId)
    if (input.sourceModuleId) query = query.where('source_module_id', '=', resolveCanonicalModuleId(input.sourceModuleId))
    if (input.sourceRecordType) query = query.where('source_record_type', '=', input.sourceRecordType)
    if (input.fieldPath) query = query.where('field_path', '=', input.fieldPath)
    const rows = await query.orderBy('created_at', 'desc').limit(limit * 4).execute()
    const references = []
    for (const row of rows) {
      if (references.length >= limit) break
      if (!await this.canReadRecord(accountId, row.source_module_id, row.source_record_type, row.source_record_id)) continue
      references.push({
        source: recordIdentity(row.source_module_id, row.source_record_type, row.source_record_id),
        sourceRevision: row.source_revision,
        fieldPath: row.field_path,
        ordinal: row.ordinal,
      })
    }
    return {target: recordIdentity(moduleId, collection, recordId), references}
  }

  async sync(accountId: string, moduleId: string, input: ModuleRecordSyncQuery = {}) {
    const canonicalId = resolveCanonicalModuleId(moduleId)
    const runtime = await this.access.resolve(accountId, canonicalId, {requireEnabled: true})
    const after = input.after ? decodeSyncCursor(input.after, runtime, this.syncSigningKey()) : '0'
    const limit = clampLimit(input.limit, 100)
    const rows = await this.db
      .selectFrom('greenfield_module_record_changes')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('installation_id', '=', runtime.installationId)
      .where('module_id', '=', canonicalId)
      .where('change_sequence', '>', after)
      .orderBy('change_sequence', 'asc')
      .limit(limit)
      .execute()
    const changes = []
    const tombstones = []
    const resourceChanges = []
    let latestRevision: {moduleId: string; recordType: string; recordId: string; revision: number} | null = null
    for (const row of rows) {
      try {
        this.access.enforceCapability(runtime, collectionPermission(canonicalId, row.record_type, 'read'))
      } catch {
        continue
      }
      const identity = recordIdentity(canonicalId, row.record_type, row.record_id)
      latestRevision = {...identity, revision: row.revision}
      const ownerAccountId = row.owner_account_id ?? accountId
      const sharedAccess = ownerAccountId === accountId || await this.hasActiveShare(accountId, ownerAccountId, canonicalId, row.record_type, row.record_id)
      if (!sharedAccess) {
        tombstones.push({...identity, revision: row.revision, reason: 'visibility-lost', changedAt: row.created_at.toISOString()})
        continue
      }
      if (row.change_kind === 'media') {
        resourceChanges.push({kind: 'media-binding', operation: row.operation, record: identity, revision: row.revision, details: row.details, changedAt: row.created_at.toISOString()})
        continue
      }
      if (row.deleted) {
        tombstones.push({...identity, revision: row.revision, reason: row.change_kind === 'visibility' ? 'visibility-lost' : 'deleted', changedAt: row.created_at.toISOString()})
        continue
      }
      const current = await this.findRecord(ownerAccountId, canonicalId, row.record_type, row.record_id, false)
      if (!current) continue
      changes.push({record: current, latestRevision: {...identity, revision: current.revision}, changedAt: row.created_at.toISOString()})
    }
    const expiredShares = await this.db.selectFrom('greenfield_module_record_shares as share')
      .leftJoin('greenfield_module_records as record', join => join
        .onRef('record.account_id', '=', 'share.owner_account_id').onRef('record.module_id', '=', 'share.module_id')
        .onRef('record.collection', '=', 'share.record_type').onRef('record.record_id', '=', 'share.record_id'))
      .select(['share.module_id', 'share.record_type', 'share.record_id', 'share.expires_at', 'record.revision'])
      .where('share.recipient_account_id', '=', accountId).where('share.module_id', '=', canonicalId)
      .where('share.revoked_at', 'is', null).where('share.expires_at', '<=', new Date()).execute()
    for (const expired of expiredShares) {
      const identity = recordIdentity(expired.module_id, expired.record_type, expired.record_id)
      if (!tombstones.some(item => item.moduleId === identity.moduleId && item.recordType === identity.recordType && item.recordId === identity.recordId)) {
        tombstones.push({...identity, revision: expired.revision ?? 0, reason: 'visibility-lost', changedAt: expired.expires_at!.toISOString()})
      }
    }
    const sequence = rows.at(-1)?.change_sequence ?? after
    return {
      changes,
      tombstones,
      resourceChanges,
      latestRevision,
      nextCursor: encodeSyncCursor(runtime, sequence, this.syncSigningKey()),
    }
  }

  private async hasActiveShare(accountId: string, ownerAccountId: string, moduleId: string, recordType: string, recordId: string): Promise<boolean> {
    const share = await this.db.selectFrom('greenfield_module_record_shares').select('share_id')
      .where('owner_account_id', '=', ownerAccountId).where('recipient_account_id', '=', accountId)
      .where('module_id', '=', moduleId).where('record_type', '=', recordType).where('record_id', '=', recordId)
      .where('revoked_at', 'is', null).where(eb => eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', new Date())]))
      .executeTakeFirst()
    return Boolean(share)
  }

  private async executeMutation(input: ExecuteMutationInput) {
    const mutationId = requireMutationId(input.mutationId)
    const {runtime} = input.context
    const recordAccountId = input.recordAccountId ?? runtime.accountId
    const payloadHash = sha256(canonicalMutationJsonStringify({
      operation: input.operation,
      record: {
        moduleId: runtime.moduleId,
        recordType: input.collectionDefinition.collection,
        recordId: input.recordId,
      },
      payload: input.payloadInput,
      expectedRevision: input.expectedRevision ?? null,
    }))
    const execute = async (trx: Transaction<Database>) => {
      const reservationId = uuidv7()
      const reserved = await trx
        .insertInto('greenfield_module_record_mutations')
        .values({
          mutation_row_id: reservationId,
          account_id: runtime.accountId,
          installation_id: runtime.installationId,
          module_id: runtime.moduleId,
          mutation_id: mutationId,
          operation: input.operation,
          record_type: input.collectionDefinition.collection,
          record_id: input.recordId,
          payload_hash: payloadHash,
          status: 'pending',
          result: null,
          created_at: new Date(),
          completed_at: null,
        })
        .onConflict(conflict => conflict.columns(['account_id', 'installation_id', 'mutation_id']).doNothing())
        .returning('mutation_row_id')
        .executeTakeFirst()
      if (!reserved) {
        const previous = await trx
          .selectFrom('greenfield_module_record_mutations')
          .select(['payload_hash', 'status', 'result'])
          .where('account_id', '=', runtime.accountId)
          .where('installation_id', '=', runtime.installationId)
          .where('mutation_id', '=', mutationId)
          .executeTakeFirstOrThrow()
        if (previous.payload_hash !== payloadHash) throw moduleError('MUTATION_REUSE_CONFLICT', 'Mutation ID was already used for a different payload')
        if (previous.status !== 'completed' || previous.result === null) throw moduleError('CONFLICT', 'Mutation is already in progress')
        return previous.result as Record<string, unknown>
      }

      const current = await trx
        .selectFrom('greenfield_module_records')
        .selectAll()
        .where('account_id', '=', recordAccountId)
        .where('module_id', '=', runtime.moduleId)
        .where('collection', '=', input.collectionDefinition.collection)
        .where('record_id', '=', input.recordId)
        .forUpdate()
        .executeTakeFirst()
      if (input.operation === 'create' && current) throw moduleError('CONFLICT', 'Module record already exists')
      if (input.operation !== 'create' && !current) throw moduleError('NOT_FOUND', 'Module record not found')
      if (current && current.revision !== input.expectedRevision) throw moduleError('REVISION_CONFLICT', 'Module record revision conflict')

      let data = input.data
      let visibility = input.visibility
      let references = input.references ?? []
      if (input.operation === 'restore') {
        const source = await trx
          .selectFrom('greenfield_module_record_revisions')
          .select(['data_snapshot', 'visibility'])
          .where('account_id', '=', recordAccountId)
          .where('module_id', '=', runtime.moduleId)
          .where('record_type', '=', input.collectionDefinition.collection)
          .where('record_id', '=', input.recordId)
          .where('revision', '=', input.sourceRevision!)
          .executeTakeFirst()
        if (!source) throw moduleError('NOT_FOUND', 'Module record revision not found')
        data = requireRecordData(source.data_snapshot)
        visibility = source.visibility
        references = extractReferences(input.collectionDefinition, data)
      }
      if (input.operation === 'update' && current) {
        data = {...requireRecordData(current.data), ...requireRecordData(input.data)}
        visibility = input.visibility ?? current.visibility
        references = extractReferences(input.collectionDefinition, data)
      }
      if (input.operation === 'delete' && current) {
        data = requireRecordData(current.data)
        visibility = current.visibility
        references = []
      }
      if (!data || !visibility) throw moduleError('VALIDATION_FAILED', 'Record mutation data is incomplete')
      validateRecordData(input.collectionDefinition, data, visibility, true)

      const revision = current ? current.revision + 1 : 1
      const baseRevision = current?.revision ?? null
      const deleted = input.operation === 'delete'
      const now = new Date()
      const recordPayloadHash = sha256(canonicalJsonStringify(deleted ? {deleted: true} : data))
      if (current) {
        const updated = await trx
          .updateTable('greenfield_module_records')
          .set({
            data,
            visibility,
            search_text: buildSearchText(input.collectionDefinition, data),
            folder_ref: getStringField(data, input.collectionDefinition.folderField),
            source_uri: getStringField(data, 'sourceUri'),
            installation_id: current.installation_id ?? runtime.installationId,
            revision,
            updated_at: now,
            deleted_at: deleted ? now : null,
          })
          .where('account_id', '=', recordAccountId)
          .where('module_id', '=', runtime.moduleId)
          .where('collection', '=', input.collectionDefinition.collection)
          .where('record_id', '=', input.recordId)
          .where('revision', '=', current.revision)
          .executeTakeFirst()
        if (updated.numUpdatedRows !== 1n) throw moduleError('REVISION_CONFLICT', 'Module record revision conflict')
      } else {
        await trx.insertInto('greenfield_module_records').values({
          record_id: input.recordId,
          account_id: recordAccountId,
          module_id: runtime.moduleId,
          installation_id: runtime.installationId,
          collection: input.collectionDefinition.collection,
          schema_ref: input.collectionDefinition.schemaRef,
          visibility,
          data,
          search_text: buildSearchText(input.collectionDefinition, data),
          folder_ref: getStringField(data, input.collectionDefinition.folderField),
          source_uri: getStringField(data, 'sourceUri'),
          retained_after_uninstall: false,
          revision,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        }).execute()
      }

      await this.insertImmutableRevision(trx, {
        accountId: recordAccountId,
        installationId: runtime.installationId,
        moduleId: runtime.moduleId,
        recordType: input.collectionDefinition.collection,
        recordId: input.recordId,
        revision,
        baseRevision,
        operation: input.operation,
        mutationId,
        actorId: input.actor.actorId ?? null,
        data,
        visibility,
        deleted,
        payloadHash: recordPayloadHash,
        createdAt: now,
      })
      await this.replaceReferences(trx, runtime, input.collectionDefinition.collection, input.recordId, revision, references, now, recordAccountId)
      await this.insertRecordSyncChanges(trx, runtime, recordAccountId, current?.installation_id ?? runtime.installationId,
        input.collectionDefinition.collection, input.recordId, revision, input.operation, deleted, now)

      const eventId = uuidv7()
      const previous = await trx.selectFrom('greenfield_module_record_events').select('event_hash')
        .where('account_id', '=', recordAccountId)
        .where('module_id', '=', runtime.moduleId)
        .where('collection', '=', input.collectionDefinition.collection)
        .where('record_id', '=', input.recordId)
        .orderBy('revision', 'desc').executeTakeFirst()
      const eventHash = hashRecordEvent({eventId, recordId: input.recordId, moduleId: runtime.moduleId, collection: input.collectionDefinition.collection, operation: input.operation, revision, payloadHash: recordPayloadHash})
      await this.insertRecordEvent(trx, {eventId, recordId: input.recordId, accountId: recordAccountId, moduleId: runtime.moduleId, collection: input.collectionDefinition.collection, operation: input.operation, revision, previousHash: previous?.event_hash ?? null, eventHash, payloadHash: recordPayloadHash, metadata: {visibility, mutationId, baseRevision}})
      await new AuditRepository(trx).append(`module.record.${input.operation}`, {moduleId: runtime.moduleId, recordType: input.collectionDefinition.collection, revision, mutationId, eventHash}, {type: 'moduleRecord', id: input.recordId, actorId: input.actor.actorId ?? null}, {accountId: recordAccountId, requestId: input.actor.requestId})
      await this.publishGenericRecordDomainEvent(trx, {accountId: recordAccountId, moduleId: runtime.moduleId, collection: input.collectionDefinition.collection, recordId: input.recordId, operation: input.operation, revision, schemaRef: input.collectionDefinition.schemaRef, data, eventDeclarations: runtime.manifest.contributions.events ?? []})

      const result = deleted
        ? {deleted: true, recordId: input.recordId, revision}
        : await trx.selectFrom('greenfield_module_records').selectAll()
          .where('account_id', '=', recordAccountId).where('module_id', '=', runtime.moduleId)
          .where('collection', '=', input.collectionDefinition.collection).where('record_id', '=', input.recordId)
          .executeTakeFirstOrThrow()
      const storedResult = jsonValue(result)
      await trx.updateTable('greenfield_module_record_mutations').set({status: 'completed', result: storedResult, completed_at: now})
        .where('mutation_row_id', '=', reservationId).execute()
      return result
    }
    const candidate = this.db as ModulaDb & {isTransaction?: boolean}
    return candidate.isTransaction
      ? execute(this.db as unknown as Transaction<Database>)
      : this.db.transaction().execute(execute)
  }

  private async requireReadableRecord(
    accountId: string,
    moduleId: string,
    collection: string,
    recordId: string,
    includeDeleted: boolean,
  ) {
    await this.resolveRecordContext(accountId, moduleId, collection, 'read')
    const record = await this.findRecord(accountId, moduleId, collection, recordId, includeDeleted)
    if (!record) throw moduleError('NOT_FOUND', 'Module record not found')
    return record
  }

  private async canReadRecord(accountId: string, moduleId: string, collection: string, recordId: string): Promise<boolean> {
    try {
      await this.requireReadableRecord(accountId, moduleId, collection, recordId, false)
      return true
    } catch {
      return false
    }
  }

  private async validateReferenceTargets(accountId: string, references: NormalizedReference[]): Promise<void> {
    const unique = new Map(references.map(reference => [
      `${reference.record.moduleId}\u0000${reference.record.recordType}\u0000${reference.record.recordId}`,
      reference.record,
    ]))
    for (const record of unique.values()) {
      await this.requireReadableRecord(accountId, record.moduleId, record.recordType, record.recordId, false)
    }
  }

  private syncSigningKey(): string {
    if (this.config?.checkpointSigningKey) return this.config.checkpointSigningKey
    if (this.config?.sessionPepper) return this.config.sessionPepper
    if (this.config?.environment === 'production') throw moduleError('CAPABILITY_DISABLED', 'Module sync cursor signing key is not configured')
    return 'development-module-record-sync-signing-key'
  }

  private async insertImmutableRevision(
    trx: Transaction<Database>,
    input: {
      accountId: string
      installationId: string
      moduleId: string
      recordType: string
      recordId: string
      revision: number
      baseRevision: number | null
      operation: GenericRecordOperation
      mutationId: string
      actorId: string | null
      data: Record<string, unknown>
      visibility: RecordVisibility
      deleted: boolean
      payloadHash: string
      createdAt: Date
    },
  ): Promise<void> {
    const revisionId = sha256(canonicalJsonStringify({
      accountId: input.accountId,
      installationId: input.installationId,
      moduleId: input.moduleId,
      recordType: input.recordType,
      recordId: input.recordId,
      revision: input.revision,
      mutationId: input.mutationId,
      payloadHash: input.payloadHash,
    }))
    await trx.insertInto('greenfield_module_record_revisions').values({
      revision_id: revisionId,
      account_id: input.accountId,
      installation_id: input.installationId,
      module_id: input.moduleId,
      record_type: input.recordType,
      record_id: input.recordId,
      revision: input.revision,
      base_revision: input.baseRevision,
      operation: input.operation,
      mutation_id: input.mutationId,
      actor_id: input.actorId,
      data_snapshot: input.data,
      visibility: input.visibility,
      deleted: input.deleted,
      payload_hash: input.payloadHash,
      created_at: input.createdAt,
    }).execute()
  }

  private async replaceReferences(
    trx: Transaction<Database>,
    runtime: GreenfieldModuleRuntimeContext,
    recordType: string,
    recordId: string,
    revision: number,
    references: NormalizedReference[],
    createdAt: Date,
    recordAccountId = runtime.accountId,
  ): Promise<void> {
    await trx.deleteFrom('greenfield_module_record_references')
      .where('account_id', '=', recordAccountId)
      .where('source_module_id', '=', runtime.moduleId)
      .where('source_record_type', '=', recordType)
      .where('source_record_id', '=', recordId)
      .execute()
    if (references.length === 0) return
    await trx.insertInto('greenfield_module_record_references').values(references.map(reference => ({
      reference_id: uuidv7(),
      account_id: recordAccountId,
      source_installation_id: runtime.installationId,
      source_module_id: runtime.moduleId,
      source_record_type: recordType,
      source_record_id: recordId,
      source_revision: revision,
      field_path: reference.fieldPath,
      ordinal: reference.ordinal,
      target_module_id: reference.record.moduleId,
      target_record_type: reference.record.recordType,
      target_record_id: reference.record.recordId,
      created_at: createdAt,
    }))).execute()
  }

  private async insertRecordSyncChanges(
    trx: Transaction<Database>,
    runtime: GreenfieldModuleRuntimeContext,
    ownerAccountId: string,
    ownerInstallationId: string | null,
    recordType: string,
    recordId: string,
    revision: number,
    operation: GenericRecordOperation,
    deleted: boolean,
    createdAt: Date,
  ): Promise<void> {
    const audiences = new Map<string, string | null>([[ownerAccountId, ownerInstallationId]])
    const shares = await trx.selectFrom('greenfield_module_record_shares').select('recipient_account_id')
      .where('owner_account_id', '=', ownerAccountId).where('module_id', '=', runtime.moduleId)
      .where('record_type', '=', recordType).where('record_id', '=', recordId).where('revoked_at', 'is', null)
      .where(eb => eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', createdAt)])).execute()
    for (const share of shares) {
      const installation = await trx.selectFrom('greenfield_extension_installations as installation')
        .innerJoin('greenfield_module_releases as release', 'release.extension_version_id', 'installation.extension_version_id')
        .select('installation.installation_id').where('installation.account_id', '=', share.recipient_account_id)
        .where('installation.status', '=', 'enabled').where('release.module_id', '=', runtime.moduleId).executeTakeFirst()
      if (installation) audiences.set(share.recipient_account_id, installation.installation_id)
    }
    await trx.insertInto('greenfield_module_record_changes').values([...audiences].map(([accountId, installationId]) => ({
      account_id: accountId, installation_id: installationId, owner_account_id: ownerAccountId,
      module_id: runtime.moduleId, record_type: recordType, record_id: recordId, revision,
      operation, change_kind: 'record' as const, details: {}, deleted, created_at: createdAt,
    }))).execute()
  }

  private async publishGenericRecordDomainEvent(
    trx: Transaction<Database>,
    input: {
      accountId: string
      moduleId: string
      collection: string
      recordId: string
      operation: GenericRecordOperation
      revision: number
      schemaRef: string
      data: Record<string, unknown>
      eventDeclarations: Array<{eventType: string; direction: string}>
    },
  ): Promise<void> {
    const action = input.operation === 'create' ? 'created'
      : input.operation === 'update' ? 'updated'
        : input.operation === 'delete' ? 'deleted'
          : 'restored'
    const normalizedCollection = input.collection.replace(/[^a-z0-9-]+/g, '-')
    const declared = input.eventDeclarations.find(event =>
      event.direction === 'emits' && new RegExp(`\\.${normalizedCollection}\\.${action}\\.v\\d+$`).test(event.eventType),
    )
    const moduleSlug = input.moduleId.split('.').at(-1) ?? input.moduleId
    const eventType = declared?.eventType ?? `${moduleSlug}.${normalizedCollection}.${action}.v1`
    await new GreenfieldEventBus(trx).publish({
      eventType,
      aggregateType: input.collection,
      aggregateId: input.recordId,
      aggregateVersion: input.revision,
      accountId: input.accountId,
      visibility: 'account',
      classification: 'private',
      idempotencyKey: `${eventType}:${input.accountId}:${input.moduleId}:${input.collection}:${input.recordId}:${input.revision}`,
      payload: {
        record: recordIdentity(input.moduleId, input.collection, input.recordId),
        revision: input.revision,
        deleted: input.operation === 'delete',
        payloadHash: sha256(canonicalJsonStringify(input.operation === 'delete' ? {deleted: true} : input.data)),
      },
      metadata: {source: 'greenfield.module-records', schemaRef: input.schemaRef},
    })
    await this.publishCanonicalRecordChangedEvent(trx, input)
  }

  async purge(accountId: string, moduleId: string, collection: string, recordId: string, input: {confirm?: boolean; expectedRevision?: number} = {}) {
    if (!input.confirm) throw moduleError('VALIDATION_FAILED', 'Permanent deletion requires confirmation')
    const context = await this.resolveRecordContext(accountId, moduleId, collection, 'delete')
    const current = await this.findRecord(accountId, moduleId, collection, recordId, true)
    if (!current) throw moduleError('NOT_FOUND', 'Module record not found')
    if (input.expectedRevision !== undefined && current.revision !== input.expectedRevision) throw moduleError('NOTE_REVISION_CONFLICT', 'Module record revision conflict')
    const nextRevision = current.revision + 1
    const payloadHash = sha256(canonicalJsonStringify({purged: true}))
    const eventId = uuidv7()
    const previous = await this.db
      .selectFrom('greenfield_module_record_events')
      .select('event_hash')
      .where('record_id', '=', current.record_id)
      .orderBy('revision', 'desc')
      .executeTakeFirst()
    const eventHash = hashRecordEvent({eventId, recordId: current.record_id, moduleId: context.runtime.moduleId, collection: current.collection, operation: 'purge', revision: nextRevision, payloadHash})
    await this.db.transaction().execute(async trx => {
      await this.insertRecordVersion(trx, current, nextRevision, 'delete')
      await trx
        .deleteFrom('greenfield_module_records')
        .where('record_id', '=', current.record_id)
        .where('account_id', '=', context.runtime.accountId)
        .where('module_id', '=', context.runtime.moduleId)
        .execute()
      await this.insertRecordEvent(trx, {eventId, recordId: current.record_id, accountId: context.runtime.accountId, moduleId: context.runtime.moduleId, collection: current.collection, operation: 'purge', revision: nextRevision, previousHash: previous?.event_hash ?? null, eventHash, payloadHash, metadata: {purged: true}})
      await new AuditRepository(trx).append('module.record.purged', {moduleId: context.runtime.moduleId, collection: current.collection, eventHash}, {type: 'moduleRecord', id: current.record_id})
      await this.publishRecordDomainEvent(trx, {accountId: context.runtime.accountId, moduleId: context.runtime.moduleId, collection: current.collection, recordId: current.record_id, operation: 'purge', revision: nextRevision, schemaRef: context.collectionDefinition.schemaRef, data: current.data as Record<string, unknown>, previousData: current.data as Record<string, unknown>, eventDeclarations: context.runtime.manifest.contributions.events ?? []})
    })
    return {purged: true, recordId: current.record_id, revision: nextRevision}
  }

  private async resolveRecordContext(accountId: string, moduleId: string, collection: string, operation: 'read' | 'write' | 'delete') {
    if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(collection)) throw moduleError('VALIDATION_FAILED', 'Invalid module collection')
    const canonicalId = resolveCanonicalModuleId(moduleId)
    await new GreenfieldModuleIdentityMigrationService(this.db).normalizeAccount(accountId)
    const runtime = await this.access.resolve(accountId, canonicalId, {requireEnabled: true})
    this.access.enforceCapability(runtime, collectionPermission(canonicalId, collection, operation))
    const collectionDefinition = (await this.views.collectionsForRelease(runtime)).find(item => item.collection === collection)
    if (!collectionDefinition) throw moduleError('FORBIDDEN', 'Module collection is not declared')
    return {runtime, collectionDefinition}
  }

  private async updateExisting(
    context: GreenfieldModuleRuntimeContext,
    collectionDefinition: GreenfieldModuleCollectionDefinition,
    current: {record_id: string; account_id: string; module_id: string; collection: string; revision: number; data: unknown; visibility: string},
    data: Record<string, unknown>,
    visibility: 'private' | 'teams' | 'followers' | 'public' | 'system',
    operation: ModuleRecordOperation,
    changeSource: ModuleRecordVersionChangeSource = operation === 'restore' ? 'restore' : operation === 'delete' ? 'delete' : 'update',
    versionMetadata: Record<string, unknown> = {},
    references: NormalizedReference[] = [],
    actor: MutationActor = {},
  ) {
    const nextRevision = current.revision + 1
    const now = new Date()
    const payloadHash = sha256(canonicalJsonStringify(operation === 'delete' ? {deleted: true} : data))
    const eventId = uuidv7()
    const previous = await this.db
      .selectFrom('greenfield_module_record_events')
      .select('event_hash')
      .where('record_id', '=', current.record_id)
      .orderBy('revision', 'desc')
      .executeTakeFirst()
    const eventHash = hashRecordEvent({eventId, recordId: current.record_id, moduleId: context.moduleId, collection: current.collection, operation, revision: nextRevision, payloadHash})
    await this.db.transaction().execute(async trx => {
      if (operation === 'update' || operation === 'restore') await this.insertRecordVersion(trx, current, nextRevision, changeSource, versionMetadata)
      await trx
        .updateTable('greenfield_module_records')
        .set({
          data,
          visibility,
          search_text: buildSearchText(collectionDefinition, data),
          folder_ref: getStringField(data, collectionDefinition.folderField),
          source_uri: getStringField(data, 'sourceUri'),
          installation_id: context.installationId,
          revision: nextRevision,
          updated_at: now,
          deleted_at: operation === 'delete' ? now : operation === 'restore' ? null : undefined,
        })
        .where('record_id', '=', current.record_id)
        .where('account_id', '=', context.accountId)
        .where('module_id', '=', context.moduleId)
        .execute()
      await this.insertRecordEvent(trx, {eventId, recordId: current.record_id, accountId: context.accountId, moduleId: context.moduleId, collection: current.collection, operation, revision: nextRevision, previousHash: previous?.event_hash ?? null, eventHash, payloadHash, metadata: {visibility, changeSource, provenance: redactedVersionMetadata(versionMetadata)}})
      if (operation !== 'purge') {
        await this.insertImmutableRevision(trx, {
          accountId: context.accountId,
          installationId: context.installationId,
          moduleId: context.moduleId,
          recordType: current.collection,
          recordId: current.record_id,
          revision: nextRevision,
          baseRevision: current.revision,
          operation,
          mutationId: `legacy:${eventId}`,
          actorId: actor.actorId ?? null,
          data,
          visibility,
          deleted: operation === 'delete',
          payloadHash,
          createdAt: now,
        })
        await this.replaceReferences(trx, context, current.collection, current.record_id, nextRevision, references, now)
        await trx.insertInto('greenfield_module_record_changes').values({
          account_id: context.accountId,
          installation_id: context.installationId,
          module_id: context.moduleId,
          record_type: current.collection,
          record_id: current.record_id,
          revision: nextRevision,
          operation,
          deleted: operation === 'delete',
          created_at: now,
        }).execute()
      }
      await new AuditRepository(trx).append(`module.record.${operation === 'delete' ? 'deleted' : 'updated'}`, {moduleId: context.moduleId, collection: current.collection, eventHash}, {type: 'moduleRecord', id: current.record_id})
      await this.publishRecordDomainEvent(trx, {accountId: context.accountId, moduleId: context.moduleId, collection: current.collection, recordId: current.record_id, operation, revision: nextRevision, schemaRef: collectionDefinition.schemaRef, data, previousData: current.data as Record<string, unknown>, eventDeclarations: context.manifest.contributions.events ?? []})
    })
    return operation === 'delete' ? {deleted: true, recordId: current.record_id, revision: nextRevision} : this.get(context.accountId, context.moduleId, current.collection, current.record_id)
  }

  private async insertRecordEvent(
    trx: any,
    input: {
      eventId: string
      recordId: string
      accountId: string
      moduleId: string
      collection: string
      operation: ModuleRecordOperation
      revision: number
      previousHash: string | null
      eventHash: string
      payloadHash: string
      metadata: Record<string, unknown>
    },
  ) {
    await trx
      .insertInto('greenfield_module_record_events')
      .values({
        event_id: input.eventId,
        record_id: input.recordId,
        account_id: input.accountId,
        module_id: input.moduleId,
        collection: input.collection,
        operation: input.operation,
        revision: input.revision,
        previous_hash: input.previousHash,
        event_hash: input.eventHash,
        payload_hash: input.payloadHash,
        metadata: input.metadata,
        created_at: new Date(),
      })
      .execute()
  }

  private async insertRecordVersion(trx: any, current: {record_id: string; account_id: string; module_id: string; collection: string; revision: number; data: unknown}, nextRevision: number, changeSource: ModuleRecordVersionChangeSource, metadata: Record<string, unknown> = {}) {
    await trx
      .insertInto('greenfield_module_record_versions')
      .values({
        version_id: uuidv7(),
        record_id: current.record_id,
        account_id: current.account_id,
        module_id: current.module_id,
        collection: current.collection,
        revision: current.revision,
        next_revision: nextRevision,
        data_snapshot: current.data,
        payload_hash: sha256(canonicalJsonStringify(current.data)),
        change_source: changeSource,
        metadata,
        created_at: new Date(),
      })
      .execute()
    await sql`
      DELETE FROM greenfield_module_record_versions
      WHERE version_id IN (
        SELECT version_id FROM (
          SELECT version_id, row_number() OVER (PARTITION BY account_id, module_id, collection, record_id ORDER BY revision DESC) AS rn
          FROM greenfield_module_record_versions
          WHERE account_id = ${current.account_id}
            AND module_id = ${current.module_id}
            AND collection = ${current.collection}
            AND record_id = ${current.record_id}
        ) ranked
        WHERE rn > 25
      )
    `.execute(trx)
  }

  private async publishRecordDomainEvent(
    trx: any,
    input: {
      accountId: string
      moduleId: string
      collection: string
      recordId: string
      operation: ModuleRecordOperation
      revision: number
      schemaRef: string
      data: Record<string, unknown>
      previousData: Record<string, unknown> | null
      eventDeclarations: Array<{eventType: string; direction: string}>
    },
  ) {
    const eventType = moduleRecordEventType(input.moduleId, input.collection, input.operation, input.data, input.previousData, input.eventDeclarations)
    await new GreenfieldEventBus(trx).publish({
      eventType,
      aggregateType: input.collection === 'folder' ? 'vault-folder' : input.collection,
      aggregateId: input.recordId,
      aggregateVersion: input.revision,
      accountId: input.accountId,
      visibility: 'account',
      classification: input.operation === 'purge' ? 'sensitive' : 'private',
      idempotencyKey: `${eventType}:${input.accountId}:${input.moduleId}:${input.collection}:${input.recordId}:${input.revision}`,
      payload: redactedRecordEventPayload(input),
      metadata: {source: 'greenfield.module-records', schemaRef: input.schemaRef},
    })
    await this.publishCanonicalRecordChangedEvent(trx, input)
  }

  /**
   * Product events remain part of the module contract. Search and other
   * platform projections consume this stable, product-neutral companion event
   * so a normal module never needs a product-ID subscription.
   */
  private async publishCanonicalRecordChangedEvent(
    trx: Transaction<Database>,
    input: {
      accountId: string
      moduleId: string
      collection: string
      recordId: string
      operation: ModuleRecordOperation
      revision: number
      schemaRef: string
    },
  ): Promise<void> {
    await new GreenfieldEventBus(trx).publish({
      eventType: 'module.record.changed',
      aggregateType: 'moduleRecord',
      aggregateId: input.recordId,
      aggregateVersion: input.revision,
      accountId: input.accountId,
      visibility: 'account',
      classification: input.operation === 'purge' ? 'sensitive' : 'private',
      idempotencyKey: `module.record.changed:${input.accountId}:${input.moduleId}:${input.collection}:${input.recordId}:${input.revision}`,
      payload: {
        moduleId: input.moduleId,
        recordType: input.collection,
        recordId: input.recordId,
        revision: input.revision,
        sourceVersion: input.revision,
        operation: input.operation,
        deleted: input.operation === 'delete' || input.operation === 'purge',
      },
      metadata: {source: 'greenfield.module-records', schemaRef: input.schemaRef},
    })
  }
}

function validateRecordData(
  definition: GreenfieldModuleCollectionDefinition,
  data: Record<string, unknown>,
  visibility: string,
  strictReferences = false,
): void {
  if (visibility === 'public' && definition.defaultVisibility === 'private') throw moduleError('FORBIDDEN', 'Collection is private by default and cannot publish records')
  const fieldsByName = new Map(definition.fields.map(field => [field.name, field]))
  for (const field of definition.fields) {
    const value = data[field.name]
    if (field.required && (value === undefined || value === null || value === '')) throw moduleError('VALIDATION_FAILED', `Missing required field ${field.name}`)
    if (value !== undefined && value !== null) validateFieldValue(field, value, strictReferences)
  }
  if (fieldsByName.size > 0) {
    for (const key of Object.keys(data)) {
      if (!fieldsByName.has(key)) throw moduleError('VALIDATION_FAILED', `Unknown field ${key}`)
    }
  }
}

function validateFieldValue(field: GreenfieldModuleFieldDefinition, value: unknown, strictReferences: boolean): void {
  if (field.sensitive || field.secretRefRequired) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || typeof (value as {secretRef?: unknown}).secretRef !== 'string') {
      throw moduleError('VALIDATION_FAILED', `Sensitive field ${field.name} must use a secret reference`)
    }
    return
  }
  if (field.type === 'recordReference') {
    if (!strictReferences && typeof value === 'string') return
    const values = Array.isArray(value) ? value : [value]
    if (values.length === 0 || !values.every(item => parseRecordReference(item) !== null)) {
      throw moduleError('VALIDATION_FAILED', `Field ${field.name} must use a structured record reference`)
    }
    return
  }
  if (['text', 'multilineText', 'url', 'assetReference', 'date', 'dateTime'].includes(field.type) && typeof value !== 'string') {
    throw moduleError('VALIDATION_FAILED', `Field ${field.name} must be text`)
  }
  if (field.type === 'number' && typeof value !== 'number') throw moduleError('VALIDATION_FAILED', `Field ${field.name} must be numeric`)
  if (field.type === 'boolean' && typeof value !== 'boolean') throw moduleError('VALIDATION_FAILED', `Field ${field.name} must be boolean`)
  if (field.type === 'singleSelect' && typeof value !== 'string') throw moduleError('VALIDATION_FAILED', `Field ${field.name} must be a selection`)
  if ((field.type === 'multiSelect' || field.type === 'tags') && (!Array.isArray(value) || !value.every(item => typeof item === 'string'))) {
    throw moduleError('VALIDATION_FAILED', `Field ${field.name} must be a string array`)
  }
  if (field.type === 'json') validateJsonField(field.name, value)
  if (field.type === 'richText') validateJsonField(field.name, value)
}

function extractReferences(definition: GreenfieldModuleCollectionDefinition, data: Record<string, unknown>): NormalizedReference[] {
  const referenceFields = new Set([
    ...definition.fields.filter(field => field.type === 'recordReference').map(field => field.name),
    ...(definition.referenceFields ?? []),
  ])
  const references: NormalizedReference[] = []
  for (const fieldPath of referenceFields) {
    const value = data[fieldPath]
    if (value === undefined || value === null || value === '') continue
    const values = Array.isArray(value) ? value : [value]
    values.forEach((candidate, ordinal) => {
      const record = parseRecordReference(candidate)
      if (record) references.push({fieldPath, ordinal, record})
    })
  }
  return references
}

function parseRecordReference(value: unknown): RecordIdentity | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const outer = value as {record?: unknown}
  if (!outer.record || typeof outer.record !== 'object' || Array.isArray(outer.record)) return null
  const record = outer.record as {moduleId?: unknown; recordType?: unknown; recordId?: unknown}
  if (typeof record.moduleId !== 'string' || typeof record.recordType !== 'string' || typeof record.recordId !== 'string') return null
  if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(record.recordType) || record.recordId.length === 0 || record.recordId.length > 512) return null
  try {
    return {moduleId: resolveCanonicalModuleId(record.moduleId), recordType: record.recordType, recordId: record.recordId}
  } catch {
    return null
  }
}

function recordIdentity(moduleId: string, recordType: string, recordId: string): RecordIdentity {
  return {moduleId: resolveCanonicalModuleId(moduleId), recordType, recordId}
}

function serializeRevisionMetadata(row: {
  revision_id: string
  module_id: string
  record_type: string
  record_id: string
  revision: number
  base_revision: number | null
  operation: string
  mutation_id: string | null
  actor_id: string | null
  deleted: boolean
  payload_hash: string
  created_at: Date
}) {
  return {
    revisionId: row.revision_id,
    record: recordIdentity(row.module_id, row.record_type, row.record_id),
    revision: row.revision,
    baseRevision: row.base_revision,
    operation: row.operation,
    mutationId: row.mutation_id,
    actorId: row.actor_id,
    deleted: row.deleted,
    payloadHash: row.payload_hash,
    changedAt: row.created_at.toISOString(),
  }
}

function requireExpectedRevision(value: unknown): asserts value is number {
  if (!Number.isInteger(value) || Number(value) < 1) throw moduleError('VALIDATION_FAILED', 'expectedRevision is required')
}

function requireMutationId(value: unknown): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
    throw moduleError('VALIDATION_FAILED', 'Invalid mutationId')
  }
  return value
}

function jsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

type SyncCursorClaims = {v: 1; accountId: string; installationId: string; moduleId: string; sequence: string}

function encodeSyncCursor(runtime: GreenfieldModuleRuntimeContext, sequence: string, key: string): string {
  const claims: SyncCursorClaims = {
    v: 1,
    accountId: runtime.accountId,
    installationId: runtime.installationId,
    moduleId: runtime.moduleId,
    sequence,
  }
  const body = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url')
  const signature = createHmac('sha256', key).update(body).digest('base64url')
  return `${body}.${signature}`
}

function decodeSyncCursor(value: string, runtime: GreenfieldModuleRuntimeContext, key: string): string {
  const [body, signature, extra] = value.split('.')
  if (!body || !signature || extra) throw moduleError('INVALID_CURSOR', 'Invalid sync cursor')
  const expected = createHmac('sha256', key).update(body).digest()
  let actual: Buffer
  try {
    actual = Buffer.from(signature, 'base64url')
  } catch {
    throw moduleError('INVALID_CURSOR', 'Invalid sync cursor')
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw moduleError('INVALID_CURSOR', 'Invalid sync cursor')
  let claims: SyncCursorClaims
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SyncCursorClaims
  } catch {
    throw moduleError('INVALID_CURSOR', 'Invalid sync cursor')
  }
  if (
    claims.v !== 1
    || claims.accountId !== runtime.accountId
    || claims.installationId !== runtime.installationId
    || claims.moduleId !== runtime.moduleId
    || !/^\d+$/.test(claims.sequence)
  ) throw moduleError('INVALID_CURSOR', 'Sync cursor does not match this installation scope')
  return claims.sequence
}

function requireRecordData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw moduleError('VALIDATION_FAILED', 'Record data must be an object')
  return value as Record<string, unknown>
}

function normalizeVisibility(value: string): 'private' | 'teams' | 'followers' | 'public' | 'system' {
  if (value === 'private' || value === 'teams' || value === 'followers' || value === 'public' || value === 'system') return value
  throw moduleError('VALIDATION_FAILED', 'Unsupported module record visibility')
}

function buildSearchText(definition: GreenfieldModuleCollectionDefinition, data: Record<string, unknown>): string {
  return definition.searchableFields
    .map(field => data[field])
    .flatMap(value => (Array.isArray(value) ? value : [value]))
    .filter(value => typeof value === 'string')
    .join(' ')
    .slice(0, 20_000)
}

function getStringField(data: Record<string, unknown>, field?: string): string | null {
  if (!field) return null
  const value = data[field]
  return typeof value === 'string' && value.length ? value : null
}

function clampLimit(value: unknown, fallback: number): number {
  const parsed = Number(value ?? fallback)
  if (!Number.isInteger(parsed) || parsed < 1) throw moduleError('VALIDATION_FAILED', 'Invalid pagination limit')
  return Math.min(parsed, 100)
}

function parseCursor(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) throw moduleError('VALIDATION_FAILED', 'Invalid pagination cursor')
  return parsed
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function hashRecordEvent(input: {eventId: string; recordId: string; moduleId: string; collection: string; operation: string; revision: number; payloadHash: string}): string {
  return sha256(canonicalJsonStringify(input))
}

function validateJsonField(fieldName: string, value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw moduleError('VALIDATION_FAILED', `Field ${fieldName} must be a JSON object`)
  const serialized = JSON.stringify(value)
  if (serialized.length > 250_000) throw moduleError('VALIDATION_FAILED', `Field ${fieldName} exceeds JSON size limit`)
  if (jsonDepth(value) > 12) throw moduleError('VALIDATION_FAILED', `Field ${fieldName} exceeds JSON nesting limit`)
}

function jsonDepth(value: unknown, level = 0): number {
  if (!value || typeof value !== 'object') return level
  return Math.max(level, ...Object.values(value as Record<string, unknown>).map(child => jsonDepth(child, level + 1)))
}

function moduleRecordEventType(
  moduleId: string,
  collection: string,
  operation: ModuleRecordOperation,
  data: Record<string, unknown>,
  previousData: Record<string, unknown> | null,
  declarations: Array<{eventType: string; direction: string}> = [],
): string {
  const moduleSlug = moduleId.split('.').at(-1) ?? moduleId
  const normalizedCollection = collection.replace(/[^a-z0-9-]+/g, '-')
  let action = operation === 'create' ? 'created' : operation === 'delete' ? 'deleted' : operation === 'restore' ? 'restored' : operation === 'purge' ? 'permanently-deleted' : 'updated'
  if (collection === 'note' && previousData) {
    if (previousData.archived !== true && data.archived === true) action = 'archived'
    if (previousData.archived === true && data.archived !== true) action = 'unarchived'
  }
  const declaredCollection = collection === 'folder' ? 'collection' : normalizedCollection
  const declared = declarations.find(event => event.direction === 'emits' && new RegExp(`\\.${declaredCollection}\\.${action}\\.v\\d+$`).test(event.eventType))
  return declared?.eventType ?? `${moduleSlug}.${normalizedCollection}.${action}.v1`
}

function redactedRecordEventPayload(input: {
  moduleId: string
  collection: string
  recordId: string
  operation: ModuleRecordOperation
  revision: number
  schemaRef: string
  data: Record<string, unknown>
}) {
  return {
    moduleId: input.moduleId,
    collection: input.collection,
    recordId: input.recordId,
    revision: input.revision,
    sourceVersion: input.revision,
    schemaRef: input.schemaRef,
    titleLength: typeof input.data.title === 'string' ? input.data.title.length : undefined,
    tagCount: Array.isArray(input.data.tagIds) ? input.data.tagIds.length : undefined,
    folderId: typeof input.data.folderId === 'string' ? input.data.folderId : undefined,
    archived: typeof input.data.archived === 'boolean' ? input.data.archived : undefined,
    deleted: input.operation === 'delete' || input.operation === 'purge',
    payloadHash: sha256(canonicalJsonStringify(input.operation === 'purge' ? {purged: true} : input.data)),
  }
}

function redactedVersionMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const allowed = ['aiExecutionId', 'aiActionId', 'promptId', 'promptVersion', 'changeSource']
  return Object.fromEntries(
    allowed
      .filter(key => typeof metadata[key] === 'string')
      .map(key => [key, metadata[key]]),
  )
}
