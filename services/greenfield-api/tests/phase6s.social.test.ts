import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIf = databaseUrl ? describe : describe.skip

describeIf('Phase 6S social product integration', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let accessToken = ''
  let actorId = ''
  let postId = ''

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

    const suffix = Date.now().toString(36)
    const email = `p6s-${suffix}@example.com`
    const handle = `p6s${suffix}`.slice(0, 20)
    const password = 'secure-pass-word-1'
    const register = await app.inject({
      method: 'POST',
      url: '/v1/accounts/register',
      payload: {email, password, handle, inviteCode: 'test-invite'},
    })
    expect(register.statusCode).toBe(201)
    const token = register.json().data.verificationToken
    await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token}})
    const session = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {email, password},
    })
    expect([200, 201]).toContain(session.statusCode)
    accessToken = session.json().data.accessToken
    const me = await app.inject({
      method: 'GET',
      url: '/v1/accounts/me',
      headers: {authorization: `Bearer ${accessToken}`},
    })
    const accountId = me.json().data.accountId
    const actor = await db
      .selectFrom('actors')
      .select('id')
      .where('account_id', '=', accountId)
      .executeTakeFirst()
    actorId = actor?.id ?? ''
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
})
