import {rm} from 'node:fs/promises'

import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {createServer} from '../src/app/create-server.js'
import {loadConfig} from '../src/config/env.js'
import {migrateUp} from '../src/database/migrate.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('GreenField Saved collections and post drafts', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let runSuffix = ''
  const mediaRoot = `/tmp/modula-collections-drafts-${process.pid}`

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4035'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4035'
    process.env.MODULA_DATABASE_URL = databaseUrl!
    process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
    process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
    process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
    process.env.MODULA_INVITE_ONLY = 'true'
    process.env.MODULA_REGISTRATION_INVITE_CODES = 'test-invite'
    process.env.MODULA_ATPROTO_ENABLED = 'false'
    process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
    process.env.MODULA_MEDIA_ROOT = mediaRoot
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await db.deleteFrom('greenfield_auth_rate_limits').execute()
    await app.ready()
    runSuffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
    await rm(mediaRoot, {recursive: true, force: true})
  })

  it('persists named collections over existing saves with pagination, isolation and idempotent additions', async () => {
    const owner = await createVerifiedUser(`coll${runSuffix}`.slice(0, 20), 'Collection Owner')
    const outsider = await createVerifiedUser(`cout${runSuffix}`.slice(0, 20), 'Collection Outsider')
    const firstPost = await createPost(owner.accessToken, 'First saved post', `saved-one-${runSuffix}`)
    const secondPost = await createPost(owner.accessToken, 'Second saved post', `saved-two-${runSuffix}`)
    expect((await authed(owner.accessToken, 'POST', `/v1/posts/${firstPost}/save`)).statusCode).toBe(200)
    expect((await authed(owner.accessToken, 'POST', `/v1/posts/${secondPost}/save`)).statusCode).toBe(200)

    const savesPage1 = await authed(owner.accessToken, 'GET', '/v1/saves?limit=1')
    expect(savesPage1.statusCode, savesPage1.body).toBe(200)
    expect(savesPage1.json().data).toMatchObject({hasMore: true})
    expect(savesPage1.json().data.items).toHaveLength(1)
    const savesPage2 = await authed(owner.accessToken, 'GET', `/v1/saves?limit=1&cursor=${encodeURIComponent(savesPage1.json().data.nextCursor)}`)
    expect(savesPage2.statusCode).toBe(200)
    expect(savesPage2.json().data.items[0].id).not.toBe(savesPage1.json().data.items[0].id)

    const created = await authed(owner.accessToken, 'POST', '/v1/me/collections', {name: 'Research'})
    expect(created.statusCode, created.body).toBe(201)
    const collectionId = created.json().data.collection.id as string
    const additions = await Promise.all(Array.from({length: 10}, () => authed(
      owner.accessToken, 'POST', `/v1/me/collections/${collectionId}/items`, {postId: firstPost},
    )))
    expect(additions.every(response => [200, 201].includes(response.statusCode))).toBe(true)
    expect(new Set(additions.map(response => response.json().data.item.id)).size).toBe(1)
    expect(await db.selectFrom('greenfield_saved_collection_items').selectAll()
      .where('collection_id', '=', collectionId).where('deleted_at', 'is', null).execute()).toHaveLength(1)

    const secondAdd = await authed(owner.accessToken, 'POST', `/v1/me/collections/${collectionId}/items`, {postId: secondPost})
    expect(secondAdd.statusCode).toBe(201)
    const itemPage1 = await authed(owner.accessToken, 'GET', `/v1/me/collections/${collectionId}/items?limit=1`)
    expect(itemPage1.json().data).toMatchObject({hasMore: true})
    const itemPage2 = await authed(owner.accessToken, 'GET',
      `/v1/me/collections/${collectionId}/items?limit=1&cursor=${encodeURIComponent(itemPage1.json().data.nextCursor)}`)
    expect(itemPage2.json().data.items[0].id).not.toBe(itemPage1.json().data.items[0].id)
    expect((await authed(outsider.accessToken, 'GET', `/v1/me/collections/${collectionId}`)).statusCode).toBe(404)
    expect((await authed(outsider.accessToken, 'POST', `/v1/me/collections/${collectionId}/items`, {postId: firstPost})).statusCode).toBe(404)

    await authed(owner.accessToken, 'DELETE', `/v1/posts/${firstPost}/save`)
    const unavailable = await authed(owner.accessToken, 'GET', `/v1/me/collections/${collectionId}/items?limit=10`)
    const firstItem = unavailable.json().data.items.find((item: any) => item.postId === firstPost)
    expect(firstItem).toMatchObject({available: false, post: null})
    const collection = await authed(owner.accessToken, 'GET', `/v1/me/collections/${collectionId}`)
    expect(collection.json().data.collection.itemCount).toBe(2)
    const deleted = await authed(owner.accessToken, 'DELETE',
      `/v1/me/collections/${collectionId}?expectedVersion=${collection.json().data.collection.version}`)
    expect(deleted.statusCode, deleted.body).toBe(200)
    expect(await db.selectFrom('posts').select('id').where('id', 'in', [firstPost, secondPost]).execute()).toHaveLength(2)
    expect(await db.selectFrom('post_saves').selectAll().where('actor_id', '=', owner.actorId).execute()).toHaveLength(2)
  })

  it('detects two-device draft conflicts and publishes exactly once under concurrent retries', async () => {
    const owner = await createVerifiedUser(`draft${runSuffix}`.slice(0, 20), 'Draft Owner')
    const created = await authed(owner.accessToken, 'POST', '/v1/me/drafts', {
      idempotencyKey: `draft-create-${runSuffix}`, text: 'Initial draft', audience: 'followers', replyPermission: 'followers',
    })
    expect(created.statusCode, created.body).toBe(201)
    const draftId = created.json().data.draft.id as string
    const replay = await authed(owner.accessToken, 'POST', '/v1/me/drafts', {
      idempotencyKey: `draft-create-${runSuffix}`, text: 'Initial draft', audience: 'followers', replyPermission: 'followers',
    })
    expect(replay.statusCode).toBe(200)
    expect(replay.json().data.draft.id).toBe(draftId)
    const mismatchedReplay = await authed(owner.accessToken, 'POST', '/v1/me/drafts', {
      idempotencyKey: `draft-create-${runSuffix}`, text: 'Different content',
    })
    expect(mismatchedReplay.statusCode).toBe(409)

    const deviceOne = await authed(owner.accessToken, 'PATCH', `/v1/me/drafts/${draftId}`, {
      expectedVersion: 1, text: 'Updated on device one', audience: 'private',
    })
    expect(deviceOne.statusCode, deviceOne.body).toBe(200)
    expect(deviceOne.json().data.draft).toMatchObject({version: 2, text: 'Updated on device one', audience: 'private'})
    const staleDevice = await authed(owner.accessToken, 'PATCH', `/v1/me/drafts/${draftId}`, {
      expectedVersion: 1, text: 'Stale device overwrite',
    })
    expect(staleDevice.statusCode).toBe(409)

    const publishes = await Promise.all(Array.from({length: 10}, () => authed(
      owner.accessToken, 'POST', `/v1/me/drafts/${draftId}/publish`, {expectedVersion: 2},
    )))
    expect(publishes.every(response => [200, 201].includes(response.statusCode))).toBe(true)
    const postIds = new Set(publishes.map(response => response.json().data.postId))
    expect(postIds.size).toBe(1)
    const postId = [...postIds][0] as string
    expect(await db.selectFrom('posts').selectAll().where('author_actor_id', '=', owner.actorId)
      .where('idempotency_key', '=', `draft-publish:${draftId}`).execute()).toHaveLength(1)
    const published = await authed(owner.accessToken, 'GET', `/v1/me/drafts/${draftId}`)
    expect(published.json().data.draft).toMatchObject({state: 'published', publishedPostId: postId, version: 3})
    expect((await authed(owner.accessToken, 'PATCH', `/v1/me/drafts/${draftId}`, {
      expectedVersion: 3, text: 'Cannot edit published draft',
    })).statusCode).toBe(409)
  })

  it('reserves attachment ownership and leaves failed publication recoverable', async () => {
    const owner = await createVerifiedUser(`media${runSuffix}`.slice(0, 20), 'Media Draft Owner')
    const outsider = await createVerifiedUser(`mout${runSuffix}`.slice(0, 20), 'Media Draft Outsider')
    const attachmentId = await createReadyImage(owner.accessToken, `draft-${runSuffix}.png`)
    const crossAccount = await authed(outsider.accessToken, 'POST', '/v1/me/drafts', {
      text: '', content: [{type: 'image', attachmentId}],
    })
    expect(crossAccount.statusCode).toBe(403)
    const created = await authed(owner.accessToken, 'POST', '/v1/me/drafts', {
      text: 'Draft with real media', content: [{type: 'image', attachmentId, caption: 'QA image'}],
    })
    expect(created.statusCode, created.body).toBe(201)
    const draftId = created.json().data.draft.id as string
    expect((await authed(owner.accessToken, 'DELETE', `/v1/attachments/${attachmentId}`)).statusCode).toBe(409)
    expect((await authed(owner.accessToken, 'POST', '/v1/posts', {
      text: 'Cannot steal reserved media', content: [{type: 'image', attachmentId}],
    })).statusCode).toBe(409)

    await db.updateTable('attachments').set({status: 'failed'}).where('attachment_id', '=', attachmentId).execute()
    const failed = await authed(owner.accessToken, 'POST', `/v1/me/drafts/${draftId}/publish`, {expectedVersion: 1})
    expect(failed.statusCode).toBe(409)
    const recoverable = await authed(owner.accessToken, 'GET', `/v1/me/drafts/${draftId}`)
    expect(recoverable.json().data.draft).toMatchObject({state: 'editing', version: 1, publishedPostId: null})
    await db.updateTable('attachments').set({status: 'ready'}).where('attachment_id', '=', attachmentId).execute()
    const publishes = await Promise.all(Array.from({length: 8}, () => authed(
      owner.accessToken, 'POST', `/v1/me/drafts/${draftId}/publish`, {expectedVersion: 1},
    )))
    expect(publishes.every(response => [200, 201].includes(response.statusCode))).toBe(true)
    expect(new Set(publishes.map(response => response.json().data.postId)).size).toBe(1)
    expect(publishes[0]!.json().data.draft.state).toBe('published')
  })

  it('rejects unauthenticated access and unknown ownership fields', async () => {
    expect((await app.inject({method: 'GET', url: '/v1/me/collections'})).statusCode).toBe(401)
    expect((await app.inject({method: 'GET', url: '/v1/me/drafts'})).statusCode).toBe(401)
    const owner = await createVerifiedUser(`safe${runSuffix}`.slice(0, 20), 'Security Draft Owner')
    const forgedCollection = await authed(owner.accessToken, 'POST', '/v1/me/collections', {
      name: 'Forged', ownerActorId: owner.actorId,
    })
    expect(forgedCollection.statusCode).toBe(400)
    const forgedDraft = await authed(owner.accessToken, 'POST', '/v1/me/drafts', {
      text: 'Forged draft', ownerActorId: owner.actorId, state: 'published', publishedPostId: 'forged',
    })
    expect(forgedDraft.statusCode).toBe(400)
  })

  async function createPost(accessToken: string, text: string, idempotencyKey: string): Promise<string> {
    const response = await authed(accessToken, 'POST', '/v1/posts', {text, idempotencyKey})
    expect(response.statusCode, response.body).toBe(201)
    return response.json().data.id
  }

  async function createVerifiedUser(handle: string, displayName: string) {
    const password = 'secure-pass-word-1'
    const email = `${handle}@example.com`
    await db.deleteFrom('greenfield_auth_rate_limits').execute()
    const register = await app.inject({method: 'POST', url: '/v1/accounts/register',
      payload: {email, password, handle, displayName, acceptedTerms: true, inviteCode: 'test-invite'}})
    expect(register.statusCode, register.body).toBe(201)
    const verified = await app.inject({method: 'POST', url: '/v1/accounts/verify-email',
      payload: {token: register.json().data.verificationToken}})
    expect(verified.statusCode).toBe(200)
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect([200, 201]).toContain(session.statusCode)
    const accessToken = session.json().data.accessToken as string
    const account = await app.inject({method: 'GET', url: '/v1/accounts/me', headers: {authorization: `Bearer ${accessToken}`}})
    const accountId = account.json().data.accountId as string
    const actor = await db.selectFrom('actors').select('id').where('account_id', '=', accountId).executeTakeFirstOrThrow()
    return {accountId, actorId: actor.id, accessToken}
  }

  async function createReadyImage(accessToken: string, filename: string): Promise<string> {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64')
    const created = await authed(accessToken, 'POST', '/v1/attachments/uploads', {
      filename, mimeType: 'image/png', size: png.length,
    })
    expect(created.statusCode, created.body).toBe(201)
    const session = created.json().data
    const uploaded = await app.inject({method: 'PUT', url: `/v1/attachments/uploads/${session.uploadId}/content`,
      headers: {authorization: `Bearer ${accessToken}`, 'content-type': 'application/octet-stream'}, payload: png})
    expect(uploaded.statusCode, uploaded.body).toBe(200)
    return session.attachmentId
  }

  async function authed(accessToken: string, method: string, url: string, payload?: unknown) {
    return app.inject({method: method as any, url, headers: {authorization: `Bearer ${accessToken}`},
      ...(payload === undefined ? {} : {payload})})
  }
})
