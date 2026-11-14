import {randomUUID} from 'node:crypto'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {STANDARD_SESSION_CAPABILITIES} from '@modula/api-contracts'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {createServer} from '../src/app/create-server.js'
import {loadConfig} from '../src/config/env.js'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {AttachmentService} from '../src/domains/attachments/service.js'
import {PostWriteService} from '../src/domains/posts/writes.js'
import {SessionService} from '../src/security/session.js'
import {validDescriptor} from './helpers/nodus-release-fixture.js'

// GF native endpoints: GET /v1/reels/:id and GET /v1/intelligence/nodus/releases/latest
// against a real Postgres through the full createServer() route stack.
const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const ENV_KEYS = ['MODULA_REELS_BY_ID_ENABLED', 'MODULA_NODUS_RELEASE_IOS_JSON'] as const

describeIfDb('GF native endpoints: database integration', () => {
  let db: ModulaDb
  let root: string
  let enabled: Awaited<ReturnType<typeof createServer>>
  let disabled: Awaited<ReturnType<typeof createServer>>
  let attachments: AttachmentService
  let posts: PostWriteService
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10)
  const owner = identity('owner', suffix)
  const viewer = identity('viewer', suffix)
  const blocker = identity('blocker', suffix)
  const muter = identity('muter', suffix)
  const tokens: Record<string, string> = {}
  const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}

  beforeAll(async () => {
    for (const key of ENV_KEYS) saved[key] = process.env[key]
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    root = await mkdtemp(join(tmpdir(), 'modula-gf-native-'))
    const config = configFor(root)
    attachments = new AttachmentService(db, config)
    posts = new PostWriteService(db, config)
    const sessions = new SessionService(db, config)
    for (const who of [owner, viewer, blocker, muter]) {
      await seedIdentity(db, who)
      tokens[who.kind] = (await sessions.createSession(who.actorId, STANDARD_SESSION_CAPABILITIES)).token
    }
    const now = new Date()
    await db.insertInto('blocks').values({id: `gfne-b-${suffix}`, blocker_actor_id: blocker.actorId, blocked_actor_id: owner.actorId, created_at: now, updated_at: now, deleted_at: null, version: 1}).execute()
    await db.insertInto('mutes').values({id: `gfne-m-${suffix}`, muter_actor_id: muter.actorId, muted_actor_id: owner.actorId, created_at: now, updated_at: now, deleted_at: null, version: 1}).execute()

    // Routes read their settings at registration, so each server gets its own env.
    for (const key of ENV_KEYS) delete process.env[key]
    disabled = await createServer(config)
    await disabled.app.ready()
    process.env.MODULA_REELS_BY_ID_ENABLED = 'true'
    process.env.MODULA_NODUS_RELEASE_IOS_JSON = JSON.stringify(validDescriptor)
    enabled = await createServer(config)
    await enabled.app.ready()
  })

  afterAll(async () => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
    await enabled?.app.close()
    await enabled?.db.destroy()
    await disabled?.app.close()
    await disabled?.db.destroy()
    await db?.destroy()
    if (root) await rm(root, {recursive: true, force: true})
  })

  async function videoPost(text: string, audience: 'public' | 'private' = 'public') {
    const video = Buffer.from('00000018667479706d703432000000006d70343269736f6d', 'hex')
    const upload = await attachments.createUpload(owner.accountId, {filename: 'reel.mp4', mimeType: 'video/mp4', size: video.length})
    await attachments.upload(owner.accountId, upload.uploadId, video)
    return posts.create(owner.actorId, {text, audience, content: [{type: 'video', attachmentId: upload.attachmentId}]})
  }

  const get = (server: typeof enabled, url: string, token?: string) =>
    server.app.inject({method: 'GET', url, headers: token ? {authorization: `Bearer ${token}`} : {}})

  it('serves the configured Nodus release unauthenticated and 404s when unconfigured', async () => {
    const url = '/v1/intelligence/nodus/releases/latest?platform=ios&hostVersion=0.1.0'
    const served = await get(enabled, url)
    expect(served.statusCode).toBe(200)
    expect(served.json()).toEqual(validDescriptor)
    const missing = await get(disabled, url)
    expect(missing.statusCode).toBe(404)
    expect(missing.json()).toMatchObject({ok: false, error: {code: 'NOT_FOUND'}})
    expect((await get(enabled, '/v1/intelligence/nodus/releases/latest?platform=android')).statusCode).toBe(404)
  })

  it('returns a public video reel in the GET /v1/reels item shape, only with a session', async () => {
    const post = await videoPost('Reel by id #modula')
    expect((await get(enabled, `/v1/reels/${post.id}`)).statusCode).toBe(401)
    expect((await get(enabled, `/v1/reels/${post.id}`, 'not-a-real-session-token')).statusCode).toBe(401)
    const res = await get(enabled, `/v1/reels/${post.id}`, tokens.viewer)
    expect(res.statusCode, res.body).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.data).toMatchObject({id: post.id, caption: 'Reel by id #modula', source: 'video-post', liked: false, likeCount: 0, replyCount: 0, post: {id: post.id}})
    expect(body.data.post.content[0].attachment).toMatchObject({kind: 'video', status: 'ready'})
    const list = await get(enabled, '/v1/reels', tokens.viewer)
    const listed = list.json().data.find((item: any) => item.id === post.id)
    expect(Object.keys(body.data).sort()).toEqual(Object.keys(listed).sort())
    expect(body.data.author).toEqual(listed.author)
  })

  it('is 404 when the feature is disabled, even for an existing reel', async () => {
    const post = await videoPost('Disabled lookup')
    const res = await get(disabled, `/v1/reels/${post.id}`, tokens.viewer)
    expect(res.statusCode).toBe(404)
    expect((await get(disabled, `/v1/reels/${post.id}`)).statusCode).toBe(404)
  })

  it('rejects invalid ids and 404s unknown ids and non-video posts', async () => {
    expect((await get(enabled, '/v1/reels/a%20b', tokens.viewer)).statusCode).toBe(400)
    expect((await get(enabled, `/v1/reels/${randomUUID()}`, tokens.viewer)).statusCode).toBe(404)
    const text = await posts.create(owner.actorId, {text: 'plain text post', audience: 'public'})
    expect((await get(enabled, `/v1/reels/${text.id}`, tokens.viewer)).statusCode).toBe(404)
  })

  it('enforces visibility: private, deleted, blocked and muted reels are 404', async () => {
    const hidden = await videoPost('Private reel', 'private')
    expect((await get(enabled, `/v1/reels/${hidden.id}`, tokens.viewer)).statusCode).toBe(404)
    // Same rule as the list: reels are public video posts only, even for the author.
    expect((await get(enabled, `/v1/reels/${hidden.id}`, tokens.owner)).statusCode).toBe(404)

    const post = await videoPost('Visible then filtered')
    expect((await get(enabled, `/v1/reels/${post.id}`, tokens.owner)).statusCode).toBe(200)
    expect((await get(enabled, `/v1/reels/${post.id}`, tokens.blocker)).statusCode).toBe(404)
    expect((await get(enabled, `/v1/reels/${post.id}`, tokens.muter)).statusCode).toBe(404)
    await db.updateTable('posts').set({deleted_at: new Date()}).where('id', '=', post.id).execute()
    expect((await get(enabled, `/v1/reels/${post.id}`, tokens.viewer)).statusCode).toBe(404)
  })
})

function identity(kind: string, suffix: string) {
  return {kind, accountId: `gfne-${kind}-account-${suffix}`, actorId: `gfne-${kind}-actor-${suffix}`, profileId: `gfne-${kind}-profile-${suffix}`, handle: `gfne${kind}${suffix}`.slice(0, 24)}
}

async function seedIdentity(db: ModulaDb, value: ReturnType<typeof identity>) {
  const now = new Date()
  await db.insertInto('greenfield_accounts').values({account_id: value.accountId, primary_handle: value.handle, status: 'active', created_at: now, updated_at: now}).execute()
  await db.insertInto('actors').values({id: value.actorId, account_id: value.accountId, kind: 'person', created_at: now, updated_at: now, deleted_at: null, version: 1}).execute()
  await db.insertInto('profiles').values({
    id: value.profileId, actor_id: value.actorId, handle: value.handle, display_name: value.handle, kind: 'person', bio: '',
    avatar_url: null, cover_url: null, cover_colour: null, pronouns: null, location_label: null, location_visibility: null,
    website_label: null, website_url: null, website_domain: null, website_visibility: null, focus_status_id: 'available',
    focus_status_label: 'Available', focus_status_message: '', focus_status_updated_at: now, visibility: 'public', module_count: 0,
    featured_module_ids: [], identity_claims: [], joined_at: now, created_at: now, updated_at: now, deleted_at: null, version: 1,
  }).execute()
}

function configFor(root: string) {
  return loadConfig({
    NODE_ENV: 'test', MODULA_ENVIRONMENT: 'development', MODULA_API_HOST: '127.0.0.1', MODULA_API_PORT: '4029',
    MODULA_PUBLIC_API_URL: 'https://api.example.test', MODULA_DATABASE_URL: databaseUrl!,
    MODULA_ALLOWED_ORIGINS: 'https://modula.digital', MODULA_MEDIA_ROOT: root,
    MODULA_PREVIEW_WRITES_ENABLED: 'true', MODULA_RATE_LIMIT_ENABLED: 'false',
  })
}
