import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {handleSocialNotification} from '../../greenfield-worker/src/notifications/social.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIf = databaseUrl ? describe : describe.skip

describeIf('Phase 6S social product integration', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let accessToken = ''
  let actorId = ''
  let postId = ''
  let runSuffix = ''

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4023'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4023'
    process.env.MODULA_DATABASE_URL = databaseUrl!
    process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
    process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
    process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
    process.env.MODULA_INVITE_ONLY = 'true'
    process.env.MODULA_REGISTRATION_INVITE_CODES = 'test-invite'
    process.env.MODULA_ATPROTO_ENABLED = 'false'
    process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()

    runSuffix = Date.now().toString(36)
    const user = await createVerifiedUser(`p6s${runSuffix}`.slice(0, 20), 'Phase 6S User')
    accessToken = user.accessToken
    actorId = user.actorId
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  it('persists appearance preferences with validation', async () => {
    const get = await app.inject({
      method: 'GET',
      url: '/v1/accounts/me/appearance',
      headers: {authorization: `Bearer ${accessToken}`},
    })
    expect(get.statusCode).toBe(200)
    const version = get.json().data.version
    const patch = await app.inject({
      method: 'PATCH',
      url: '/v1/accounts/me/appearance',
      headers: {authorization: `Bearer ${accessToken}`},
      payload: {mode: 'oled', surface: 'glass', textScale: 1.2, expectedVersion: version},
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().data.mode).toBe('oled')
    expect(patch.json().data.surface).toBe('glass')

    const invalid = await app.inject({
      method: 'PATCH',
      url: '/v1/accounts/me/appearance',
      headers: {authorization: `Bearer ${accessToken}`},
      payload: {textScale: 9, expectedVersion: patch.json().data.version},
    })
    expect(invalid.statusCode).toBe(400)
  })

  it('persists account notification preferences with version conflicts', async () => {
    const get = await app.inject({
      method: 'GET',
      url: '/v1/accounts/me/notification-preferences',
      headers: {authorization: `Bearer ${accessToken}`},
    })
    expect(get.statusCode).toBe(200)
    const initial = get.json().data
    expect(initial.bundleStyle).toBe('focus')
    expect(initial.moduleEventEnabled).toBe(false)

    const patch = await app.inject({
      method: 'PATCH',
      url: '/v1/accounts/me/notification-preferences',
      headers: {authorization: `Bearer ${accessToken}`},
      payload: {
        likeEnabled: false,
        reactionEnabled: false,
        moduleEventEnabled: true,
        extensionEnabled: true,
        bundleStyle: 'digest',
        expectedVersion: initial.version,
      },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().data.likeEnabled).toBe(false)
    expect(patch.json().data.reactionEnabled).toBe(false)
    expect(patch.json().data.moduleEventEnabled).toBe(true)
    expect(patch.json().data.extensionEnabled).toBe(true)
    expect(patch.json().data.bundleStyle).toBe('digest')

    const reloaded = await app.inject({
      method: 'GET',
      url: '/v1/accounts/me/notification-preferences',
      headers: {authorization: `Bearer ${accessToken}`},
    })
    expect(reloaded.statusCode).toBe(200)
    expect(reloaded.json().data.bundleStyle).toBe('digest')

    const stale = await app.inject({
      method: 'PATCH',
      url: '/v1/accounts/me/notification-preferences',
      headers: {authorization: `Bearer ${accessToken}`},
      payload: {followEnabled: false, expectedVersion: initial.version},
    })
    expect(stale.statusCode).toBe(409)
  })

  it('supports recovery request without email enumeration', async () => {
    const missing = await app.inject({
      method: 'POST',
      url: '/v1/accounts/recovery/request',
      payload: {email: 'nobody-exists@example.com'},
    })
    expect(missing.statusCode).toBe(200)
    expect(missing.json().data.requested).toBe(true)
  })

  it('lists extension catalogue with first-party seeds', async () => {
    const catalogue = await app.inject({method: 'GET', url: '/v1/extensions/catalogue'})
    expect(catalogue.statusCode).toBe(200)
    const items = catalogue.json().data
    expect(Array.isArray(items)).toBe(true)
    expect(items.some((item: any) => item.extension_id === 'modula.core.composerTools')).toBe(true)
    expect(items.some((item: any) => item.extension_id === 'modula.module.dimon' && item.catalogue_status === 'inactive')).toBe(
      true,
    )
  })

  it('queues first-party function jobs and rejects untrusted ids', async () => {
    const queued = await app.inject({
      method: 'POST',
      url: '/v1/functions/modula.function.linkPreview/jobs',
      headers: {authorization: `Bearer ${accessToken}`},
      payload: {input: {url: 'https://modula.digital'}},
    })
    expect(queued.statusCode).toBe(202)
    expect(queued.json().data.jobId).toBeTruthy()

    const denied = await app.inject({
      method: 'POST',
      url: '/v1/functions/evil.function/jobs',
      headers: {authorization: `Bearer ${accessToken}`},
      payload: {input: {}},
    })
    expect([403, 404]).toContain(denied.statusCode)
  })

  it('completes extractMentions synchronously with Preview label', async () => {
    const result = await app.inject({
      method: 'POST',
      url: '/v1/functions/modula.function.extractMentions/jobs',
      headers: {authorization: `Bearer ${accessToken}`},
      payload: {input: {text: 'hello @andrei.modula'}},
    })
    expect(result.statusCode).toBe(202)
    expect(result.json().data.status).toBe('completed')
    expect(result.json().data.output.label).toBe('Preview')
  })

  it('exercises the Phase 7I-F5 two-account social golden path with durable persistence', async () => {
    const alpha = await createVerifiedUser(`f5ba${runSuffix}`.slice(0, 20), 'F5B Social Alpha')
    const beta = await createVerifiedUser(`f5bb${runSuffix}`.slice(0, 20), 'F5B Social Beta')

    const follow = await authed(beta.accessToken, 'POST', `/v1/profiles/${alpha.profileId}/follow`)
    expect(follow.statusCode).toBe(200)
    expect(follow.json().data.isFollowing).toBe(true)
    expect(follow.json().data.followerCount).toBe(1)

    const reloadedFollow = await authed(beta.accessToken, 'GET', `/v1/profiles/${alpha.handle}`)
    expect(reloadedFollow.statusCode).toBe(200)
    expect(reloadedFollow.json().data.isFollowing).toBe(true)

    const unfollow = await authed(beta.accessToken, 'DELETE', `/v1/profiles/${alpha.profileId}/follow`)
    expect(unfollow.statusCode).toBe(200)
    expect(unfollow.json().data.isFollowing).toBe(false)

    const refollow = await authed(beta.accessToken, 'POST', `/v1/profiles/${alpha.profileId}/follow`)
    expect(refollow.statusCode).toBe(200)

    const post = await authed(alpha.accessToken, 'POST', '/v1/posts', {
      text: `F5B social persistence post ${runSuffix}`,
      audience: 'public',
      feed: 'following',
      idempotencyKey: `f5b-social-text-${runSuffix}`,
    })
    expect(post.statusCode).toBe(201)
    const socialPostId = post.json().data.id

    const imagePost = await authed(alpha.accessToken, 'POST', '/v1/posts', {
      text: `F5B social image post ${runSuffix}`,
      audience: 'public',
      feed: 'following',
      idempotencyKey: `f5b-social-image-${runSuffix}`,
      media: [
        {
          kind: 'image',
          mimeType: 'image/png',
          base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
          width: 1,
          height: 1,
          altText: 'F5B acceptance image',
        },
      ],
    })
    expect(imagePost.statusCode).toBe(201)
    expect(imagePost.json().data.kind).toBe('media')
    expect(imagePost.json().data.media).toHaveLength(1)

    const mediaUrl = new URL(imagePost.json().data.media[0].url)
    const mediaReload = await app.inject({
      method: 'GET',
      url: mediaUrl.pathname,
      headers: {authorization: `Bearer ${beta.accessToken}`},
    })
    expect(mediaReload.statusCode).toBe(200)
    expect(mediaReload.headers['cache-control']).toBe('private, no-store')
    expect(mediaReload.headers['cross-origin-resource-policy']).toBe('same-site')

    for (const reaction of ['like', 'love', 'laugh', 'fire'] as const) {
      const reacted = await authed(beta.accessToken, 'PUT', `/v1/posts/${socialPostId}/reaction`, {type: reaction})
      expect(reacted.statusCode).toBe(200)
      expect(reacted.json().data.viewerReaction).toBe(reaction)
      expect(reacted.json().data.byType[reaction]).toBe(1)
      const reloaded = await authed(beta.accessToken, 'GET', `/v1/posts/${socialPostId}/reactions`)
      expect(reloaded.statusCode).toBe(200)
      expect(reloaded.json().data.viewerReaction).toBe(reaction)
    }

    // Metadata contract fixture; this assertion does not claim image decoding.
    const avatarUri = 'https://example.invalid/comment-avatar.png'
    await db.updateTable('profiles').set({avatar_url: avatarUri}).where('id', '=', beta.profileId).execute()
    const comment = await authed(beta.accessToken, 'POST', `/v1/posts/${socialPostId}/comments`, {
      text: `F5B comment ${runSuffix}`,
    })
    expect(comment.statusCode).toBe(201)
    const commentId = comment.json().data.comment_id
    expect(comment.json().data.author).toMatchObject({id: beta.profileId, handle: beta.handle, avatarUri})
    expect(Object.keys(comment.json().data.author).sort()).toEqual(['avatarUri', 'displayName', 'handle', 'id'])
    const commentReload = await authed(beta.accessToken, 'GET', `/v1/posts/${socialPostId}/comments`)
    expect(commentReload.json().data.items.find((item: any) => item.comment_id === commentId).author.handle).toBe(beta.handle)

    const reply = await authed(alpha.accessToken, 'POST', `/v1/comments/${commentId}/replies`, {
      text: `F5B reply ${runSuffix}`,
    })
    expect(reply.statusCode).toBe(201)
    expect(reply.json().data.author).toMatchObject({id: alpha.profileId, handle: alpha.handle})
    const replies = await authed(beta.accessToken, 'GET', `/v1/comments/${commentId}/replies`)
    expect(replies.statusCode).toBe(200)
    expect(replies.json().data.items.some((item: any) => item.text === `F5B reply ${runSuffix}`)).toBe(true)
    expect(replies.json().data.items.find((item: any) => item.text === `F5B reply ${runSuffix}`).author.handle).toBe(alpha.handle)

    const bookmark = await authed(beta.accessToken, 'POST', `/v1/posts/${socialPostId}/save`)
    expect(bookmark.statusCode).toBe(200)
    const saves = await authed(beta.accessToken, 'GET', '/v1/saves')
    expect(saves.statusCode).toBe(200)
    expect(saves.json().data.items.some((item: any) => item.id === socialPostId)).toBe(true)

    const repost = await authed(beta.accessToken, 'POST', `/v1/posts/${socialPostId}/repost`)
    expect(repost.statusCode).toBe(200)
    const quoteShare = await authed(beta.accessToken, 'POST', `/v1/posts/${socialPostId}/quote`, {
      commentary: `F5B quote share ${runSuffix}`,
    })
    expect(quoteShare.statusCode).toBe(201)

    await processSocialNotification('reaction', socialPostId)
    const notifications = await authed(alpha.accessToken, 'GET', '/v1/notifications')
    expect(notifications.statusCode).toBe(200)
    expect(notifications.json().data.items.some((item: any) => item.resourceId === socialPostId)).toBe(true)

    const mute = await authed(alpha.accessToken, 'POST', `/v1/profiles/${beta.profileId}/mute`)
    expect(mute.statusCode).toBe(200)
    const feedAfterMute = await authed(alpha.accessToken, 'GET', '/v1/feed/home?mode=forYou&limit=50')
    expect(feedAfterMute.statusCode).toBe(200)
    expect(feedAfterMute.json().data.items.some((item: any) => item.id === quoteShare.json().data.postId)).toBe(false)
    const unmute = await authed(alpha.accessToken, 'DELETE', `/v1/profiles/${beta.profileId}/mute`)
    expect(unmute.statusCode).toBe(200)

    const block = await authed(alpha.accessToken, 'POST', `/v1/profiles/${beta.profileId}/block`)
    expect(block.statusCode).toBe(200)
    const blockedProfile = await authed(beta.accessToken, 'GET', `/v1/profiles/${alpha.handle}`)
    expect(blockedProfile.statusCode).toBe(404)
    const unblock = await authed(alpha.accessToken, 'DELETE', `/v1/profiles/${beta.profileId}/block`)
    expect(unblock.statusCode).toBe(200)

    const report = await authed(beta.accessToken, 'POST', '/v1/reports', {
      targetType: 'post',
      targetId: socialPostId,
      category: 'spam',
      details: `F5B report ${runSuffix}`,
    })
    expect(report.statusCode).toBe(201)
    expect(report.json().data.targetId).toBe(socialPostId)

    const finalPostReload = await authed(beta.accessToken, 'GET', `/v1/posts/${socialPostId}`)
    expect(finalPostReload.statusCode).toBe(200)
    expect(finalPostReload.json().data.replyCount).toBeGreaterThanOrEqual(1)
    expect(finalPostReload.json().data.repostCount).toBeGreaterThanOrEqual(1)
  })

  // Keep a lightweight DB-level reaction uniqueness check when actor wiring is present.
  it('enforces reaction uniqueness at the database layer', async () => {
    if (!actorId) return
    const post = await db
      .insertInto('posts')
      .values({
        id: `post-${Date.now()}`,
        author_actor_id: actorId,
        kind: 'text',
        text: 'phase6s reaction fixture',
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
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        version: 1,
      })
      .returning('id')
      .executeTakeFirst()
    postId = post!.id
    await db
      .insertInto('greenfield_reactions')
      .values({
        reaction_id: `r1-${postId}`,
        actor_id: actorId,
        post_id: postId,
        reaction_type: 'like',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()
    await expect(
      db
        .insertInto('greenfield_reactions')
        .values({
          reaction_id: `r2-${postId}`,
          actor_id: actorId,
          post_id: postId,
          reaction_type: 'curious',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute(),
    ).rejects.toThrow()
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
    const token = register.json().data.verificationToken
    const verified = await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token}})
    expect(verified.statusCode).toBe(200)
    const session = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {email, password},
    })
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

  async function processSocialNotification(kind: 'reaction' | 'comment' | 'reply' | 'repost' | 'quote' | 'follow', resourceId: string) {
    const job = await db
      .selectFrom('background_jobs')
      .select(['payload'])
      .where('job_type', '=', `notification.${kind}`)
      .where('status', '=', 'QUEUED')
      .orderBy('created_at', 'desc')
      .execute()
    const payload = job.find(row => (row.payload as any)?.resourceId === resourceId)?.payload
    expect(payload).toBeTruthy()
    await handleSocialNotification(db as any, kind, payload)
  }
})
