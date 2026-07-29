import {randomUUID} from 'node:crypto'
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

  it('uses the shared aggregate columns for burst social notifications', async () => {
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
    expect(row.aggregate_count).toBe(2)
    expect(row.body).toBe('2 people reacted to your post')
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
