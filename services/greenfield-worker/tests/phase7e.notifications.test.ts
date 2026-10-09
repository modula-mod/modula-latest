import {randomUUID} from 'node:crypto'
import {sql} from 'kysely'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {migrateUp} from '../../greenfield-api/src/database/migrate.js'
import {createDb, type ModulaWorkerDb} from '../src/database.js'
import {handleNotificationCreate} from '../src/notifications/create.js'
import {handleSocialNotification} from '../src/notifications/social.js'

const testDatabaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeLive = testDatabaseUrl ? describe : describe.skip

describeLive('Phase 7E notification worker', () => {
  let db: ModulaWorkerDb
  const suffix = randomUUID()
  const recipientAccountId = `notif-account-${suffix}`
  const recipientActorId = `notif-actor-${suffix}`
  const actorAccountId = `notif-sender-account-${suffix}`
  const actorId = `notif-sender-${suffix}`

  beforeAll(async () => {
    await migrateUp(testDatabaseUrl as string)
    db = createDb(testDatabaseUrl as string)
    await seedActor(db, recipientAccountId, recipientActorId)
    await seedActor(db, actorAccountId, actorId)
    await seedPreferences(db, recipientActorId)
  })

  afterAll(async () => {
    if (db) {
      await db.deleteFrom('blocks').where('blocker_actor_id', 'in', [recipientActorId, actorId]).execute()
      await db.deleteFrom('notifications').where('recipient_actor_id', '=', recipientActorId).execute()
      await db.deleteFrom('notification_preferences').where('actor_id', '=', recipientActorId).execute()
      await db.deleteFrom('actors').where('id', 'in', [recipientActorId, actorId]).execute()
      await db.deleteFrom('greenfield_accounts').where('account_id', 'in', [recipientAccountId, actorAccountId]).execute()
      await db.destroy()
    }
  })

  it('deduplicates and aggregates category-aware notification creates', async () => {
    await handleNotificationCreate(db, {
      recipientActorId,
      actorId,
      type: 'module_event',
      category: 'AI',
      channels: ['in-app', 'email'],
      dedupeKey: 'ai:completion:phase7e',
      body: 'AI analysis complete',
      aggregateBody: '2 AI completions are ready',
      resourceType: 'note',
      resourceId: 'note-phase7e',
    })
    await handleNotificationCreate(db, {
      recipientActorId,
      actorId,
      type: 'module_event',
      category: 'AI',
      channels: ['in-app', 'email'],
      dedupeKey: 'ai:completion:phase7e',
      body: 'AI analysis complete',
      aggregateBody: '2 AI completions are ready',
      resourceType: 'note',
      resourceId: 'note-phase7e',
    })

    const rows = await db
      .selectFrom('notifications')
      .select(['category', 'channels', 'dedupe_key', 'aggregate_count', 'body'])
      .where('recipient_actor_id', '=', recipientActorId)
      .where('dedupe_key', '=', 'ai:completion:phase7e')
      .execute()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      category: 'AI',
      dedupe_key: 'ai:completion:phase7e',
      aggregate_count: 2,
      body: '2 AI completions are ready',
    })
    expect(rows[0]?.channels).toEqual(['in-app', 'email'])
  })

  it('honours category-specific preferences before writing notifications', async () => {
    await db
      .updateTable('notification_preferences')
      .set({ai_completion_enabled: false, updated_at: new Date(), version: 2})
      .where('actor_id', '=', recipientActorId)
      .execute()

    await handleNotificationCreate(db, {
      recipientActorId,
      actorId,
      type: 'module_event',
      category: 'AI',
      channels: ['in-app'],
      dedupeKey: 'ai:completion:suppressed',
      body: 'AI analysis complete',
    })

    const suppressed = await db
      .selectFrom('notifications')
      .select('id')
      .where('recipient_actor_id', '=', recipientActorId)
      .where('dedupe_key', '=', 'ai:completion:suppressed')
      .executeTakeFirst()
    expect(suppressed).toBeUndefined()
  })

  it('does not double-count a retried social reaction job', async () => {
    await db
      .updateTable('notification_preferences')
      .set({ai_completion_enabled: true, updated_at: new Date(), version: 3})
      .where('actor_id', '=', recipientActorId)
      .execute()

    await handleSocialNotification(db, 'reaction', {
      recipientActorId,
      actorId,
      resourceType: 'post',
      resourceId: 'post-phase7e-notification-aggregate',
    })
    await handleSocialNotification(db, 'reaction', {
      recipientActorId,
      actorId,
      resourceType: 'post',
      resourceId: 'post-phase7e-notification-aggregate',
    })

    const row = await db
      .selectFrom('notifications')
      .select(['category', 'dedupe_key', 'aggregate_count', 'body'])
      .where('recipient_actor_id', '=', recipientActorId)
      .where('dedupe_key', '=', 'social:reaction:post:post-phase7e-notification-aggregate')
      .executeTakeFirstOrThrow()
    expect(row.category).toBe('social')
    expect(row.aggregate_count).toBe(1)
    expect(row.body).toBe('reacted to your post')
  })

  it('does not resurface a read reaction notification for an identical outbox retry', async () => {
    const resourceId = `post-api-fix-01-retry-${randomUUID()}`
    const secondActorAccountId = `notif-retry-account-${suffix}`
    const secondActorId = `notif-retry-actor-${suffix}`
    await seedActor(db, secondActorAccountId, secondActorId)
    const now = new Date()
    await db.insertInto('posts').values({
      id: resourceId, author_actor_id: recipientActorId, kind: 'text', text: 'reaction retry fixture',
      feed: 'following', audience: 'public', reply_permission: 'everyone', idempotency_key: null,
      link_domain: null, link_title: null, link_description: null, link_image: null,
      module_name: null, module_action_label: null, module_status: null, glow_colour: null,
      like_count: 0, reaction_count: 1, quote_count: 0, reply_count: 0, repost_count: 0,
      created_at: now, updated_at: now, deleted_at: null, version: 1,
    }).execute()
    await db.insertInto('greenfield_reactions').values({
      reaction_id: randomUUID(), actor_id: actorId, post_id: resourceId,
      reaction_type: 'like', created_at: now, updated_at: now,
    }).execute()

    const firstEvent = {
      recipientActorId,
      actorId,
      resourceType: 'post',
      resourceId,
      outboxEventId: `outbox-reaction-first-${randomUUID()}`,
    }
    await handleSocialNotification(db, 'reaction', firstEvent)
    const readAt = new Date(Date.now() + 1_000)
    await db.updateTable('notifications')
      .set(eb => ({read_at: readAt, updated_at: readAt, version: eb('version', '+', 1)}))
      .where('recipient_actor_id', '=', recipientActorId)
      .where('dedupe_key', '=', `social:reaction:post:${resourceId}`)
      .execute()
    const beforeRetry = await db.selectFrom('notifications')
      .select(['id', 'actor_id', 'aggregate_count', 'body', 'read_at', 'created_at', 'updated_at', 'version'])
      .where('recipient_actor_id', '=', recipientActorId)
      .where('dedupe_key', '=', `social:reaction:post:${resourceId}`)
      .executeTakeFirstOrThrow()

    await handleSocialNotification(db, 'reaction', firstEvent)
    const afterRetry = await db.selectFrom('notifications')
      .select(['id', 'actor_id', 'aggregate_count', 'body', 'read_at', 'created_at', 'updated_at', 'version'])
      .where('recipient_actor_id', '=', recipientActorId)
      .where('dedupe_key', '=', `social:reaction:post:${resourceId}`)
      .executeTakeFirstOrThrow()
    expect(afterRetry).toEqual(beforeRetry)

    const secondReactionAt = new Date(now.getTime() + 2_000)
    await db.insertInto('greenfield_reactions').values({
      reaction_id: randomUUID(), actor_id: secondActorId, post_id: resourceId,
      reaction_type: 'love', created_at: secondReactionAt, updated_at: secondReactionAt,
    }).execute()
    await handleSocialNotification(db, 'reaction', {
      ...firstEvent,
      actorId: secondActorId,
      outboxEventId: `outbox-reaction-second-${randomUUID()}`,
    })
    const afterNewReaction = await db.selectFrom('notifications')
      .select(['id', 'actor_id', 'aggregate_count', 'body', 'read_at', 'version'])
      .where('recipient_actor_id', '=', recipientActorId)
      .where('dedupe_key', '=', `social:reaction:post:${resourceId}`)
      .executeTakeFirstOrThrow()
    expect(afterNewReaction).toEqual({
      id: beforeRetry.id,
      actor_id: secondActorId,
      aggregate_count: 2,
      body: '2 people reacted to your post',
      read_at: null,
      version: beforeRetry.version + 1,
    })

    await db.deleteFrom('greenfield_reactions').where('post_id', '=', resourceId).execute()
    await db.deleteFrom('notifications').where('resource_id', '=', resourceId).execute()
    await db.deleteFrom('posts').where('id', '=', resourceId).execute()
    await db.deleteFrom('actors').where('id', '=', secondActorId).execute()
    await db.deleteFrom('greenfield_accounts').where('account_id', '=', secondActorAccountId).execute()
  })

  it('uses the supplied lifecycle identity to dedupe retried follow notifications', async () => {
    const cases = [
      {dedupeKey: `follow-request:${suffix}:requested`, body: 'requested to follow you'},
      {dedupeKey: `follow-request:${suffix}:accepted`, body: 'accepted your follow request'},
    ]
    for (const item of cases) {
      const payload = {
        recipientActorId,
        actorId,
        resourceType: 'profile',
        resourceId: `profile-${suffix}`,
        ...item,
      }
      await Promise.all([
        handleNotificationCreate(db, {...payload, type: 'follow'}),
        handleNotificationCreate(db, {...payload, type: 'follow'}),
      ])
      await handleNotificationCreate(db, {...payload, type: 'follow'})
    }

    const rows = await db.selectFrom('notifications').select(['dedupe_key', 'aggregate_count', 'body'])
      .where('recipient_actor_id', '=', recipientActorId)
      .where('dedupe_key', 'in', cases.map(item => item.dedupeKey))
      .orderBy('dedupe_key')
      .execute()
    expect(rows).toEqual([
      {dedupe_key: `follow-request:${suffix}:accepted`, aggregate_count: 1, body: 'accepted your follow request'},
      {dedupe_key: `follow-request:${suffix}:requested`, aggregate_count: 1, body: 'requested to follow you'},
    ])
  })

  it('reuses the permanent reaction identity when the active dedupe row is older than the aggregate window', async () => {
    const resourceId = `post-api-baseline-02-${randomUUID()}`
    await handleSocialNotification(db, 'reaction', {recipientActorId, actorId, resourceType: 'post', resourceId})
    const dedupeKey = `social:reaction:post:${resourceId}`
    await db.updateTable('notifications')
      .set({created_at: new Date(Date.now() - 6 * 60_000), updated_at: new Date(Date.now() - 6 * 60_000)})
      .where('recipient_actor_id', '=', recipientActorId)
      .where('dedupe_key', '=', dedupeKey)
      .execute()

    await expect(handleSocialNotification(db, 'reaction', {
      recipientActorId,
      actorId,
      resourceType: 'post',
      resourceId,
    })).resolves.toBeUndefined()

    const rows = await db.selectFrom('notifications').select(['id', 'aggregate_count', 'body'])
      .where('recipient_actor_id', '=', recipientActorId)
      .where('dedupe_key', '=', dedupeKey)
      .execute()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({aggregate_count: 1, body: 'reacted to your post'})
  })

  it('is retry-safe and converges concurrent reaction jobs on canonical reaction state', async () => {
    const resourceId = `post-api-fix-01-${randomUUID()}`
    const secondActorAccountId = `notif-concurrent-account-${suffix}`
    const secondActorId = `notif-concurrent-actor-${suffix}`
    await seedActor(db, secondActorAccountId, secondActorId)
    const now = new Date()
    await db.insertInto('posts').values({
      id: resourceId,
      author_actor_id: recipientActorId,
      kind: 'text',
      text: 'reaction concurrency fixture',
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
      reaction_count: 2,
      quote_count: 0,
      reply_count: 0,
      repost_count: 0,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
    }).execute()
    await db.insertInto('greenfield_reactions').values([
      {reaction_id: randomUUID(), actor_id: actorId, post_id: resourceId, reaction_type: 'like', created_at: now, updated_at: now},
      {reaction_id: randomUUID(), actor_id: secondActorId, post_id: resourceId, reaction_type: 'love', created_at: now, updated_at: now},
    ]).execute()

    const first = {recipientActorId, actorId, resourceType: 'post', resourceId}
    const second = {recipientActorId, actorId: secondActorId, resourceType: 'post', resourceId}
    await Promise.all([
      handleSocialNotification(db, 'reaction', first),
      handleSocialNotification(db, 'reaction', second),
    ])
    await handleSocialNotification(db, 'reaction', first)

    const rows = await db.selectFrom('notifications').select(['aggregate_count', 'body'])
      .where('recipient_actor_id', '=', recipientActorId)
      .where('dedupe_key', '=', `social:reaction:post:${resourceId}`)
      .execute()
    expect(rows).toEqual([{aggregate_count: 2, body: '2 people reacted to your post'}])

    await db.deleteFrom('greenfield_reactions').where('post_id', '=', resourceId).execute()
    await db.deleteFrom('notifications').where('resource_id', '=', resourceId).execute()
    await db.deleteFrom('posts').where('id', '=', resourceId).execute()
    await db.deleteFrom('actors').where('id', '=', secondActorId).execute()
    await db.deleteFrom('greenfield_accounts').where('account_id', '=', secondActorAccountId).execute()
  })

  it('locks the permanent identity before deriving reaction aggregate state', async () => {
    const resourceId = `post-api-fix-01-lock-${randomUUID()}`
    const secondActorAccountId = `notif-lock-account-${suffix}`
    const secondActorId = `notif-lock-actor-${suffix}`
    await seedActor(db, secondActorAccountId, secondActorId)
    const now = new Date()
    await db.insertInto('posts').values({
      id: resourceId, author_actor_id: recipientActorId, kind: 'text', text: 'reaction serialization fixture',
      feed: 'following', audience: 'public', reply_permission: 'everyone', idempotency_key: null,
      link_domain: null, link_title: null, link_description: null, link_image: null,
      module_name: null, module_action_label: null, module_status: null, glow_colour: null,
      like_count: 0, reaction_count: 1, quote_count: 0, reply_count: 0, repost_count: 0,
      created_at: now, updated_at: now, deleted_at: null, version: 1,
    }).execute()
    await db.insertInto('greenfield_reactions').values({
      reaction_id: randomUUID(), actor_id: actorId, post_id: resourceId,
      reaction_type: 'like', created_at: now, updated_at: now,
    }).execute()

    const identity = `${recipientActorId}:social:reaction:post:${resourceId}`
    let unlock!: () => void
    let locked!: () => void
    const release = new Promise<void>(resolve => { unlock = resolve })
    const acquired = new Promise<void>(resolve => { locked = resolve })
    const lockHolder = db.transaction().execute(async trx => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${identity}, 0))`.execute(trx)
      locked()
      await release
    })
    await acquired

    let completed = false
    const processing = handleSocialNotification(db, 'reaction', {
      recipientActorId, actorId, resourceType: 'post', resourceId,
    }).then(() => { completed = true })
    await new Promise(resolve => setTimeout(resolve, 25))
    const waitedForIdentityLock = !completed
    await db.insertInto('greenfield_reactions').values({
      reaction_id: randomUUID(), actor_id: secondActorId, post_id: resourceId,
      reaction_type: 'love', created_at: new Date(now.getTime() + 1_000), updated_at: new Date(now.getTime() + 1_000),
    }).execute()
    unlock()
    await Promise.all([lockHolder, processing])

    expect(waitedForIdentityLock).toBe(true)
    const notification = await db.selectFrom('notifications').select(['actor_id', 'aggregate_count', 'body'])
      .where('recipient_actor_id', '=', recipientActorId)
      .where('dedupe_key', '=', `social:reaction:post:${resourceId}`)
      .executeTakeFirstOrThrow()
    expect(notification).toEqual({actor_id: secondActorId, aggregate_count: 2, body: '2 people reacted to your post'})

    await db.deleteFrom('greenfield_reactions').where('post_id', '=', resourceId).execute()
    await db.deleteFrom('notifications').where('resource_id', '=', resourceId).execute()
    await db.deleteFrom('posts').where('id', '=', resourceId).execute()
    await db.deleteFrom('actors').where('id', '=', secondActorId).execute()
    await db.deleteFrom('greenfield_accounts').where('account_id', '=', secondActorAccountId).execute()
  })

  it('suppresses generic and social notifications across a block in either direction', async () => {
    await db.insertInto('blocks').values({
      id: randomUUID(),
      blocker_actor_id: recipientActorId,
      blocked_actor_id: actorId,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      version: 1,
    }).execute()

    await handleNotificationCreate(db, {
      recipientActorId,
      actorId,
      type: 'mention',
      dedupeKey: 'blocked:generic',
      resourceId: 'blocked-generic',
    })
    await handleSocialNotification(db, 'reply', {
      recipientActorId,
      actorId,
      resourceType: 'post',
      resourceId: 'blocked-social',
    })

    const rows = await db.selectFrom('notifications').select('id')
      .where('recipient_actor_id', '=', recipientActorId)
      .where('resource_id', 'in', ['blocked-generic', 'blocked-social'])
      .execute()
    expect(rows).toHaveLength(0)
  })
})

async function seedActor(db: ModulaWorkerDb, accountId: string, actorId: string): Promise<void> {
  const now = new Date()
  await db
    .insertInto('greenfield_accounts')
    .values({
      account_id: accountId,
      primary_handle: `h${randomUUID().replace(/-/g, '').slice(0, 20)}`,
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
}

async function seedPreferences(db: ModulaWorkerDb, actorId: string): Promise<void> {
  const now = new Date()
  await db
    .insertInto('notification_preferences')
    .values({
      id: randomUUID(),
      actor_id: actorId,
      follow_enabled: true,
      like_enabled: true,
      reaction_enabled: true,
      repost_enabled: true,
      quote_enabled: true,
      reply_enabled: true,
      comment_enabled: true,
      mention_enabled: true,
      module_event_enabled: true,
      extension_enabled: true,
      in_app_enabled: true,
      email_enabled: true,
      web_push_enabled: false,
      frequency: 'immediate',
      digest_mode: false,
      quiet_hours: {},
      channel_preferences: {'in-app': true, email: true, 'web-push': false},
      category_preferences: {AI: true, social: true, module: true},
      module_preferences: {},
      connector_failure_enabled: true,
      ai_completion_enabled: true,
      automation_failure_enabled: true,
      dimon_transaction_confirmation_enabled: true,
      bundle_style: 'focus',
      created_at: now,
      updated_at: now,
      version: 1,
    })
    .execute()
}
