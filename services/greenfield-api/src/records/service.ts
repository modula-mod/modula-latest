import {createHash} from 'node:crypto'
import {canonicalJsonStringify, GREENFIELD_INITIAL_COLLECTIONS} from '@modula/greenfield-protocol'
import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'
import {validateSchemaRecord} from '../schemas/registry.js'

type Visibility = 'public' | 'followers' | 'teams' | 'private' | 'system'
type Operation = 'create' | 'update' | 'delete'

const APPROVED_CLIENT_COLLECTIONS = new Set<string>(GREENFIELD_INITIAL_COLLECTIONS)

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function contentHash(data: unknown): string {
  return sha256Hex(canonicalJsonStringify(data))
}

function eventHashInput(input: {
  eventId: string
  repositoryId: string
  recordId: string
  collection: string
  operation: Operation
  revision: number
  occurredAt: string
  previousEventHash: string | null
  contentHash: string
}): string {
  return sha256Hex(canonicalJsonStringify(input))
}

export class RecordService {
  constructor(private readonly db: ModulaDb) {}

  async listForAccount(accountId: string, collection?: string) {
    const repo = await this.db
      .selectFrom('greenfield_repositories')
      .select('repository_id')
      .where('account_id', '=', accountId)
      .where('name', '=', 'default')
      .executeTakeFirst()
    if (!repo) return []
    let query = this.db
      .selectFrom('greenfield_records')
      .selectAll()
      .where('repository_id', '=', repo.repository_id)
      .where('deleted_at', 'is', null)
      .orderBy('updated_at', 'desc')
    if (collection) query = query.where('collection', '=', collection)
    return query.execute()
  }

  async getForAccount(accountId: string, recordId: string) {
    return this.db
      .selectFrom('greenfield_records')
      .innerJoin('greenfield_repositories', 'greenfield_repositories.repository_id', 'greenfield_records.repository_id')
      .selectAll('greenfield_records')
      .where('greenfield_repositories.account_id', '=', accountId)
      .where('greenfield_records.record_id', '=', recordId)
      .executeTakeFirst()
  }

  async mutate(input: {
    accountId: string
    repositoryId?: string
    recordId?: string
    collection: string
    schemaId: string
    schemaVersion?: number
    visibility: Visibility
    data: unknown
    expectedRevision?: number
    operation: Operation
  }) {
    if (!APPROVED_CLIENT_COLLECTIONS.has(input.collection) && !input.collection.startsWith('modula.')) {
      throw Object.assign(new Error('Collection is not approved for client writes'), {code: 'FORBIDDEN'})
    }
    validateSchemaRecord(input.schemaId, input.schemaVersion ?? 1, input.data, input.visibility)

    return this.db.transaction().execute(async trx => {
      const repoQuery = trx
        .selectFrom('greenfield_repositories')
        .selectAll()
        .where('account_id', '=', input.accountId)
        .forUpdate()
      const repo = input.repositoryId
        ? await repoQuery.where('repository_id', '=', input.repositoryId).executeTakeFirst()
        : await repoQuery.where('name', '=', 'default').executeTakeFirst()
      if (!repo) throw Object.assign(new Error('Repository not found'), {code: 'NOT_FOUND'})

      const now = new Date()
      const recordId = input.recordId ?? uuidv7()
      const current = input.recordId
        ? await trx.selectFrom('greenfield_records').selectAll().where('record_id', '=', recordId).forUpdate().executeTakeFirst()
        : undefined

      if (input.operation === 'create' && current) {
        throw Object.assign(new Error('Record exists'), {code: 'CONFLICT'})
      }
      if (input.operation !== 'create' && !current) {
        throw Object.assign(new Error('Record not found'), {code: 'NOT_FOUND'})
      }
      if (current && input.expectedRevision !== undefined && Number(current.revision) !== input.expectedRevision) {
        throw Object.assign(new Error('Record revision conflict'), {code: 'CONFLICT'})
      }

      const revision = (current ? Number(current.revision) : 0) + 1
      const previousEventHash = repo.head_hash
      const payloadHash = contentHash(input.operation === 'delete' ? {deleted: true} : input.data)
      const eventId = uuidv7()
      const occurredAt = now.toISOString()
      const hash = eventHashInput({
        eventId,
        repositoryId: repo.repository_id,
        recordId,
        collection: input.collection,
        operation: input.operation,
        revision,
        occurredAt,
        previousEventHash,
        contentHash: payloadHash,
      })

      if (!current) {
        await trx
          .insertInto('greenfield_records')
          .values({
            record_id: recordId,
            repository_id: repo.repository_id,
            collection: input.collection,
            schema_id: input.schemaId,
            schema_version: input.schemaVersion ?? 1,
            visibility: input.visibility,
            data: input.data,
            revision,
            created_at: now,
            updated_at: now,
            deleted_at: input.operation === 'delete' ? now : null,
          })
          .execute()
      } else {
        await trx
          .updateTable('greenfield_records')
          .set({
            data: input.data,
            visibility: input.visibility,
            revision,
            updated_at: now,
            deleted_at: input.operation === 'delete' ? now : null,
          })
          .where('record_id', '=', recordId)
          .execute()
      }

      await trx
        .insertInto('greenfield_record_events')
        .values({
          event_id: eventId,
          record_id: recordId,
          repository_id: repo.repository_id,
          operation: input.operation,
          revision,
          previous_hash: previousEventHash,
          event_hash: hash,
          payload_hash: payloadHash,
          created_at: now,
        })
        .execute()

      await trx
        .updateTable('greenfield_repositories')
        .set({head_hash: hash, revision: Number(repo.revision) + 1, updated_at: now})
        .where('repository_id', '=', repo.repository_id)
        .execute()

      await trx
        .insertInto('audit_events')
        .values({
          id: uuidv7(),
          event_type: `greenfield.record.${input.operation}`,
          actor_id: null,
          resource_type: 'greenfield_record',
          resource_id: recordId,
          metadata: {repositoryId: repo.repository_id, eventHash: hash, collection: input.collection},
          created_at: now,
        })
        .execute()

      // Never put private record bodies into the public outbox.
      if (input.visibility === 'public') {
        await trx
          .insertInto('outbox_events')
          .values({
            id: uuidv7(),
            event_type: 'greenfield.record.changed',
            aggregate_type: 'greenfield_repository',
            aggregate_id: repo.repository_id,
            payload: {
              recordId,
              eventHash: hash,
              operation: input.operation,
              revision,
              collection: input.collection,
              contentHash: payloadHash,
            },
            created_at: now,
            published_at: null,
            attempt_count: 0,
            last_error: null,
          })
          .execute()
      }

      return trx.selectFrom('greenfield_records').selectAll().where('record_id', '=', recordId).executeTakeFirstOrThrow()
    })
  }
}
