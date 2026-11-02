import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {migrateUp} from '../../greenfield-api/src/database/migrate.js'
import {createDb, type ModulaWorkerDb} from '../src/database.js'
import {handleNotificationCreate} from '../src/notifications/create.js'
import type {ApnsRequest, ApnsResponse, PushSender} from '../src/push/apns.js'
import {PUSH_MAX_ATTEMPTS, runPushPass} from '../src/push/dispatch.js'

const testDatabaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeLive = testDatabaseUrl ? describe : describe.skip

class FakeSender implements PushSender {
  sent: ApnsRequest[] = []
  constructor(public respond: (request: ApnsRequest) => ApnsResponse = () => ({status: 200})) {}
  async send(request: ApnsRequest) {
    this.sent.push(request)
    return this.respond(request)
  }
  close() {}
}

describeLive('push dispatch (live Postgres)', () => {
  let db: ModulaWorkerDb
  const suffix = randomUUID()
  const recipientAccount = `push-acct-${suffix}`
  const recipient = `push-actor-${suffix}`
  const senderAccount = `push-sender-acct-${suffix}`
  const sender = `push-sender-${suffix}`
  const goodToken = 'a'.repeat(64)
  const deadToken = 'b'.repeat(64)

  beforeAll(async () => {
    await migrateUp(testDatabaseUrl as string)
    db = createDb(testDatabaseUrl as string)
    // runPushPass claims globally; start from an empty queue in the test database.
    await db.deleteFrom('push_deliveries').execute()
    for (const [account, actor] of [[recipientAccount, recipient], [senderAccount, sender]] as const) {
      const now = new Date()
      await db.insertInto('greenfield_accounts').values({account_id: account, primary_handle: `h${randomUUID().replace(/-/g, '').slice(0, 20)}`, status: 'active', created_at: now, updated_at: now} as any).execute()
      await db.insertInto('actors').values({id: actor, account_id: account, kind: 'person', created_at: now, updated_at: now, deleted_at: null, version: 1} as any).execute()
    }
    for (const token of [goodToken, deadToken]) {
      await db.insertInto('push_device_tokens').values({
        id: randomUUID(), account_id: recipientAccount, actor_id: recipient, token, platform: 'ios', environment: 'development',
        bundle_id: 'digital.modula.app.native', created_at: new Date(), updated_at: new Date(), last_seen_at: new Date(),
      } as any).execute()
    }
  })

  afterAll(async () => {
    if (!db) return
    await db.deleteFrom('push_deliveries').where('recipient_actor_id', '=', recipient).execute()
    await db.deleteFrom('push_device_tokens').where('actor_id', '=', recipient).execute()
    await db.deleteFrom('push_notification_preferences').where('actor_id', '=', recipient).execute()
    await db.deleteFrom('notifications').where('recipient_actor_id', '=', recipient).execute()
    await db.deleteFrom('actors').where('id', 'in', [recipient, sender]).execute()
    await db.deleteFrom('greenfield_accounts').where('account_id', 'in', [recipientAccount, senderAccount]).execute()
    await db.destroy()
  })

  it('enqueues from in-app notifications, sends, and prunes invalid tokens', async () => {
    await handleNotificationCreate(db, {recipientActorId: recipient, actorId: sender, type: 'like', resourceType: 'post', resourceId: 'post-1'})
    const queued = await db.selectFrom('push_deliveries').selectAll().where('recipient_actor_id', '=', recipient).execute()
    expect(queued).toHaveLength(1)
    expect(queued[0]!.category).toBe('likes')

    const apns = new FakeSender(request => request.token === deadToken ? {status: 410, reason: 'Unregistered'} : {status: 200})
    const result = await runPushPass(db, apns)
    expect(result).toMatchObject({sent: 1, prunedTokens: 1})
    const payload = apns.sent.find(s => s.token === goodToken)!.payload as any
    expect(payload.aps.badge).toBe(1)
    expect(payload.modula.deepLink).toBe('modula://post/post-1')
    const dead = await db.selectFrom('push_device_tokens').selectAll().where('token', '=', deadToken).executeTakeFirstOrThrow()
    expect(dead.disabled_at).not.toBeNull()
  })

  it('retries transient failures and dead-letters after max attempts', async () => {
    await db.deleteFrom('push_deliveries').where('recipient_actor_id', '=', recipient).execute()
    await handleNotificationCreate(db, {recipientActorId: recipient, actorId: sender, type: 'mention', resourceType: 'post', resourceId: 'post-2'})
    const apns = new FakeSender(() => ({status: 503, reason: 'ServiceUnavailable'}))
    let clock = Date.now()
    for (let i = 0; i < PUSH_MAX_ATTEMPTS; i++) {
      await runPushPass(db, apns, {now: () => new Date(clock)})
      clock += 2 * 60 * 60_000
    }
    const row = await db.selectFrom('push_deliveries').selectAll().where('recipient_actor_id', '=', recipient).executeTakeFirstOrThrow()
    expect(row.status).toBe('dead_letter')
    expect(row.attempts).toBe(PUSH_MAX_ATTEMPTS)
  })

  it('honours category toggles and defers during quiet hours', async () => {
    await db.deleteFrom('push_deliveries').where('recipient_actor_id', '=', recipient).execute()
    await db.insertInto('push_notification_preferences').values({actor_id: recipient, mentions_enabled: false, quiet_hours_enabled: true, quiet_hours_start: '00:00', quiet_hours_end: '23:59', timezone: 'UTC'} as any)
      .onConflict(oc => oc.column('actor_id').doUpdateSet({mentions_enabled: false, quiet_hours_enabled: true, quiet_hours_start: '00:00', quiet_hours_end: '23:59', timezone: 'UTC'} as any)).execute()
    await handleNotificationCreate(db, {recipientActorId: recipient, actorId: sender, type: 'mention', resourceType: 'post', resourceId: 'post-3', dedupeKey: `m-${randomUUID()}`})
    await handleNotificationCreate(db, {recipientActorId: recipient, actorId: sender, type: 'follow', resourceType: 'profile', resourceId: 'x', dedupeKey: `f-${randomUUID()}`})
    const apns = new FakeSender()
    const result = await runPushPass(db, apns, {now: () => new Date('2030-01-10T12:00:00Z')})
    expect(result).toMatchObject({suppressed: 1, deferred: 1, sent: 0})
    expect(apns.sent).toHaveLength(0)
    const deferred = await db.selectFrom('push_deliveries').selectAll().where('recipient_actor_id', '=', recipient).where('status', '=', 'queued').executeTakeFirstOrThrow()
    expect(deferred.attempts).toBe(0)
    expect(deferred.next_attempt_at.toISOString()).toBe('2030-01-10T23:59:00.000Z')
  })

  it('does nothing when APNs is not configured', async () => {
    expect((await runPushPass(db, null)).claimed).toBe(0)
  })
})
