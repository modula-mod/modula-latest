import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldDomainEventRepository, GreenfieldEventReplayService} from '../src/events/index.js'
import {PostWriteService} from '../src/domains/posts/writes.js'
import {getEventSchema, listEventSchemas} from '@modula/greenfield-schema-registry'

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
    const postId = `post-phase7e-events-${accountId}`
    const idempotencyKey = `phase7e-events-idempotent-${accountId}`
    await events.registerSubscription({
      eventType: 'post.created',
      subscriberId: 'greenfield.search.posts',
      targetType: 'search-index',
      targetKey: 'search.index.post',
    })

    const first = await events.append({
      eventType: 'post.created',
      aggregateType: 'post',
      aggregateId: postId,
      accountId,
      actorId,
      requestId: 'req-phase7e-events',
      idempotencyKey,
      payload: {postId, mediaCount: 0},
      metadata: {source: 'test'},
      occurredAt: new Date('2026-07-29T10:00:00.000Z'),
    })
    const second = await events.append({
      eventType: 'post.created',
      aggregateType: 'post',
      aggregateId: postId,
      accountId,
      actorId,
      requestId: 'req-phase7e-events-retry',
      idempotencyKey,
      payload: {postId, mediaCount: 99},
      metadata: {source: 'retry'},
    })

    expect(second.eventId).toBe(first.eventId)
    expect(first.requestId).toBe('req-phase7e-events')
    expect(first.correlationId).toBe('req-phase7e-events')
    expect(first.visibility).toBe('internal')
    expect(first.classification).toBe('internal')
    expect(first.payload.mediaCount).toBe(0)

    const deliveries = await db
      .selectFrom('greenfield_event_deliveries')
      .select(['subscriber_id', 'target_type', 'target_key', 'status'])
      .where('event_id', '=', first.eventId)
      .orderBy('subscriber_id')
      .execute()
    expect(deliveries).toHaveLength(2)
    expect(deliveries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        subscriber_id: 'greenfield.search.posts',
        target_type: 'search-index',
        target_key: 'search.index.post',
        status: 'pending',
      }),
      expect.objectContaining({
        subscriber_id: 'search.post-projector',
        target_type: 'search-index',
        target_key: 'post',
        status: 'pending',
      }),
    ]))
  })

  it('registers the required Phase 7E event families with routing metadata', async () => {
    const required = [
      'account.created',
      'profile.visibility-changed',
      'post.created',
      'comment.created',
      'module.installed',
      'note.ai-processed',
      'ai.tool-requested',
      'connection.authorised',
      'automation.execution-failed',
      'dimon.anchor-created',
    ]
    for (const eventType of required) {
      const schema = getEventSchema(eventType)
      expect(schema).toBeTruthy()
      expect(schema?.owner).toBeTruthy()
      expect(schema?.jsonSchema).toMatchObject({type: 'object'})
      expect(schema?.compatibilityPolicy).toBeTruthy()
      expect(schema?.retentionPolicy).toBeTruthy()
      expect(schema?.dataClassification).toBeTruthy()
      expect(schema?.permittedSubscribers.length).toBeGreaterThan(0)
      expect(schema?.replayPolicy).toBeTruthy()
    }
    expect(listEventSchemas().length).toBeGreaterThanOrEqual(70)
  })

  it('plans and queues replay without bypassing subscriber classification permissions', async () => {
    const events = new GreenfieldDomainEventRepository(db)
    const replay = new GreenfieldEventReplayService(db)
    await events.registerSubscription({
      eventType: 'note.created',
      subscriberId: 'greenfield.search.private',
      targetType: 'internal-subscriber',
      targetKey: 'phase7e.replay.probe',
      permittedClassifications: ['private'],
      permittedVisibility: ['actor', 'account', 'internal'],
    })
    await events.registerSubscription({
      eventType: 'note.created',
      subscriberId: 'greenfield.search.public',
      targetType: 'internal-subscriber',
      targetKey: 'phase7e.replay.denied',
      permittedClassifications: ['public', 'internal'],
      permittedVisibility: ['public'],
    })

    const event = await events.append({
      eventType: 'note.created',
      aggregateType: 'note',
      aggregateId: 'note-phase7e-replay',
      accountId,
      actorId,
      requestId: 'req-phase7e-replay',
      visibility: 'actor',
      classification: 'private',
      payload: {noteId: 'note-phase7e-replay'},
      idempotencyKey: 'phase7e-note-replay',
    })

    const dryRun = await replay.replay({
      eventId: event.eventId,
      dryRun: true,
      reason: 'phase7e verifier dry run',
      requestedByActorId: actorId,
      requestId: 'req-phase7e-replay-dry-run',
    })
    expect(dryRun).toMatchObject({dryRun: true, plannedCount: 1, replayedCount: 0})

    await db
      .updateTable('greenfield_event_deliveries')
      .set({status: 'dead_lettered', failure_code: 'TEST_FAILURE', updated_at: new Date()})
      .where('event_id', '=', event.eventId)
      .where('subscriber_id', '=', 'greenfield.search.private')
      .execute()

    const failures = await replay.inspectSubscriberFailures('greenfield.search.private')
    expect(failures.some(failure => failure.eventId === event.eventId && failure.status === 'dead_lettered')).toBe(true)

    const queued = await replay.retryDeadLetters({
      eventType: 'note.created',
      subscriberId: 'greenfield.search.private',
      reason: 'phase7e verifier replay',
      requestedByActorId: actorId,
      requestId: 'req-phase7e-replay-queue',
    })
    expect(queued).toMatchObject({dryRun: false, plannedCount: 1, replayedCount: 1})

    const delivery = await db
      .selectFrom('greenfield_event_deliveries')
      .select(['status', 'subscriber_id'])
      .where('event_id', '=', event.eventId)
      .where('subscriber_id', '=', 'greenfield.search.private')
      .executeTakeFirstOrThrow()
    expect(delivery).toMatchObject({status: 'pending', subscriber_id: 'greenfield.search.private'})

    const deniedDelivery = await db
      .selectFrom('greenfield_event_deliveries')
      .select('delivery_id')
      .where('event_id', '=', event.eventId)
      .where('subscriber_id', '=', 'greenfield.search.public')
      .executeTakeFirst()
    expect(deniedDelivery).toBeUndefined()
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
    expect(event.visibility).toBe('public')
    expect(event.classification).toBe('internal')
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

  it('rolls back a business write when the domain event insert fails in the same transaction', async () => {
    const postId = `post-phase7e-rollback-${Date.now()}`
    await expect(
      db.transaction().execute(async trx => {
        const now = new Date()
        await trx
          .insertInto('posts')
          .values({
            id: postId,
            author_actor_id: actorId,
            kind: 'text',
            text: 'this post must roll back',
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
            version: 1,
          })
          .execute()
        await trx
          .insertInto('greenfield_domain_events')
          .values({
            event_id: `event-phase7e-invalid-${Date.now()}`,
            event_type: 'post.created',
            event_version: '1.0.0',
            aggregate_type: 'post',
            aggregate_id: postId,
            aggregate_version: 1,
            account_id: accountId,
            actor_id: actorId,
            request_id: 'req-phase7e-rollback',
            correlation_id: 'req-phase7e-rollback',
            causation_id: null,
            idempotency_key: null,
            visibility: 'public',
            classification: 'not-a-valid-classification' as any,
            payload: {postId},
            metadata: {},
            occurred_at: now,
            recorded_at: now,
          })
          .execute()
      }),
    ).rejects.toThrow()

    const post = await db.selectFrom('posts').select('id').where('id', '=', postId).executeTakeFirst()
    const event = await db.selectFrom('greenfield_domain_events').select('event_id').where('aggregate_id', '=', postId).executeTakeFirst()
    expect(post).toBeUndefined()
    expect(event).toBeUndefined()
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
