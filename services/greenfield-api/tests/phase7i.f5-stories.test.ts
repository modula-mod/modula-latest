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
