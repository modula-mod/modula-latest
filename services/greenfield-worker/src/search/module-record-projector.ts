import type {GreenfieldSearchDocument} from '@modula/greenfield-contracts'
import type {ModulaWorkerDb} from '../database.js'
import {SearchProjector, type SearchProjectionContext} from './projector.js'

export async function projectModuleRecord(db: ModulaWorkerDb, projector: SearchProjector, context: SearchProjectionContext): Promise<void> {
  const identity = identityFromEvent(context)
  const entityId = moduleRecordEntityId(context.event.accountId ?? '', identity)
  const row = context.event.accountId
    ? await db.selectFrom('greenfield_module_records')
      .selectAll()
      .where('account_id', '=', context.event.accountId)
      .where('module_id', '=', identity.moduleId)
      .where('collection', '=', identity.recordType)
      .where('record_id', '=', identity.recordId)
      .executeTakeFirst()
    : undefined

  if (!row || row.deleted_at || isDeleteEvent(context.event.eventType, context.event.payload)) {
    await projector.tombstone({...context, entityId}, {
      sourceVersion: projector.sourceVersionFor(context, Number(context.event.payload?.sourceVersion ?? Date.now())),
      accountId: context.event.accountId ?? row?.account_id,
      visibility: 'account',
      status: 'deleted',
      updatedAt: row?.updated_at,
    })
    return
  }

  const declaration = await db.selectFrom('greenfield_module_record_collections')
    .select(['fields', 'searchable_fields', 'filterable_fields'])
    .where('module_id', '=', row.module_id)
    .where('collection', '=', row.collection)
    .where('schema_ref', '=', row.schema_ref)
    .where('registration_status', 'not in', ['quarantined', 'revoked'])
    .orderBy('updated_at', 'desc')
    .executeTakeFirst()
  const safeFields = nonSensitiveFieldNames(declaration?.fields)
  const searchableFields = stringArray(declaration?.searchable_fields).filter(field => safeFields.has(field))
  const metadataFields = stringArray(declaration?.filterable_fields).filter(field => safeFields.has(field))
  if (!declaration || searchableFields.length === 0) {
    await projector.tombstone({...context, entityId}, {
      sourceVersion: projector.sourceVersionFor(context, row.revision),
      accountId: row.account_id,
      visibility: 'account',
      status: 'hidden',
      updatedAt: row.updated_at,
    })
    return
  }
  const data = record(row.data)
  const title = firstDisplayValue(data, searchableFields)
  const tags = searchableFields.flatMap(field => stringArray(data[field])).slice(0, 100)
  const metadataValues = Object.fromEntries(metadataFields.flatMap(field => scalar(data[field]) === undefined ? [] : [[field, scalar(data[field])]]))
  const document: GreenfieldSearchDocument = {
    documentId: `module-record:${entityId}`,
    schemaVersion: '1.0.0',
    entityType: 'module-record',
    entityId,
    sourceVersion: projector.sourceVersionFor(context, row.revision),
    accountId: row.account_id,
    title,
    body: searchTextFromFields(data, searchableFields) || undefined,
    keywords: [row.module_id, row.collection],
    tags,
    // Current record/share evaluation is authoritative; the projection never
    // turns a record into a public resource by itself.
    visibility: 'account',
    status: 'active',
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    indexedAt: new Date().toISOString(),
    metadata: {
      kind: 'module-record',
      moduleId: row.module_id,
      recordType: row.collection,
      recordId: row.record_id,
      display: metadataValues,
    },
  }
  await projector.upsert({...context, entityId}, document)
}

export function moduleRecordEntityId(accountId: string, identity: {moduleId: string; recordType: string; recordId: string}): string {
  return Buffer.from(JSON.stringify([accountId, identity.moduleId, identity.recordType, identity.recordId]), 'utf8').toString('base64url')
}

function identityFromEvent(context: SearchProjectionContext): {moduleId: string; recordType: string; recordId: string} {
  const payload = context.event.payload ?? {}
  const nested = record(payload.record)
  const moduleId = typeof payload.moduleId === 'string' ? payload.moduleId : typeof nested.moduleId === 'string' ? nested.moduleId : ''
  const recordType = typeof payload.collection === 'string'
    ? payload.collection
    : typeof payload.recordType === 'string'
      ? payload.recordType
      : typeof nested.recordType === 'string'
        ? nested.recordType
        : context.event.aggregateType
  const recordId = typeof payload.recordId === 'string' ? payload.recordId : typeof nested.recordId === 'string' ? nested.recordId : context.event.aggregateId
  if (!moduleId || !recordType || !recordId) throw new Error('Generic module record projection requires moduleId, recordType, and recordId')
  return {moduleId, recordType, recordId}
}

function isDeleteEvent(eventType: string, payload: Record<string, unknown>): boolean {
  return payload.deleted === true || eventType.includes('.deleted') || eventType.includes('.permanently-deleted') || eventType.includes('.purged')
}

function firstDisplayValue(data: Record<string, unknown>, fields: string[]): string | undefined {
  for (const preferred of ['title', 'name']) if (fields.includes(preferred) && typeof data[preferred] === 'string') return String(data[preferred])
  return fields.map(field => data[field]).find((value): value is string => typeof value === 'string')
}

function searchTextFromFields(data: Record<string, unknown>, fields: string[]): string {
  return fields
    .flatMap(field => Array.isArray(data[field]) ? data[field] as unknown[] : [data[field]])
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .slice(0, 20_000)
}

function nonSensitiveFieldNames(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set()
  return new Set(value.flatMap(field => {
    const definition = record(field)
    return typeof definition.name === 'string' && definition.sensitive !== true && definition.secretRefRequired !== true
      ? [definition.name]
      : []
  }))
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function scalar(value: unknown): string | number | boolean | null | undefined {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : undefined
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
