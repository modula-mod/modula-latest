import {randomUUID} from 'node:crypto'
import {sql} from 'kysely'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {configureRegistryTestEnv, registerAccount} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb.sequential('API-FIX-01 follower approval lifecycle', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8)
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let requester: {accountId: string; token: string}
  let owner: {accountId: string; token: string}
  let outsider: {accountId: string; token: string}
  let requesterProfileId: string
  let ownerProfileId: string
  let ownerHandle: string
  let protectedPostId: string
  let requesterActorId: string
  let ownerActorId: string

  const auth = (token: string) => ({authorization: `Bearer ${token}`})

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!, '4072')
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    ownerHandle = `private${suffix}`
    requester = await registerAccount(app, `requester-${suffix}@example.com`, `request${suffix}`, db)
    owner = await registerAccount(app, `owner-${suffix}@example.com`, ownerHandle, db)
    outsider = await registerAccount(app, `outsider-${suffix}@example.com`, `outside${suffix}`, db)
    requesterActorId = `actor-${requester.accountId}`
    ownerActorId = `actor-${owner.accountId}`
    requesterProfileId = (await db.selectFrom('profiles').select('id').where('actor_id', '=', requesterActorId).executeTakeFirstOrThrow()).id
    const ownerProfile = await db.selectFrom('profiles').select(['id', 'version']).where('actor_id', '=', ownerActorId).executeTakeFirstOrThrow()
    ownerProfileId = ownerProfile.id
    const hidden = await app.inject({
      method: 'PATCH', url: '/v1/profiles/me', headers: auth(owner.token),
      payload: {visibility: 'followers', expectedVersion: ownerProfile.version},
    })
    expect(hidden.statusCode, hidden.body).toBe(200)
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('keeps pending requests out of visibility and counters until an idempotent owner acceptance', async () => {
    const protectedPost = await app.inject({
      method: 'POST', url: '/v1/posts', headers: auth(owner.token),
      payload: {text: 'followers-only API-FIX-01 fixture', audience: 'followers', idempotencyKey: `follow-private-${suffix}`},
    })
    expect(protectedPost.statusCode, protectedPost.body).toBe(201)
    const postId = protectedPost.json().data.id as string
    protectedPostId = postId
    const ownerBefore = await app.inject({method: 'GET', url: `/v1/profiles/${ownerHandle}`, headers: auth(owner.token)})
    const followerCountBefore = ownerBefore.json().data.followerCount as number

    const [first, duplicate] = await Promise.all([
      app.inject({method: 'POST', url: `/v1/profiles/${ownerProfileId}/follow`, headers: auth(requester.token)}),
      app.inject({method: 'POST', url: `/v1/profiles/${ownerProfileId}/follow`, headers: auth(requester.token)}),
    ])
    expect(first.statusCode, first.body).toBe(200)
    expect(duplicate.statusCode, duplicate.body).toBe(200)
    expect(first.json().data).toMatchObject({relationship: 'pending', following: false, pending: true})
    expect(duplicate.json().data.requestId).toBe(first.json().data.requestId)
    const requestId = first.json().data.requestId as string
    expect(await activeFollowCount()).toBe(0)
    expect(await pendingRequestCount()).toBe(1)
    expect((await app.inject({method: 'GET', url: `/v1/profiles/${ownerHandle}`, headers: auth(requester.token)})).statusCode).toBe(404)
    expect((await app.inject({method: 'GET', url: `/v1/posts/${postId}`, headers: auth(requester.token)})).statusCode).toBe(404)
    const ownerPending = await app.inject({method: 'GET', url: `/v1/profiles/${ownerHandle}`, headers: auth(owner.token)})
    expect(ownerPending.json().data.followerCount).toBe(followerCountBefore)

    for (const attempt of [
      app.inject({method: 'POST', url: `/v1/follow-requests/${requestId}/accept`, headers: auth(outsider.token)}),
      app.inject({method: 'POST', url: `/v1/follow-requests/${requestId}/reject`, headers: auth(outsider.token)}),
      app.inject({method: 'DELETE', url: `/v1/follow-requests/${requestId}`, headers: auth(outsider.token)}),
    ]) {
      const response = await attempt
      expect(response.statusCode, response.body).toBe(404)
    }

    const incoming = await app.inject({method: 'GET', url: '/v1/profiles/me/follow-requests', headers: auth(owner.token)})
    expect(incoming.statusCode, incoming.body).toBe(200)
    expect(incoming.json().data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({requestId, requester: expect.objectContaining({id: requesterProfileId})}),
    ]))
    expect((await app.inject({
      method: 'GET', url: '/v1/profiles/me/follow-requests?limit=0', headers: auth(owner.token),
    })).statusCode).toBe(400)
    expect((await app.inject({
      method: 'GET', url: `/v1/profiles/me/follow-requests?cursor=${'x'.repeat(201)}`, headers: auth(owner.token),
    })).statusCode).toBe(400)
    expect((await app.inject({
      method: 'POST', url: '/v1/follow-requests/not-a-uuid/accept', headers: auth(owner.token),
    })).statusCode).toBe(400)

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const accepted = await app.inject({method: 'POST', url: `/v1/follow-requests/${requestId}/accept`, headers: auth(owner.token)})
      expect(accepted.statusCode, accepted.body).toBe(200)
      expect(accepted.json().data).toMatchObject({relationship: 'following', following: true, pending: false})
    }
    expect(await activeFollowCount()).toBe(1)
    expect((await app.inject({method: 'GET', url: `/v1/profiles/${ownerHandle}`, headers: auth(requester.token)})).statusCode).toBe(200)
    expect((await app.inject({method: 'GET', url: `/v1/posts/${postId}`, headers: auth(requester.token)})).statusCode).toBe(200)
    const ownerAccepted = await app.inject({method: 'GET', url: `/v1/profiles/${ownerHandle}`, headers: auth(owner.token)})
    expect(ownerAccepted.json().data.followerCount).toBe(followerCountBefore + 1)
  })

  it('revokes comment thread, reaction and poll access when a former follower becomes pending again', async () => {
    const comment = await app.inject({
      method: 'POST', url: `/v1/posts/${protectedPostId}/comments`, headers: auth(requester.token),
      payload: {
        text: 'former follower comment',
        media: [{type: 'poll', question: 'Still visible?', options: ['Yes', 'No']}],
      },
    })
    expect(comment.statusCode, comment.body).toBe(201)
    const commentId = comment.json().data.comment_id as string
    const reply = await app.inject({
      method: 'POST', url: `/v1/comments/${commentId}/replies`, headers: auth(owner.token),
      payload: {text: 'private reply'},
    })
    expect(reply.statusCode, reply.body).toBe(201)

    await unfollowTwice()
    await requestFollow()
    expect(await activeFollowCount()).toBe(0)
    expect(await pendingRequestCount()).toBe(1)

    for (const response of await Promise.all([
      app.inject({method: 'GET', url: `/v1/posts/${protectedPostId}/comments`, headers: auth(requester.token)}),
      app.inject({method: 'GET', url: `/v1/comments/${commentId}/replies`, headers: auth(requester.token)}),
      app.inject({method: 'POST', url: `/v1/comments/${commentId}/replies`, headers: auth(requester.token), payload: {text: 'must fail'}}),
      app.inject({method: 'PUT', url: `/v1/comments/${commentId}/reaction`, headers: auth(requester.token), payload: {type: 'like'}}),
      app.inject({method: 'PUT', url: `/v1/comments/${commentId}/poll/vote`, headers: auth(requester.token), payload: {optionIndex: 0}}),
    ])) {
      expect(response.statusCode, response.body).toBe(403)
    }
  })

  it('makes cancel, reject and accept races deterministic without double relationships', async () => {
    await unfollowTwice()
    let requestId = await requestFollow()
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const cancelled = await app.inject({method: 'DELETE', url: `/v1/follow-requests/${requestId}`, headers: auth(requester.token)})
      expect(cancelled.statusCode, cancelled.body).toBe(200)
      expect(cancelled.json().data.relationship).toBe('none')
    }
    expect(await activeFollowCount()).toBe(0)

    requestId = await requestFollow()
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const rejected = await app.inject({method: 'POST', url: `/v1/follow-requests/${requestId}/reject`, headers: auth(owner.token)})
      expect(rejected.statusCode, rejected.body).toBe(200)
      expect(rejected.json().data.relationship).toBe('none')
    }
    expect(await activeFollowCount()).toBe(0)

    requestId = await requestFollow()
    const requestJobs = await db.selectFrom('background_jobs')
      .select('payload')
      .where('job_type', '=', 'notification.create')
      .execute()
    const requestedKeys = requestJobs
      .map(job => job.payload as Record<string, unknown>)
      .filter(payload => payload.aggregateId === requestId && typeof payload.dedupeKey === 'string')
      .map(payload => String(payload.dedupeKey))
      .filter(key => key.endsWith(':requested'))
    // Cancelling or rejecting and then requesting again is a new notification,
    // while a retry of the same outbox event keeps its original key.
    expect(new Set(requestedKeys).size).toBeGreaterThanOrEqual(3)
    const race = await Promise.all([
      app.inject({method: 'POST', url: `/v1/follow-requests/${requestId}/accept`, headers: auth(owner.token)}),
      app.inject({method: 'DELETE', url: `/v1/follow-requests/${requestId}`, headers: auth(requester.token)}),
    ])
    expect(race.map(response => response.statusCode).sort()).toEqual([200, 409])
    const state = await db.selectFrom('follow_requests').select('status').where('request_id', '=', requestId).executeTakeFirstOrThrow()
    expect(await activeFollowCount()).toBe(state.status === 'ACCEPTED' ? 1 : 0)
  })

  it('gives block precedence over pending or accepted relationships and does not restore them on unblock', async () => {
    await unfollowTwice()
    const requestId = await requestFollow()
    const [accepted, blocked] = await Promise.all([
      app.inject({method: 'POST', url: `/v1/follow-requests/${requestId}/accept`, headers: auth(owner.token)}),
      app.inject({method: 'POST', url: `/v1/profiles/${ownerProfileId}/block`, headers: auth(requester.token)}),
    ])
    expect(blocked.statusCode, blocked.body).toBe(200)
    expect([200, 404, 409]).toContain(accepted.statusCode)
    expect(await activeFollowCount()).toBe(0)
    expect((await db.selectFrom('follow_requests').select('status').where('request_id', '=', requestId).executeTakeFirstOrThrow()).status).toBe('CANCELLED')
    expect((await app.inject({method: 'POST', url: `/v1/profiles/${ownerProfileId}/follow`, headers: auth(requester.token)})).statusCode).toBe(404)

    const unblocked = await app.inject({method: 'DELETE', url: `/v1/profiles/${ownerProfileId}/block`, headers: auth(requester.token)})
    expect(unblocked.statusCode, unblocked.body).toBe(200)
    expect(await activeFollowCount()).toBe(0)
    expect((await requestFollow())).toBe(requestId)
  })

  it('gives each public follow activation a stable retry identity', async () => {
    await unfollowTwice()
    const current = await db.selectFrom('profiles').select('version').where('id', '=', ownerProfileId).executeTakeFirstOrThrow()
    const madePublic = await app.inject({
      method: 'PATCH', url: '/v1/profiles/me', headers: auth(owner.token),
      payload: {visibility: 'public', expectedVersion: current.version},
    })
    expect(madePublic.statusCode, madePublic.body).toBe(200)

    const dedupeKeys: string[] = []
    for (let activation = 0; activation < 2; activation += 1) {
      const followed = await app.inject({
        method: 'POST', url: `/v1/profiles/${ownerProfileId}/follow`, headers: auth(requester.token),
      })
      expect(followed.statusCode, followed.body).toBe(200)
      expect(followed.json().data).toMatchObject({relationship: 'following', following: true, pending: false})
      const job = await db.selectFrom('background_jobs').select('payload')
        .where('job_type', '=', 'notification.create')
        .where(sql<boolean>`payload->>'actorId' = ${requesterActorId}`)
        .where(sql<boolean>`payload->>'recipientActorId' = ${ownerActorId}`)
        .orderBy('created_at', 'desc').executeTakeFirstOrThrow()
      const dedupeKey = (job.payload as Record<string, unknown>).dedupeKey
      expect(dedupeKey).toEqual(expect.stringMatching(/^follow:.+:v\d+$/))
      dedupeKeys.push(String(dedupeKey))
      await unfollowTwice()
    }
    expect(new Set(dedupeKeys).size).toBe(2)
  })

  async function requestFollow(): Promise<string> {
    const response = await app.inject({method: 'POST', url: `/v1/profiles/${ownerProfileId}/follow`, headers: auth(requester.token)})
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json().data).toMatchObject({relationship: 'pending', following: false, pending: true})
    return response.json().data.requestId as string
  }

  async function unfollowTwice(): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await app.inject({method: 'DELETE', url: `/v1/profiles/${ownerProfileId}/follow`, headers: auth(requester.token)})
      expect(response.statusCode, response.body).toBe(200)
    }
    expect(await activeFollowCount()).toBe(0)
  }

  async function activeFollowCount(): Promise<number> {
    const row = await db.selectFrom('follows').select(({fn}) => fn.countAll<number>().as('count'))
      .where('follower_actor_id', '=', requesterActorId)
      .where('followed_actor_id', '=', ownerActorId)
      .where('deleted_at', 'is', null).executeTakeFirstOrThrow()
    return Number(row.count)
  }

  async function pendingRequestCount(): Promise<number> {
    const row = await db.selectFrom('follow_requests').select(({fn}) => fn.countAll<number>().as('count'))
      .where('requester_actor_id', '=', requesterActorId)
      .where('target_actor_id', '=', ownerActorId)
      .where('status', '=', 'PENDING').executeTakeFirstOrThrow()
    return Number(row.count)
  }
})
