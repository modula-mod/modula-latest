import {randomUUID} from 'node:crypto'

import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {handleNotificationCreate} from '../../greenfield-worker/src/notifications/create.js'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldDomainEventRepository} from '../src/events/domain-events.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='

describeIfDb('Story replies into direct messages', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let runSuffix = ''

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4032'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4032'
    process.env.MODULA_DATABASE_URL = databaseUrl!
    process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
    process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
    process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
    process.env.MODULA_INVITE_ONLY = 'true'
    process.env.MODULA_REGISTRATION_INVITE_CODES = 'test-invite'
    process.env.MODULA_ATPROTO_ENABLED = 'false'
    process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
    process.env.MODULA_MEDIA_ROOT = `/tmp/modula-story-replies-${process.pid}`
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()
    await app.ready()
    runSuffix = Date.now().toString(36)
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  it('persists one ordinary DM, private context event and idempotent notification under concurrent retries', async () => {
    const owner = await createVerifiedUser(`sro${runSuffix}`.slice(0, 20), 'Story Reply Owner')
    const replier = await createVerifiedUser(`srr${runSuffix}`.slice(0, 20), 'Story Reply Sender')
    const story = await createStory(owner.accessToken, 'followers')

    const hidden = await authed(replier.accessToken, 'POST', `/v1/stories/${story.itemId}/replies`, {
      text: 'Before follow', idempotencyKey: `hidden-${runSuffix}`,
    })
    expect(hidden.statusCode).toBe(404)
    expect(hidden.json().error.code).toBe('NOT_FOUND')

    const followed = await authed(replier.accessToken, 'POST', `/v1/profiles/${owner.profileId}/follow`)
    expect(followed.statusCode).toBe(200)
    const subscriberId = `story-reply-test-${runSuffix}`
    await new GreenfieldDomainEventRepository(db).registerSubscription({
      eventType: 'message.story-replied',
      subscriberId,
      targetType: 'internal-subscriber',
      targetKey: 'story-reply-test',
      permittedVisibility: ['actor'],
      permittedClassifications: ['private'],
    })

    const idempotencyKey = `story-reply-${runSuffix}`
    const request = {text: 'This lands in your direct messages.', idempotencyKey}
    const responses = await Promise.all(
      Array.from({length: 12}, () => authed(
        replier.accessToken, 'POST', `/v1/stories/${story.itemId}/replies`, request,
      )),
    )
    expect(responses.map(response => response.statusCode).sort()).toEqual([
      200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 201,
    ])
    expect(responses.filter(response => response.json().data.created)).toHaveLength(1)
    const conversationIds = new Set(responses.map(response => response.json().data.conversationId))
    const messageIds = new Set(responses.map(response => response.json().data.messageId))
    expect(conversationIds.size).toBe(1)
    expect(messageIds.size).toBe(1)
    const [conversationId] = conversationIds
    const [messageId] = messageIds

    expect(await db.selectFrom('greenfield_conversation_messages').selectAll()
      .where('message_id', '=', messageId!).execute()).toHaveLength(1)
    const directKey = [owner.actorId, replier.actorId].sort().join(':')
    expect(await db.selectFrom('greenfield_conversations').selectAll()
      .where('direct_key', '=', directKey).execute()).toHaveLength(1)
    const events = await db.selectFrom('greenfield_domain_events').selectAll()
      .where('event_type', '=', 'message.story-replied')
      .where('aggregate_id', '=', messageId!).execute()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({visibility: 'actor', classification: 'private'})
    expect(await db.selectFrom('greenfield_event_deliveries').selectAll()
      .where('event_id', '=', events[0]!.event_id).where('subscriber_id', '=', subscriberId).execute()).toHaveLength(1)
    const outbox = await db.selectFrom('outbox_events').selectAll()
      .where('event_type', '=', 'notification.create').where('aggregate_id', '=', messageId!).execute()
    expect(outbox).toHaveLength(1)
    const jobs = (await db.selectFrom('background_jobs').selectAll()
      .where('job_type', '=', 'notification.create').execute())
      .filter(job => (job.payload as {aggregateId?: unknown}).aggregateId === messageId)
    expect(jobs).toHaveLength(1)

    const senderThread = await authed(
      replier.accessToken, 'GET', `/v1/conversations/${conversationId}/messages`,
    )
    expect(senderThread.statusCode).toBe(200)
    expect(senderThread.json().data.items).toHaveLength(1)
    expect(senderThread.json().data.items[0]).toMatchObject({
      id: messageId,
      body: request.text,
      isOwn: true,
      storyContext: {
        type: 'story', storyId: story.itemId, groupId: story.groupId,
        ownerActorId: owner.actorId, mediaKind: 'image',
      },
    })
    expect(Object.keys(senderThread.json().data.items[0].storyContext).sort()).toEqual([
      'createdAt', 'expiresAt', 'groupId', 'mediaKind', 'ownerActorId', 'storyId', 'type',
    ])
    const requests = await authed(owner.accessToken, 'GET', '/v1/message-requests')
    expect(requests.json().data.items).toHaveLength(1)
    expect(requests.json().data.items[0]).toMatchObject({conversationId, preview: request.text})

    await handleNotificationCreate(db as any, jobs[0]!.payload)
    await handleNotificationCreate(db as any, jobs[0]!.payload)
    const notifications = await db.selectFrom('notifications').selectAll()
      .where('recipient_actor_id', '=', owner.actorId)
      .where('dedupe_key', '=', `story-reply:${messageId}`).execute()
    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toMatchObject({aggregate_count: 1, resource_id: conversationId})

    const mismatch = await authed(replier.accessToken, 'POST', `/v1/stories/${story.itemId}/replies`, {
      ...request, text: 'A different payload',
    })
    expect(mismatch.statusCode).toBe(409)
    expect(mismatch.json().error.code).toBe('CONFLICT')

    const deleted = await authed(owner.accessToken, 'DELETE', `/v1/stories/items/${story.itemId}`)
    expect(deleted.statusCode).toBe(200)
    const replayAfterDeletion = await authed(
      replier.accessToken, 'POST', `/v1/stories/${story.itemId}/replies`, request,
    )
    expect(replayAfterDeletion.statusCode).toBe(200)
    expect(replayAfterDeletion.json().data).toMatchObject({conversationId, messageId, created: false})
    const preserved = await authed(owner.accessToken, 'GET', `/v1/conversations/${conversationId}/messages`)
    expect(preserved.json().data.items[0]).toMatchObject({body: request.text, storyContext: {storyId: story.itemId}})
  })

  it('reuses an existing active conversation and keeps the reply as a normal message', async () => {
    const suffix = `${runSuffix}${Math.random().toString(36).slice(2, 7)}`
    const owner = await createVerifiedUser(`seoa${suffix}`.slice(0, 20), 'Existing Story Owner')
    const replier = await createVerifiedUser(`sera${suffix}`.slice(0, 20), 'Existing Story Replier')
    expect((await authed(replier.accessToken, 'POST', `/v1/profiles/${owner.profileId}/follow`)).statusCode).toBe(200)
    expect((await authed(owner.accessToken, 'POST', `/v1/profiles/${replier.profileId}/follow`)).statusCode).toBe(200)
    const started = await authed(replier.accessToken, 'POST', '/v1/conversations', {
      handle: owner.handle, text: 'Existing conversation',
    })
    expect(started.statusCode).toBe(201)
    const conversationId = started.json().data.conversation.id
    const story = await createStory(owner.accessToken, 'followers')
    const reply = await authed(replier.accessToken, 'POST', `/v1/stories/${story.itemId}/replies`, {
      text: 'Reply in the same thread', idempotencyKey: `existing-${suffix}`,
    })
    expect(reply.statusCode).toBe(201)
    expect(reply.json().data).toMatchObject({conversationId, conversationCreated: false, created: true})
    const thread = await authed(replier.accessToken, 'GET', `/v1/conversations/${conversationId}/messages`)
    expect(thread.json().data.items.map((item: any) => item.body)).toEqual([
      'Existing conversation', 'Reply in the same thread',
    ])
    expect(thread.json().data.items[0].storyContext).toBeUndefined()
    expect(thread.json().data.items[1].storyContext.storyId).toBe(story.itemId)
  })

  it('fails closed for malformed, self, expired, blocked and declined-recipient replies', async () => {
    const suffix = `${runSuffix}${Math.random().toString(36).slice(2, 7)}`
    const owner = await createVerifiedUser(`scoa${suffix}`.slice(0, 20), 'Story Security Owner')
    const replier = await createVerifiedUser(`scra${suffix}`.slice(0, 20), 'Story Security Replier')
    const story = await createStory(owner.accessToken, 'followers')

    const noAuth = await app.inject({
      method: 'POST', url: `/v1/stories/${story.itemId}/replies`,
      payload: {text: 'No auth', idempotencyKey: `no-auth-${suffix}`},
    })
    expect(noAuth.statusCode).toBe(401)
    const missingKey = await authed(replier.accessToken, 'POST', `/v1/stories/${story.itemId}/replies`, {text: 'Missing'})
    expect(missingKey.statusCode).toBe(400)
    const forged = await authed(replier.accessToken, 'POST', `/v1/stories/${story.itemId}/replies`, {
      text: 'Forged', idempotencyKey: `forged-${suffix}`, recipientActorId: owner.actorId,
    })
    expect(forged.statusCode).toBe(400)
    const guessed = await authed(replier.accessToken, 'POST', `/v1/stories/${randomUUID()}/replies`, {
      text: 'Guessed', idempotencyKey: `guessed-${suffix}`,
    })
    expect(guessed.statusCode).toBe(404)
    const hidden = await authed(replier.accessToken, 'POST', `/v1/stories/${story.itemId}/replies`, {
      text: 'Hidden', idempotencyKey: `private-${suffix}`,
    })
    expect(hidden.statusCode).toBe(404)
    const own = await authed(owner.accessToken, 'POST', `/v1/stories/${story.itemId}/replies`, {
      text: 'Own', idempotencyKey: `own-${suffix}`,
    })
    expect(own.statusCode).toBe(400)

    expect((await authed(replier.accessToken, 'POST', `/v1/profiles/${owner.profileId}/follow`)).statusCode).toBe(200)
    expect((await authed(owner.accessToken, 'POST', `/v1/profiles/${replier.profileId}/block`)).statusCode).toBe(200)
    const blocked = await authed(replier.accessToken, 'POST', `/v1/stories/${story.itemId}/replies`, {
      text: 'Blocked', idempotencyKey: `blocked-${suffix}`,
    })
    expect(blocked.statusCode).toBe(404)
    expect((await authed(owner.accessToken, 'DELETE', `/v1/profiles/${replier.profileId}/block`)).statusCode).toBe(200)
    expect((await authed(replier.accessToken, 'POST', `/v1/profiles/${owner.profileId}/follow`)).statusCode).toBe(200)

    const start = await authed(replier.accessToken, 'POST', '/v1/conversations', {handle: owner.handle})
    expect(start.statusCode).toBe(201)
    const conversationId = start.json().data.conversation.id
    expect((await authed(owner.accessToken, 'POST', `/v1/message-requests/${conversationId}/decline`, {})).statusCode).toBe(200)
    const declined = await authed(replier.accessToken, 'POST', `/v1/stories/${story.itemId}/replies`, {
      text: 'Declined', idempotencyKey: `declined-${suffix}`,
    })
    expect(declined.statusCode).toBe(403)
    expect(await db.selectFrom('greenfield_conversation_messages').selectAll()
      .where('conversation_id', '=', conversationId).execute()).toHaveLength(0)

    await db.updateTable('greenfield_story_groups').set({expires_at: new Date(Date.now() - 1_000)})
      .where('group_id', '=', story.groupId).execute()
    const expired = await authed(replier.accessToken, 'POST', `/v1/stories/${story.itemId}/replies`, {
      text: 'Expired', idempotencyKey: `expired-${suffix}`,
    })
    expect(expired.statusCode).toBe(404)
  })

  async function createStory(accessToken: string, visibility: 'public' | 'followers') {
    const created = await authed(accessToken, 'POST', '/v1/stories', {
      mediaKind: 'image', contentType: 'image/png', base64: PIXEL,
      caption: `Story reply fixture ${runSuffix}`, visibility, width: 1, height: 1,
    })
    expect(created.statusCode, created.body).toBe(201)
    return {
      groupId: created.json().data.groupId as string,
      itemId: created.json().data.items[0].itemId as string,
    }
  }

  async function createVerifiedUser(handle: string, displayName: string) {
    const password = 'secure-pass-word-1'
    const email = `${handle}@example.com`
    await db.deleteFrom('greenfield_auth_rate_limits').execute()
    const register = await app.inject({
      method: 'POST', url: '/v1/accounts/register',
      payload: {email, password, handle, displayName, acceptedTerms: true, inviteCode: 'test-invite'},
    })
    expect(register.statusCode).toBe(201)
    const verified = await app.inject({
      method: 'POST', url: '/v1/accounts/verify-email',
      payload: {token: register.json().data.verificationToken},
    })
    expect(verified.statusCode).toBe(200)
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect([200, 201]).toContain(session.statusCode)
    const accessToken = session.json().data.accessToken
    const me = await app.inject({
      method: 'GET', url: '/v1/accounts/me', headers: {authorization: `Bearer ${accessToken}`},
    })
    const accountId = me.json().data.accountId
    const profile = await db.selectFrom('actors').innerJoin('profiles', 'profiles.actor_id', 'actors.id')
      .select(['profiles.id as profile_id', 'actors.id as actor_id'])
      .where('actors.account_id', '=', accountId).executeTakeFirstOrThrow()
    return {accountId, actorId: profile.actor_id, profileId: profile.profile_id, handle, accessToken}
  }

  async function authed(accessToken: string, method: string, url: string, payload?: unknown) {
    return app.inject({
      method: method as any, url, headers: {authorization: `Bearer ${accessToken}`},
      ...(payload === undefined ? {} : {payload}),
    })
  }
})
