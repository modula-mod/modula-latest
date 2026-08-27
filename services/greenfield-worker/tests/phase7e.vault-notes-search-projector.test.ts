import {randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {migrateUp} from '../../greenfield-api/src/database/migrate.js'
import {createDb, type ModulaWorkerDb} from '../src/database.js'
import {handleSearchIndex} from '../src/search/index.js'

const testDatabaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeLive = testDatabaseUrl ? describe : describe.skip

describe('Phase 7E Vault Notes search projector source', () => {
  it('registers Vault Notes events without embedding note content in subscriber metadata', () => {
    const subscribers = readFileSync(new URL('../src/search/subscribers.ts', import.meta.url), 'utf8')
    const index = readFileSync(new URL('../src/search/index.ts', import.meta.url), 'utf8')
    const projector = readFileSync(new URL('../src/search/vault-notes-projector.ts', import.meta.url), 'utf8')
    expect(subscribers).toContain('vault-notes.note.created')
    expect(subscribers).toContain('vault-notes.note.restored')
    expect(subscribers).toContain('vault-notes.folder.created')
    expect(index).toContain('projectVaultNotesRecord')
    expect(projector).toContain("entityType: 'note'")
    expect(projector).toContain("visibility: 'account'")
    expect(projector).not.toContain('document:')
  })
})

describeLive('Phase 7E Vault Notes search projector (live database)', () => {
  let db: ModulaWorkerDb
  const suffix = randomUUID().slice(0, 8)
  const accountId = `vault-worker-account-${suffix}`
  const actorId = `vault-worker-actor-${suffix}`
  const folderId = `vault-folder-${suffix}`
  const noteId = `vault-note-${suffix}`

  beforeAll(async () => {
    await migrateUp(testDatabaseUrl!)
    db = createDb(testDatabaseUrl!)
    await seedRecords()
  })

  afterAll(async () => {
    await db?.destroy()
  })

  it('projects a Vault note and tombstones it after deletion events', async () => {
    const createdEvent = event('vault-notes.note.created', noteId, 1)
    await insertDomainEvent(createdEvent)
    await handleSearchIndex(db, {
      event: createdEvent,
      projectorId: 'search.vault-notes-projector',
    })
    const indexed = await db.selectFrom('search_documents').selectAll().where('entity_type', '=', 'note').where('entity_id', '=', noteId).executeTakeFirstOrThrow()
    expect(indexed.account_id).toBe(accountId)
    expect(indexed.visibility).toBe('account')
    expect(indexed.body).toContain(`worker searchable ${suffix}`)
    expect(JSON.stringify(indexed.metadata)).not.toContain(`worker searchable ${suffix}`)

    const deletedEvent = event('vault-notes.note.deleted', noteId, 2)
    await insertDomainEvent(deletedEvent)
    await handleSearchIndex(db, {
      event: deletedEvent,
      projectorId: 'search.vault-notes-projector',
    })
    const deleted = await db.selectFrom('search_documents').select(['status', 'body']).where('entity_type', '=', 'note').where('entity_id', '=', noteId).executeTakeFirstOrThrow()
    expect(deleted.status).toBe('deleted')
    expect(deleted.body).toBeNull()
  })

  async function seedRecords(): Promise<void> {
    const now = new Date()
    await db.insertInto('greenfield_accounts').values({account_id: accountId, primary_handle: `vaultwrk${suffix}`.slice(0, 24), status: 'active', created_at: now, updated_at: now}).execute()
    await db.insertInto('actors').values({id: actorId, account_id: accountId, kind: 'person', created_at: now, updated_at: now, deleted_at: null, version: 1}).execute()
    await db
      .insertInto('greenfield_module_records')
      .values([
        {
          record_id: folderId,
          account_id: accountId,
          module_id: 'modula.vault-notes',
          installation_id: null,
          collection: 'folder',
          schema_ref: 'schemas/folder.schema.json',
          visibility: 'private',
          data: {name: `Worker Folder ${suffix}`, position: 0},
          search_text: `Worker Folder ${suffix}`,
          folder_ref: null,
          source_uri: null,
          retained_after_uninstall: false,
          revision: 1,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        },
        {
          record_id: noteId,
          account_id: accountId,
          module_id: 'modula.vault-notes',
          installation_id: null,
          collection: 'note',
          schema_ref: 'schemas/note.schema.json',
          visibility: 'private',
          data: {
            title: `Worker Note ${suffix}`,
            plainTextProjection: `worker searchable ${suffix}`,
            folderId,
            tagIds: ['worker'],
            archived: false,
            pinned: false,
            favourite: false,
            dataSchemaVersion: '1.0.0',
          },
          search_text: `Worker Note worker searchable ${suffix}`,
          folder_ref: folderId,
          source_uri: null,
          retained_after_uninstall: false,
          revision: 1,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        },
      ])
      .execute()
  }

  function event(eventType: string, aggregateId: string, version: number) {
    const now = new Date().toISOString()
    return {
      eventId: `event-${eventType}-${suffix}-${version}`,
      eventType,
      eventVersion: '1.0.0',
      aggregateType: eventType.includes('folder') ? 'vault-folder' : 'note',
      aggregateId,
      aggregateVersion: version,
      accountId,
      actorId,
      producerKind: 'service' as const,
      producerId: 'service.greenfield-worker.test',
      traceId: `corr-${eventType}-${suffix}`,
      requestId: `req-${eventType}-${suffix}`,
      correlationId: `corr-${eventType}-${suffix}`,
      occurredAt: now,
      recordedAt: now,
      visibility: 'account',
      classification: 'private',
      payload: {recordId: aggregateId, sourceVersion: version},
      metadata: {},
    }
  }

  async function insertDomainEvent(input: ReturnType<typeof event>) {
    await db
      .insertInto('greenfield_domain_events')
      .values({
        event_id: input.eventId,
        event_type: input.eventType,
        event_version: input.eventVersion,
        aggregate_type: input.aggregateType,
        aggregate_id: input.aggregateId,
        aggregate_version: input.aggregateVersion,
        account_id: input.accountId,
        actor_id: input.actorId,
        producer_kind: input.producerKind,
        producer_id: input.producerId,
        product_id: null,
        installation_id: null,
        release_id: null,
        trace_id: input.traceId,
        request_id: input.requestId,
        correlation_id: input.correlationId,
        causation_id: null,
        idempotency_key: null,
        visibility: input.visibility,
        classification: input.classification,
        payload: input.payload,
        metadata: input.metadata,
        occurred_at: new Date(input.occurredAt),
        recorded_at: new Date(input.recordedAt),
      })
      .execute()
  }
})
