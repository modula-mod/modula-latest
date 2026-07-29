import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldDomainEventRepository} from '../src/events/index.js'
import {PostWriteService} from '../src/domains/posts/writes.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('Phase 7E Greenfield internal events', () => {
  let db: ModulaDb
  let accountId = ''
  let actorId = ''

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    const suffix = Date.now().toString(36)
    accountId = `events-account-${suffix}`
    actorId = `events-actor-${suffix}`
    await seedProfileAccount(db, accountId, actorId, `events${suffix}`.slice(0, 24))
  })

  afterAll(async () => {
    await db?.destroy()
  })

  it('appends idempotent domain events and creates subscriber delivery rows', async () => {
    const events = new GreenfieldDomainEventRepository(db)
    await events.registerSubscription({
      eventType: 'post.created',
      subscriberId: 'greenfield.search.posts',
      targetType: 'search-index',
      targetKey: 'search.index.post',
    })

    const first = await events.append({
      eventType: 'post.created',
      aggregateType: 'post',
      aggregateId: 'post-phase7e-events',
      accountId,
      actorId,
      requestId: 'req-phase7e-events',
      idempotencyKey: 'phase7e-events-idempotent',
      payload: {postId: 'post-phase7e-events', mediaCount: 0},
      metadata: {source: 'test'},
      occurredAt: new Date('2026-07-29T10:00:00.000Z'),
    })
    const second = await events.append({
      eventType: 'post.created',
      aggregateType: 'post',
      aggregateId: 'post-phase7e-events',
      accountId,
      actorId,
      requestId: 'req-phase7e-events-retry',
      idempotencyKey: 'phase7e-events-idempotent',
      payload: {postId: 'post-phase7e-events', mediaCount: 99},
      metadata: {source: 'retry'},
    })

    expect(second.eventId).toBe(first.eventId)
    expect(first.requestId).toBe('req-phase7e-events')
    expect(first.payload.mediaCount).toBe(0)

    const deliveries = await db
      .selectFrom('greenfield_event_deliveries')
      .select(['subscriber_id', 'target_type', 'target_key', 'status'])
      .where('event_id', '=', first.eventId)
      .execute()
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]).toMatchObject({
      subscriber_id: 'greenfield.search.posts',
      target_type: 'search-index',
      target_key: 'search.index.post',
      status: 'pending',
    })
  })

  it('records post.created from the real post write path without storing post text in the event', async () => {
    const secretLikeText = 'event payload must not contain this post body'
    const created = await new PostWriteService(db, loadConfig()).create(
      actorId,
      {
        text: secretLikeText,
        idempotencyKey: 'phase7e-post-created-event',
      },
      {
        requestId: 'req-phase7e-post-create',
        correlationId: 'req-phase7e-post-create',
      },
    )

    const event = await db
      .selectFrom('greenfield_domain_events')
      .selectAll()
      .where('event_type', '=', 'post.created')
      .where('aggregate_id', '=', created.id)
      .executeTakeFirstOrThrow()
    const encodedEvent = JSON.stringify(event)
    expect(event.request_id).toBe('req-phase7e-post-create')
    expect(event.account_id).toBe(accountId)
    expect(event.actor_id).toBe(actorId)
    expect(encodedEvent).not.toContain(secretLikeText)
    expect(event.payload).toMatchObject({postId: created.id, mediaCount: 0, kind: 'text'})

    const audit = await db
      .selectFrom('audit_events')
      .select('event_type')
      .where('event_type', '=', 'post.created')
      .where('resource_id', '=', created.id)
      .executeTakeFirst()
    expect(audit?.event_type).toBe('post.created')

    const outbox = await db
      .selectFrom('outbox_events')
      .select('event_type')
      .where('event_type', '=', 'search.index.post')
      .where('aggregate_id', '=', created.id)
      .executeTakeFirst()
    expect(outbox?.event_type).toBe('search.index.post')
  })
})

function configureTestEnv(): void {
  process.env.NODE_ENV = 'test'
  process.env.MODULA_ENVIRONMENT = 'development'
  process.env.MODULA_API_HOST = '127.0.0.1'
  process.env.MODULA_API_PORT = '4021'
  process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4021'
  process.env.MODULA_DATABASE_URL = databaseUrl!
  process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
  process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
  process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
}

async function seedProfileAccount(db: ModulaDb, accountId: string, actorId: string, handle: string): Promise<void> {
  const now = new Date()
  await db
    .insertInto('greenfield_accounts')
    .values({
      account_id: accountId,
      primary_handle: handle,
      status: 'active',
      created_at: now,
      updated_at: now,
    })
    .execute()
  await db
    .insertInto('actors')
    .values({
      id: actorId,
      account_id: accountId,
      kind: 'person',
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
    })
    .execute()
  await db
    .insertInto('profiles')
    .values({
      id: `profile-${actorId}`,
      actor_id: actorId,
      handle,
      display_name: 'Phase 7E Events',
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
}
