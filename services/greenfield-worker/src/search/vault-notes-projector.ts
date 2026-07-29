import type {GreenfieldSearchDocument} from '@modula/greenfield-contracts'
import type {ModulaWorkerDb} from '../database.js'
import {SearchProjector, type SearchProjectionContext} from './projector.js'

const VAULT_NOTES_MODULE_ID = 'modula.vault-notes'

export async function projectVaultNotesRecord(db: ModulaWorkerDb, projector: SearchProjector, context: SearchProjectionContext): Promise<void> {
  const recordId = recordIdFromEvent(context)
  const collection = context.entityType === 'vault-folder' ? 'folder' : 'note'
  const row = await db
    .selectFrom('greenfield_module_records')
    .selectAll()
    .where('module_id', '=', VAULT_NOTES_MODULE_ID)
    .where('collection', '=', collection)
    .where('record_id', '=', recordId)
    .executeTakeFirst()

  if (!row || context.event.eventType.endsWith('.deleted') || context.event.eventType.endsWith('.permanently-deleted')) {
    await projector.tombstone({...context, entityId: recordId}, {
      sourceVersion: projector.sourceVersionFor(context, Number(context.event.payload?.sourceVersion ?? Date.now())),
      accountId: context.event.accountId ?? row?.account_id,
      visibility: 'account',
      status: 'deleted',
      updatedAt: row?.updated_at,
    })
    return
  }

  if (collection === 'folder') {
    await projector.upsert({...context, entityId: row.record_id}, folderDocument(row, projector.sourceVersionFor(context, row.revision)))
    return
  }
  await projector.upsert({...context, entityId: row.record_id}, noteDocument(row, projector.sourceVersionFor(context, row.revision), await folderName(db, row.account_id, field(row.data, 'folderId'))))
}

function noteDocument(row: {record_id: string; account_id: string; revision: number; data: unknown; created_at: Date; updated_at: Date; deleted_at: Date | null}, sourceVersion: number, folder?: string): GreenfieldSearchDocument {
  const data = record(row.data)
  const deleted = Boolean(row.deleted_at)
  return {
    documentId: `note:${row.account_id}:${row.record_id}`,
    schemaVersion: '1.0.0',
    entityType: 'note',
    entityId: row.record_id,
    sourceVersion,
    accountId: row.account_id,
    title: stringField(data.title) ?? 'Untitled',
    body: deleted ? undefined : stringField(data.plainTextProjection),
    summary: undefined,
    keywords: [VAULT_NOTES_MODULE_ID, 'vault-notes', folder].filter((item): item is string => Boolean(item)),
    tags: arrayOfStrings(data.tagIds),
    visibility: 'account',
    status: deleted ? 'deleted' : 'active',
    language: 'en',
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    indexedAt: new Date().toISOString(),
    metadata: {
      moduleId: VAULT_NOTES_MODULE_ID,
      folderId: stringField(data.folderId),
      folderName: folder,
      sourceTitle: stringField(record(data.source).title),
      sourceAuthor: stringField(record(data.source).authorDisplayName),
      archived: data.archived === true,
      pinned: data.pinned === true,
      favourite: data.favourite === true,
      dataSchemaVersion: stringField(data.dataSchemaVersion),
    },
  }
}

function folderDocument(row: {record_id: string; account_id: string; revision: number; data: unknown; created_at: Date; updated_at: Date; deleted_at: Date | null}, sourceVersion: number): GreenfieldSearchDocument {
  const data = record(row.data)
  return {
    documentId: `vault-folder:${row.account_id}:${row.record_id}`,
    schemaVersion: '1.0.0',
    entityType: 'vault-folder',
    entityId: row.record_id,
    sourceVersion,
    accountId: row.account_id,
    title: stringField(data.name) ?? 'Folder',
    keywords: [VAULT_NOTES_MODULE_ID, 'vault-notes', 'folder'],
    tags: [],
    visibility: 'account',
    status: row.deleted_at ? 'deleted' : 'active',
    language: 'en',
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    indexedAt: new Date().toISOString(),
    metadata: {
      moduleId: VAULT_NOTES_MODULE_ID,
      parentFolderId: stringField(data.parentFolderId),
      position: typeof data.position === 'number' ? data.position : undefined,
    },
  }
}

async function folderName(db: ModulaWorkerDb, accountId: string, folderId?: string): Promise<string | undefined> {
  if (!folderId) return undefined
  const row = await db
    .selectFrom('greenfield_module_records')
    .select('data')
    .where('account_id', '=', accountId)
    .where('module_id', '=', VAULT_NOTES_MODULE_ID)
    .where('collection', '=', 'folder')
    .where('record_id', '=', folderId)
    .executeTakeFirst()
  return stringField(record(row?.data).name)
}

function recordIdFromEvent(context: SearchProjectionContext): string {
  const fromPayload = context.event.payload?.recordId
  return typeof fromPayload === 'string' && fromPayload ? fromPayload : context.event.aggregateId
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function field(value: unknown, key: string): string | undefined {
  return stringField(record(value)[key])
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}
