import {randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {migrateUp} from '../../greenfield-api/src/database/migrate.js'
import {createDb, type ModulaWorkerDb} from '../src/database.js'
import {handleSearchIndex} from '../src/search/index.js'

describe('Phase 7E search projector source', () => {
  it('uses projection tables, source-version ordering and sanitized failure state', () => {
    const projector = readFileSync(new URL('../src/search/projector.ts', import.meta.url), 'utf8')
    const index = readFileSync(new URL('../src/search/index.ts', import.meta.url), 'utf8')
    expect(projector).toContain('search_documents.source_version <= EXCLUDED.source_version')
    expect(projector).toContain('search_projection_failures')
    expect(projector).toContain('sanitised_details')
    expect(index).toContain('isSearchOperationalEvent')
    expect(index).toContain('handleSearchReindex')
  })
})

const testDatabaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeLive = testDatabaseUrl ? describe : describe.skip

describeLive('Phase 7E search projector worker (live database)', () => {
  let db: ModulaWorkerDb
  const suffix = randomUUID().slice(0, 8)
  const accountId = `worker-search-account-${suffix}`
  const actorId = `worker-search-actor-${suffix}`
  const postId = `worker-search-post-${suffix}`
  const eventId = `event-worker-search-${suffix}`

  beforeAll(async () => {
    await migrateUp(testDatabaseUrl!)
    db = createDb(testDatabaseUrl!)
    await seedPost(db, accountId, actorId, postId, suffix)
  })

  afterAll(async () => {
    await db?.destroy()
  })

  it('projects a post once and ignores a stale source version', async () => {
    await insertDomainEvent(db, eventId, postId, 2, suffix)
    await handleSearchIndex(db, {
      event: {
        eventId,
        eventType: 'post.updated',
        eventVersion: '1.0.0',
        aggregateType: 'post',
        aggregateId: postId,
        aggregateVersion: 2,
        accountId,
        actorId,
        producerKind: 'service',
        producerId: 'service.greenfield-worker.test',
        traceId: `corr-${eventId}`,
        requestId: `req-${eventId}`,
        correlationId: `corr-${eventId}`,
        occurredAt: new Date().toISOString(),
        recordedAt: new Date().toISOString(),
        visibility: 'public',
        classification: 'internal',
        payload: {postId, sourceVersion: 2},
        metadata: {},
      },
      projectorId: 'search.post-projector',
    })
    await handleSearchIndex(db, {
      event: {
        eventId,
        eventType: 'post.updated',
        eventVersion: '1.0.0',
        aggregateType: 'post',
        aggregateId: postId,
        aggregateVersion: 1,
        accountId,
        actorId,
        producerKind: 'service',
        producerId: 'service.greenfield-worker.test',
        traceId: `corr-${eventId}`,
        requestId: `req-${eventId}`,
        correlationId: `corr-${eventId}`,
        occurredAt: new Date().toISOString(),
        recordedAt: new Date().toISOString(),
        visibility: 'public',
        classification: 'internal',
        payload: {postId, sourceVersion: 1},
        metadata: {},
      },
      projectorId: 'search.post-projector',
    })
    const rows = await db.selectFrom('search_documents').select(['document_id', 'source_version']).where('entity_type', '=', 'post').where('entity_id', '=', postId).execute()
    expect(rows).toHaveLength(1)
    expect(Number(rows[0]!.source_version)).toBe(2)
  })
})

async function seedPost(db: ModulaWorkerDb, accountId: string, actorId: string, postId: string, suffix: string): Promise<void> {
  const now = new Date()
  await db.insertInto('greenfield_accounts').values({account_id: accountId, primary_handle: `wrk${suffix}`, status: 'active', created_at: now, updated_at: now}).execute()
  await db.insertInto('actors').values({id: actorId, account_id: accountId, kind: 'person', created_at: now, updated_at: now, deleted_at: null} as any).execute()
  await db
    .insertInto('profiles')
    .values({
      id: `profile-${actorId}`,
      actor_id: actorId,
      handle: `wrk${suffix}`,
      display_name: `Worker Search ${suffix}`,
      kind: 'person',
      bio: '',
      avatar_url: null,
      cover_url: null,
      cover_colour: null,
      pronouns: null,
      location_label: null,
      location_visibility: null,
      website_label: null,
      website_url: null,
      website_domain: null,
      website_visibility: null,
      focus_status_id: 'available',
      focus_status_label: 'Available',
      focus_status_message: '',
      focus_status_updated_at: now,
      visibility: 'public',
      module_count: 0,
      featured_module_ids: [],
      identity_claims: [],
      joined_at: now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
    })
    .execute()
  await db
    .insertInto('posts')
    .values({
      id: postId,
      author_actor_id: actorId,
      kind: 'text',
      text: `Worker searchable ${suffix}`,
      feed: 'following',
      audience: 'public',
      reply_permission: 'everyone',
      idempotency_key: null,
      link_domain: null,
      link_title: null,
      link_description: null,
      link_image: null,
      module_name: null,
      module_action_label: null,
      module_status: null,
      glow_colour: null,
      like_count: 0,
      reaction_count: 0,
      quote_count: 0,
      reply_count: 0,
      repost_count: 0,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 2,
    })
    .execute()
}

async function insertDomainEvent(db: ModulaWorkerDb, eventId: string, postId: string, sourceVersion: number, suffix: string): Promise<void> {
  const now = new Date()
  await db
    .insertInto('greenfield_domain_events')
    .values({
      event_id: eventId,
      event_type: 'post.updated',
      event_version: '1.0.0',
      aggregate_type: 'post',
      aggregate_id: postId,
      aggregate_version: sourceVersion,
      account_id: `worker-search-account-${suffix}`,
      actor_id: `worker-search-actor-${suffix}`,
      producer_kind: 'service',
      producer_id: 'service.greenfield-worker.test',
      product_id: null,
      installation_id: null,
      release_id: null,
      trace_id: `corr-${eventId}`,
      request_id: `req-${eventId}`,
      correlation_id: `corr-${eventId}`,
      causation_id: null,
      idempotency_key: null,
      visibility: 'public',
      classification: 'internal',
      payload: {postId, sourceVersion},
      metadata: {},
      occurred_at: now,
      recorded_at: now,
    })
    .execute()
}
