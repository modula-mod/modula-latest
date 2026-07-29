import {createHash} from 'node:crypto'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import type {GreenfieldModuleCollectionDefinition, GreenfieldModuleFieldDefinition} from '@modula/greenfield-module-ui-contracts'
import {sql} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {GreenfieldEventBus} from '../events/index.js'
import {uuidv7} from '../lib/uuidv7.js'
import {moduleError} from './module-errors.js'
import {collectionPermission, GreenfieldModuleRuntimeAccessService, type GreenfieldModuleRuntimeContext} from './runtime-access.js'
import {GreenfieldModuleViewService} from './view-service.js'

type ModuleRecordOperation = 'create' | 'update' | 'delete' | 'restore' | 'purge'

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
}

export class GreenfieldModuleRecordService {
  private readonly access: GreenfieldModuleRuntimeAccessService
  private readonly views: GreenfieldModuleViewService

  constructor(private readonly db: ModulaDb) {
    this.access = new GreenfieldModuleRuntimeAccessService(db)
    this.views = new GreenfieldModuleViewService(db)
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
      .where('module_id', '=', moduleId)
      .where('collection', '=', collection)
      .where('deleted_at', 'is', null)

    for (const [field, value] of Object.entries(filters)) {
      query = query.where(sql`greenfield_module_records.data ->> ${field}`, '=', String(value)) as typeof query
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
      .where('module_id', '=', moduleId)
      .where('collection', '=', collection)
      .where('record_id', '=', recordId)
    if (!includeDeleted) query = query.where('deleted_at', 'is', null) as typeof query
    return query.executeTakeFirst()
  }

  async create(accountId: string, moduleId: string, collection: string, input: {data?: unknown; visibility?: string; recordId?: string}) {
    const context = await this.resolveRecordContext(accountId, moduleId, collection, 'write')
    const data = requireRecordData(input.data)
    const visibility = normalizeVisibility(input.visibility ?? context.collectionDefinition.defaultVisibility)
    validateRecordData(context.collectionDefinition, data, visibility)
    const recordId = input.recordId ?? uuidv7()
    const now = new Date()
    const searchText = buildSearchText(context.collectionDefinition, data)
    const folderRef = getStringField(data, context.collectionDefinition.folderField)
    const sourceUri = getStringField(data, 'sourceUri')
    const payloadHash = sha256(canonicalJsonStringify(data))
    const eventId = uuidv7()
    const eventHash = hashRecordEvent({eventId, recordId, moduleId, collection, operation: 'create', revision: 1, payloadHash})
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_module_records')
        .values({
          record_id: recordId,
          account_id: accountId,
          module_id: moduleId,
          installation_id: context.runtime.installationId,
          collection,
          schema_ref: context.collectionDefinition.schemaRef,
          visibility,
          data,
          search_text: searchText,
          folder_ref: folderRef,
          source_uri: sourceUri,
          retained_after_uninstall: false,
          revision: 1,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        })
        .execute()
      await this.insertRecordEvent(trx, {eventId, recordId, accountId, moduleId, collection, operation: 'create', revision: 1, previousHash: null, eventHash, payloadHash, metadata: {visibility}})
      await new AuditRepository(trx).append('module.record.created', {moduleId, collection, visibility, eventHash}, {type: 'moduleRecord', id: recordId})
      await this.publishRecordDomainEvent(trx, {accountId, moduleId, collection, recordId, operation: 'create', revision: 1, schemaRef: context.collectionDefinition.schemaRef, data, previousData: null})
    })
    return this.get(accountId, moduleId, collection, recordId)
  }

  async patch(accountId: string, moduleId: string, collection: string, recordId: string, input: {data?: unknown; expectedRevision?: number; visibility?: string}) {
    const context = await this.resolveRecordContext(accountId, moduleId, collection, 'write')
    const current = await this.get(accountId, moduleId, collection, recordId)
    if (input.expectedRevision !== undefined && current.revision !== input.expectedRevision) throw moduleError('NOTE_REVISION_CONFLICT', 'Module record revision conflict')
    const data = {...(current.data as Record<string, unknown>), ...requireRecordData(input.data)}
    const visibility = normalizeVisibility(input.visibility ?? current.visibility)
    validateRecordData(context.collectionDefinition, data, visibility)
    return this.updateExisting(context.runtime, context.collectionDefinition, current, data, visibility, 'update')
  }

  async delete(accountId: string, moduleId: string, collection: string, recordId: string, input: {expectedRevision?: number} = {}) {
    const context = await this.resolveRecordContext(accountId, moduleId, collection, 'delete')
    const current = await this.get(accountId, moduleId, collection, recordId)
    if (input.expectedRevision !== undefined && current.revision !== input.expectedRevision) throw moduleError('NOTE_REVISION_CONFLICT', 'Module record revision conflict')
    return this.updateExisting(context.runtime, context.collectionDefinition, current, current.data as Record<string, unknown>, current.visibility, 'delete')
  }

  async restore(accountId: string, moduleId: string, collection: string, recordId: string, input: {expectedRevision?: number} = {}) {
    const context = await this.resolveRecordContext(accountId, moduleId, collection, 'write')
    const current = await this.findRecord(accountId, moduleId, collection, recordId, true)
    if (!current) throw moduleError('NOT_FOUND', 'Module record not found')
    if (input.expectedRevision !== undefined && current.revision !== input.expectedRevision) throw moduleError('NOTE_REVISION_CONFLICT', 'Module record revision conflict')
    return this.updateExisting(context.runtime, context.collectionDefinition, current, current.data as Record<string, unknown>, current.visibility, 'restore')
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
      await this.publishRecordDomainEvent(trx, {accountId: context.runtime.accountId, moduleId: context.runtime.moduleId, collection: current.collection, recordId: current.record_id, operation: 'purge', revision: nextRevision, schemaRef: context.collectionDefinition.schemaRef, data: current.data as Record<string, unknown>, previousData: current.data as Record<string, unknown>})
    })
    return {purged: true, recordId: current.record_id, revision: nextRevision}
  }

  private async resolveRecordContext(accountId: string, moduleId: string, collection: string, operation: 'read' | 'write' | 'delete') {
    if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(collection)) throw moduleError('VALIDATION_FAILED', 'Invalid module collection')
    const runtime = await this.access.resolve(accountId, moduleId, {requireEnabled: true})
    this.access.enforceCapability(runtime, collectionPermission(moduleId, collection, operation))
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
      if (operation === 'update' || operation === 'restore') await this.insertRecordVersion(trx, current, nextRevision, operation)
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
      await this.insertRecordEvent(trx, {eventId, recordId: current.record_id, accountId: context.accountId, moduleId: context.moduleId, collection: current.collection, operation, revision: nextRevision, previousHash: previous?.event_hash ?? null, eventHash, payloadHash, metadata: {visibility}})
      await new AuditRepository(trx).append(`module.record.${operation === 'delete' ? 'deleted' : 'updated'}`, {moduleId: context.moduleId, collection: current.collection, eventHash}, {type: 'moduleRecord', id: current.record_id})
      await this.publishRecordDomainEvent(trx, {accountId: context.accountId, moduleId: context.moduleId, collection: current.collection, recordId: current.record_id, operation, revision: nextRevision, schemaRef: collectionDefinition.schemaRef, data, previousData: current.data as Record<string, unknown>})
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

  private async insertRecordVersion(trx: any, current: {record_id: string; account_id: string; module_id: string; collection: string; revision: number; data: unknown}, nextRevision: number, changeSource: string) {
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
    },
  ) {
    const eventType = moduleRecordEventType(input.moduleId, input.collection, input.operation, input.data, input.previousData)
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
  }
}

function validateRecordData(definition: GreenfieldModuleCollectionDefinition, data: Record<string, unknown>, visibility: string): void {
  if (visibility === 'public' && definition.defaultVisibility === 'private') throw moduleError('FORBIDDEN', 'Collection is private by default and cannot publish records')
  const fieldsByName = new Map(definition.fields.map(field => [field.name, field]))
  for (const field of definition.fields) {
    const value = data[field.name]
    if (field.required && (value === undefined || value === null || value === '')) throw moduleError('VALIDATION_FAILED', `Missing required field ${field.name}`)
    if (value !== undefined && value !== null) validateFieldValue(field, value)
  }
  if (fieldsByName.size > 0) {
    for (const key of Object.keys(data)) {
      if (!fieldsByName.has(key)) throw moduleError('VALIDATION_FAILED', `Unknown field ${key}`)
    }
  }
}

function validateFieldValue(field: GreenfieldModuleFieldDefinition, value: unknown): void {
  if (field.sensitive || field.secretRefRequired) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || typeof (value as {secretRef?: unknown}).secretRef !== 'string') {
      throw moduleError('VALIDATION_FAILED', `Sensitive field ${field.name} must use a secret reference`)
    }
    return
  }
  if (['text', 'multilineText', 'url', 'recordReference', 'date', 'dateTime'].includes(field.type) && typeof value !== 'string') {
    throw moduleError('VALIDATION_FAILED', `Field ${field.name} must be text`)
  }
  if (field.type === 'number' && typeof value !== 'number') throw moduleError('VALIDATION_FAILED', `Field ${field.name} must be numeric`)
  if (field.type === 'boolean' && typeof value !== 'boolean') throw moduleError('VALIDATION_FAILED', `Field ${field.name} must be boolean`)
  if (field.type === 'singleSelect' && typeof value !== 'string') throw moduleError('VALIDATION_FAILED', `Field ${field.name} must be a selection`)
  if ((field.type === 'multiSelect' || field.type === 'tags') && (!Array.isArray(value) || !value.every(item => typeof item === 'string'))) {
    throw moduleError('VALIDATION_FAILED', `Field ${field.name} must be a string array`)
  }
  if (field.type === 'json') validateJsonField(field.name, value)
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
): string {
  const moduleSlug = moduleId.split('.').at(-1) ?? moduleId
  const normalizedCollection = collection.replace(/[^a-z0-9-]+/g, '-')
  if (operation === 'create') return `${moduleSlug}.${normalizedCollection}.created`
  if (operation === 'delete') return `${moduleSlug}.${normalizedCollection}.deleted`
  if (operation === 'restore') return `${moduleSlug}.${normalizedCollection}.restored`
  if (operation === 'purge') return `${moduleSlug}.${normalizedCollection}.permanently-deleted`
  if (collection === 'note' && previousData) {
    if (previousData.archived !== true && data.archived === true) return `${moduleSlug}.${normalizedCollection}.archived`
    if (previousData.archived === true && data.archived !== true) return `${moduleSlug}.${normalizedCollection}.unarchived`
  }
  return `${moduleSlug}.${normalizedCollection}.updated`
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
