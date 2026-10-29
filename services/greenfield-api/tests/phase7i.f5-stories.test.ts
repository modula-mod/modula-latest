import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('Phase 7I-F5 stories acceptance', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let runSuffix = ''
  let reusableSessionUser: Awaited<ReturnType<typeof createVerifiedUser>> | null = null

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4024'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4024'
    process.env.MODULA_DATABASE_URL = databaseUrl!
    process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
    process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
    process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
    process.env.MODULA_INVITE_ONLY = 'true'
    process.env.MODULA_REGISTRATION_INVITE_CODES = 'test-invite'
    process.env.MODULA_ATPROTO_ENABLED = 'false'
    process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
    process.env.MODULA_MEDIA_ROOT = `/tmp/modula-f5b-stories-${process.pid}`
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

  it('creates, displays, views, reports, deletes and expires real Story data', async () => {
    const alpha = await createVerifiedUser(`f5sa${runSuffix}`.slice(0, 20), 'F5B Stories Alpha')
    const beta = await createVerifiedUser(`f5sb${runSuffix}`.slice(0, 20), 'F5B Stories Beta')

    const created = await authed(alpha.accessToken, 'POST', '/v1/stories', {
      mediaKind: 'image',
      contentType: 'image/png',
      base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      caption: `F5B follower story ${runSuffix}`,
      visibility: 'followers',
      width: 1,
      height: 1,
    })
    expect(created.statusCode).toBe(201)
    const groupId = created.json().data.groupId
    const itemId = created.json().data.items[0].itemId

    const privateRail = await app.inject({method: 'GET', url: '/v1/stories/rail'})
    expect(privateRail.statusCode).toBe(200)
    expect(privateRail.json().data.items.some((item: any) => item.groupId === groupId)).toBe(false)
    const privateViewer = await app.inject({method: 'GET', url: `/v1/stories/${groupId}`})
    expect(privateViewer.statusCode).toBe(404)

    const follow = await authed(beta.accessToken, 'POST', `/v1/profiles/${alpha.profileId}/follow`)
    expect(follow.statusCode).toBe(200)
    const rail = await authed(beta.accessToken, 'GET', '/v1/stories/rail')
    expect(rail.statusCode).toBe(200)
    const railEntry = rail.json().data.items.find((item: any) => item.groupId === groupId)
    expect(railEntry).toBeTruthy()
    expect(railEntry.ringState).toBe('unviewed')

    const viewer = await authed(beta.accessToken, 'GET', `/v1/stories/${groupId}`)
    expect(viewer.statusCode).toBe(200)
    expect(viewer.json().data.items).toHaveLength(1)
    expect(viewer.json().data.items[0].viewed).toBe(false)

    const mediaUrl = new URL(viewer.json().data.items[0].mediaUrl)
    const media = await app.inject({
      method: 'GET',
      url: mediaUrl.pathname,
      headers: {authorization: `Bearer ${beta.accessToken}`},
    })
    expect(media.statusCode).toBe(200)
    expect(media.headers['cache-control']).toBe('private, no-store')
    expect(media.headers['cross-origin-resource-policy']).toBe('same-site')

    const seen = await authed(beta.accessToken, 'POST', `/v1/stories/items/${itemId}/viewed`)
    expect(seen.statusCode).toBe(200)
    const viewed = await authed(beta.accessToken, 'GET', `/v1/stories/${groupId}`)
    expect(viewed.statusCode).toBe(200)
    expect(viewed.json().data.items[0].viewed).toBe(true)
    const viewedRail = await authed(beta.accessToken, 'GET', '/v1/stories/rail')
    expect(viewedRail.statusCode).toBe(200)
    expect(viewedRail.json().data.items.find((item: any) => item.groupId === groupId).ringState).toBe('viewed')

    const block = await authed(alpha.accessToken, 'POST', `/v1/profiles/${beta.profileId}/block`)
    expect(block.statusCode).toBe(200)
    const blockedViewer = await authed(beta.accessToken, 'GET', `/v1/stories/${groupId}`)
    expect(blockedViewer.statusCode).toBe(404)
    const blockedRail = await authed(beta.accessToken, 'GET', '/v1/stories/rail')
    expect(blockedRail.statusCode).toBe(200)
    expect(blockedRail.json().data.items.some((item: any) => item.groupId === groupId)).toBe(false)
    const unblock = await authed(alpha.accessToken, 'DELETE', `/v1/profiles/${beta.profileId}/block`)
    expect(unblock.statusCode).toBe(200)

    const report = await authed(beta.accessToken, 'POST', '/v1/reports', {
      targetType: 'story',
      targetId: itemId,
      category: 'spam',
      details: `F5B story report ${runSuffix}`,
    })
    expect(report.statusCode).toBe(201)
    expect(report.json().data.targetType).toBe('story')

    const deleted = await authed(alpha.accessToken, 'DELETE', `/v1/stories/items/${itemId}`)
    expect(deleted.statusCode).toBe(200)
    const deletedViewer = await authed(alpha.accessToken, 'GET', `/v1/stories/${groupId}`)
    expect(deletedViewer.statusCode).toBe(404)

    const expiring = await authed(alpha.accessToken, 'POST', '/v1/stories', {
      mediaKind: 'image',
      contentType: 'image/png',
      base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      caption: `F5B expiry story ${runSuffix}`,
      visibility: 'public',
      width: 1,
      height: 1,
    })
    expect(expiring.statusCode).toBe(201)
    const expiredGroupId = expiring.json().data.groupId
    await db
      .updateTable('greenfield_story_groups')
      .set({expires_at: new Date(Date.now() - 1_000), updated_at: new Date()})
      .where('group_id', '=', expiredGroupId)
      .execute()
    const expiredViewer = await app.inject({method: 'GET', url: `/v1/stories/${expiredGroupId}`})
    expect(expiredViewer.statusCode).toBe(404)
    const expiredRail = await app.inject({method: 'GET', url: '/v1/stories/rail'})
    expect(expiredRail.statusCode).toBe(200)
    expect(expiredRail.json().data.items.some((item: any) => item.groupId === expiredGroupId)).toBe(false)
  })

  it('publishes verified attachments with retry safety, visibility enforcement and cleanup', async () => {
    const owner = await createVerifiedUser(`f5soa${runSuffix}`.slice(0, 20), 'F5B Attachment Owner')
    const follower = await createVerifiedUser(`f5sob${runSuffix}`.slice(0, 20), 'F5B Attachment Follower')
    reusableSessionUser = follower
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      'base64',
    )

    const uploadSession = await authed(owner.accessToken, 'POST', '/v1/attachments/uploads', {
      filename: 'ar-composite.png', mimeType: 'image/png', size: pixel.length,
    })
    expect(uploadSession.statusCode, uploadSession.body).toBe(201)
    const {uploadId, attachmentId} = uploadSession.json().data
    const uploaded = await app.inject({
      method: 'PUT',
      url: `/v1/attachments/uploads/${uploadId}/content`,
      headers: {authorization: `Bearer ${owner.accessToken}`, 'content-type': 'application/octet-stream'},
      payload: pixel,
    })
    expect(uploaded.statusCode, uploaded.body).toBe(200)
    expect(uploaded.json().data.attachment).toMatchObject({
      id: attachmentId, status: 'ready', kind: 'image', width: 1, height: 1,
    })

    const crossAccount = await authed(follower.accessToken, 'POST', '/v1/stories', {
      mediaKind: 'image', attachmentId, visibility: 'public',
    })
    expect(crossAccount.statusCode).toBe(403)
    expect(crossAccount.json().error.code).toBe('FORBIDDEN')

    const idempotencyKey = `story-attachment-${runSuffix}`
    const request = {
      mediaKind: 'image' as const,
      attachmentId,
      visibility: 'followers' as const,
      caption: `AR composite ${runSuffix}`,
      idempotencyKey,
    }
    const created = await authed(owner.accessToken, 'POST', '/v1/stories', request)
    expect(created.statusCode, created.body).toBe(201)
    const groupId = created.json().data.groupId
    const itemId = created.json().data.items[0].itemId
    expect(created.json().data.items[0].mediaUrl).toContain(`/v1/attachments/${attachmentId}/content`)

    const replay = await authed(owner.accessToken, 'POST', '/v1/stories', request)
    expect(replay.statusCode, replay.body).toBe(201)
    expect(replay.json().data.groupId).toBe(groupId)
    expect(replay.json().data.items).toHaveLength(1)
    const mismatchedReplay = await authed(owner.accessToken, 'POST', '/v1/stories', {
      ...request, caption: 'different request',
    })
    expect(mismatchedReplay.statusCode).toBe(409)
    expect(mismatchedReplay.json().error.code).toBe('CONFLICT')

    const deniedBeforeFollow = await authed(
      follower.accessToken, 'GET', `/v1/attachments/${attachmentId}/content`,
    )
    expect(deniedBeforeFollow.statusCode).toBe(403)
    const followed = await authed(follower.accessToken, 'POST', `/v1/profiles/${owner.profileId}/follow`)
    expect(followed.statusCode).toBe(200)
    const visible = await authed(follower.accessToken, 'GET', `/v1/attachments/${attachmentId}/content`)
    expect(visible.statusCode, visible.body).toBe(200)
    expect(visible.rawPayload.equals(pixel)).toBe(true)

    const blocked = await authed(owner.accessToken, 'POST', `/v1/profiles/${follower.profileId}/block`)
    expect(blocked.statusCode).toBe(200)
    const deniedWhileBlocked = await authed(
      follower.accessToken, 'GET', `/v1/attachments/${attachmentId}/content`,
    )
    expect(deniedWhileBlocked.statusCode).toBe(403)
    const unblocked = await authed(owner.accessToken, 'DELETE', `/v1/profiles/${follower.profileId}/block`)
    expect(unblocked.statusCode).toBe(200)

    const stored = await db.selectFrom('greenfield_story_items').selectAll().where('item_id', '=', itemId).executeTakeFirstOrThrow()
    expect(stored).toMatchObject({attachment_id: attachmentId, media_file_name: null, owner_actor_id: owner.actorId})
    const bound = await db.selectFrom('attachments').select(['attached_at', 'storage_key'])
      .where('attachment_id', '=', attachmentId).executeTakeFirstOrThrow()
    expect(bound.attached_at).not.toBeNull()
    expect(bound.storage_key).not.toBeNull()

    const deleted = await authed(owner.accessToken, 'DELETE', `/v1/stories/items/${itemId}`)
    expect(deleted.statusCode, deleted.body).toBe(200)
    const gone = await authed(owner.accessToken, 'GET', `/v1/attachments/${attachmentId}/content`)
    expect(gone.statusCode).toBe(404)
    const expired = await db.selectFrom('attachments').select(['status', 'attached_at', 'storage_key'])
      .where('attachment_id', '=', attachmentId).executeTakeFirstOrThrow()
    expect(expired).toMatchObject({status: 'expired', attached_at: null, storage_key: null})

    const invalidMagic = await authed(owner.accessToken, 'POST', '/v1/stories', {
      mediaKind: 'image', contentType: 'image/png', base64: Buffer.from('not a png').toString('base64'),
    })
    expect(invalidMagic.statusCode).toBe(400)
    expect(invalidMagic.json().error.code).toBe('VALIDATION_FAILED')
    const invalidBase64 = await authed(owner.accessToken, 'POST', '/v1/stories', {
      mediaKind: 'image', contentType: 'image/png', base64: '!!!!',
    })
    expect(invalidBase64.statusCode).toBe(400)
    expect(invalidBase64.json().error.code).toBe('VALIDATION_FAILED')
    const invalidVisibility = await authed(owner.accessToken, 'POST', '/v1/stories', {
      mediaKind: 'image', contentType: 'image/png', base64: pixel.toString('base64'), visibility: 'everyone',
    })
    expect(invalidVisibility.statusCode).toBe(400)
    expect(invalidVisibility.json().error.code).toBe('VALIDATION_FAILED')
    const invalidCaption = await authed(owner.accessToken, 'POST', '/v1/stories', {
      mediaKind: 'image', contentType: 'image/png', base64: pixel.toString('base64'), caption: {unsafe: true},
    })
    expect(invalidCaption.statusCode).toBe(400)
    expect(invalidCaption.json().error.code).toBe('VALIDATION_FAILED')
  })

  it('expires items 24h after their own created_at and counts only live ready/pending items', async () => {
    const owner = await createVerifiedUser(`f5se${runSuffix}`.slice(0, 20), 'F5B Stories Expiry')
    const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='
    const first = await authed(owner.accessToken, 'POST', '/v1/stories', {
      mediaKind: 'image', contentType: 'image/png', base64: pixel, visibility: 'public',
    })
    expect(first.statusCode).toBe(201)
    const groupId = first.json().data.groupId
    const oldItemId = first.json().data.items[0].itemId

    // Backdate the first item past the TTL; the group itself stays unexpired.
    await db
      .updateTable('greenfield_story_items')
      .set({created_at: new Date(Date.now() - 25 * 60 * 60 * 1000)})
      .where('item_id', '=', oldItemId)
      .execute()

    const anonRail = await app.inject({method: 'GET', url: '/v1/stories/rail'})
    expect(anonRail.statusCode).toBe(200)
    expect(anonRail.json().data.items.some((item: any) => item.groupId === groupId)).toBe(false)
    const anonGroup = await app.inject({method: 'GET', url: `/v1/stories/${groupId}`})
    expect(anonGroup.statusCode).toBe(404)
    const ownerRail = await authed(owner.accessToken, 'GET', '/v1/stories/rail')
    expect(ownerRail.statusCode).toBe(200)
    const ownerEntry = ownerRail.json().data.items.find((item: any) => item.ownerActorId === owner.actorId)
    expect(ownerEntry.groupId).toBe(`add:${owner.actorId}`)
    expect(ownerEntry.itemCount).toBe(0)
    const viewExpired = await authed(owner.accessToken, 'POST', `/v1/stories/items/${oldItemId}/viewed`)
    expect(viewExpired.statusCode).toBe(404)

    const second = await authed(owner.accessToken, 'POST', '/v1/stories', {
      mediaKind: 'image', contentType: 'image/png', base64: pixel, visibility: 'public',
    })
    expect(second.statusCode).toBe(201)
    expect(second.json().data.groupId).toBe(groupId)
    expect(second.json().data.items.map((item: any) => item.itemId)).not.toContain(oldItemId)
    expect(second.json().data.items).toHaveLength(1)

    // A failed item is shown to the owner but is not counted.
    await db
      .insertInto('greenfield_story_items')
      .values({
        item_id: crypto.randomUUID(), owner_actor_id: owner.actorId, group_id: groupId, media_kind: 'image', media_url: null,
        media_file_name: null, caption: null, status: 'failed', sort_order: 99, duration_ms: 5000,
        created_at: new Date(), deleted_at: null,
      })
      .execute()
    const liveRail = await app.inject({method: 'GET', url: '/v1/stories/rail'})
    const liveEntry = liveRail.json().data.items.find((item: any) => item.groupId === groupId)
    expect(liveEntry).toBeTruthy()
    expect(liveEntry.itemCount).toBe(1)
    const liveGroup = await app.inject({method: 'GET', url: `/v1/stories/${groupId}`})
    expect(liveGroup.statusCode).toBe(200)
    expect(liveGroup.json().data.items).toHaveLength(1)
    const ownerGroup = await authed(owner.accessToken, 'GET', `/v1/stories/${groupId}`)
    expect(ownerGroup.json().data.items).toHaveLength(2)
    const ownerLiveRail = await authed(owner.accessToken, 'GET', '/v1/stories/rail')
    expect(ownerLiveRail.json().data.items[0].groupId).toBe(groupId)
    expect(ownerLiveRail.json().data.items[0].itemCount).toBe(1)
  })

  it('rejects a present but invalid Authorization header on optional-auth story routes', async () => {
    const bogus = {authorization: 'Bearer not-a-real-token'}
    const rail = await app.inject({method: 'GET', url: '/v1/stories/rail', headers: bogus})
    expect(rail.statusCode).toBe(401)
    expect(rail.json().error.code).toBe('UNAUTHENTICATED')
    const group = await app.inject({
      method: 'GET', url: '/v1/stories/00000000-0000-0000-0000-000000000000', headers: bogus,
    })
    expect(group.statusCode).toBe(401)
    const anonymous = await app.inject({method: 'GET', url: '/v1/stories/rail'})
    expect(anonymous.statusCode).toBe(200)

    const user = reusableSessionUser
    expect(user).not.toBeNull()
    if (!user) throw new Error('Reusable story session fixture missing')
    const valid = await authed(user.accessToken, 'GET', '/v1/stories/rail')
    expect(valid.statusCode).toBe(200)
    const logout = await authed(user.accessToken, 'DELETE', '/v1/sessions/current')
    expect([200, 204]).toContain(logout.statusCode)
    const revoked = await authed(user.accessToken, 'GET', '/v1/stories/rail')
    expect(revoked.statusCode).toBe(401)
  })

  async function createVerifiedUser(handle: string, displayName: string) {
    const password = 'secure-pass-word-1'
    const email = `${handle}@example.com`
    const register = await app.inject({
      method: 'POST',
      url: '/v1/accounts/register',
      payload: {email, password, handle, displayName, acceptedTerms: true, inviteCode: 'test-invite'},
    })
    expect(register.statusCode).toBe(201)
    const verified = await app.inject({
      method: 'POST',
      url: '/v1/accounts/verify-email',
      payload: {token: register.json().data.verificationToken},
    })
    expect(verified.statusCode).toBe(200)
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect([200, 201]).toContain(session.statusCode)
    const accessToken = session.json().data.accessToken
    const me = await app.inject({
      method: 'GET',
      url: '/v1/accounts/me',
      headers: {authorization: `Bearer ${accessToken}`},
    })
    expect(me.statusCode).toBe(200)
    const accountId = me.json().data.accountId
    const profile = await db
      .selectFrom('actors')
      .innerJoin('profiles', 'profiles.actor_id', 'actors.id')
      .select(['profiles.id as profile_id', 'actors.id as actor_id'])
      .where('actors.account_id', '=', accountId)
      .executeTakeFirstOrThrow()
    return {accountId, actorId: profile.actor_id, profileId: profile.profile_id, handle, accessToken}
  }

  async function authed(accessToken: string, method: string, url: string, payload?: unknown) {
    return app.inject({
      method: method as any,
      url,
      headers: {authorization: `Bearer ${accessToken}`},
      ...(payload === undefined ? {} : {payload}),
    })
  }
})
