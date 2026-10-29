import {createHash, randomUUID} from 'node:crypto'
import {access, mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {STANDARD_SESSION_CAPABILITIES} from '@modula/api-contracts'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {createServer} from '../src/app/create-server.js'
import {loadConfig} from '../src/config/env.js'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {AttachmentPolicy} from '../src/domains/attachments/policy.js'
import {AttachmentService} from '../src/domains/attachments/service.js'
import {PostWriteService} from '../src/domains/posts/writes.js'
import {SessionService} from '../src/security/session.js'

describe('POST-04 attachment policy', () => {
  it('maps supported MIME families and rejects unsafe inputs', () => {
    expect(AttachmentPolicy.definition('application/pdf').kind).toBe('pdf')
    expect(AttachmentPolicy.definition('video/mp4').kind).toBe('video')
    expect(() => AttachmentPolicy.definition('application/x-executable')).toThrow(/Unsupported/)
    expect(() => AttachmentPolicy.safeFilename('../../')).toThrow(/filename/)
    expect(() => AttachmentPolicy.validateSize(AttachmentPolicy.definition('image/png'), 0)).toThrow(/limit/)
    expect(() => AttachmentPolicy.validateSize(AttachmentPolicy.definition('image/png'), 20 * 1024 * 1024 + 1)).toThrow(/limit/)
    expect(AttachmentPolicy.definition('application/vnd.ms-powerpoint').kind).toBe('document')
    expect(AttachmentPolicy.definition('application/vnd.ms-excel').kind).toBe('document')
  })
})

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('POST-04 attachment integration', () => {
  let db: ModulaDb
  let root: string
  let service: AttachmentService
  let posts: PostWriteService
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let serverDb: Awaited<ReturnType<typeof createServer>>['db']
  let bearer: string
  let attackerBearer: string
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10)
  const owner = identity('owner', suffix)
  const attacker = identity('attacker', suffix)
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64',
  )

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    root = await mkdtemp(join(tmpdir(), 'modula-post04-'))
    const config = configFor(root)
    service = new AttachmentService(db, config)
    posts = new PostWriteService(db, config)
    await seedIdentity(db, owner)
    await seedIdentity(db, attacker)
    bearer = (await new SessionService(db, config).createSession(owner.actorId, STANDARD_SESSION_CAPABILITIES)).token
    attackerBearer = (await new SessionService(db, config).createSession(attacker.actorId, STANDARD_SESSION_CAPABILITIES)).token
    const server = await createServer(config)
    app = server.app
    serverDb = server.db
    await app.ready()
  })

  afterAll(async () => {
    await app?.close()
    await serverDb?.destroy()
    await db?.destroy()
    if (root) await rm(root, {recursive: true, force: true})
  })

  it('uploads, verifies, binds in order and returns embedded content', async () => {
    const checksum = createHash('sha256').update(png).digest('hex')
    const first = await service.createUpload(owner.accountId, {filename: 'first.png', mimeType: 'image/png', size: png.length, checksum})
    const second = await service.createUpload(owner.accountId, {filename: 'second.png', mimeType: 'image/png', size: png.length})
    const inspected = await service.upload(owner.accountId, first.uploadId, png)
    expect(inspected).toMatchObject({width: 1, height: 1})
    await service.upload(owner.accountId, second.uploadId, png)
    const post = await posts.create(owner.actorId, {
      text: 'ordered content', idempotencyKey: `post04-${suffix}`,
      content: [
        {type: 'image', attachmentId: second.attachmentId},
        {type: 'image', attachmentId: first.attachmentId},
      ],
    })
    expect(post.content?.map(item => item.attachment.id)).toEqual([second.attachmentId, first.attachmentId])
    expect(post.content?.every(item => item.attachment.status === 'ready')).toBe(true)
  })

  it('hydrates Reels from real video post attachments and excludes private or deleted posts', async () => {
    // Container signature fixture tests the API contract, not AVPlayer decoding.
    const video = Buffer.from('00000018667479706d703432000000006d70343269736f6d', 'hex')
    const upload = await service.createUpload(owner.accountId, {filename: 'reel.mp4', mimeType: 'video/mp4', size: video.length})
    await service.upload(owner.accountId, upload.uploadId, video)
    const post = await posts.create(owner.actorId, {text: 'Video post #modula', audience: 'public', content: [{type: 'video', attachmentId: upload.attachmentId}]})
    const response = await app.inject({method: 'GET', url: '/v1/reels', headers: {authorization: `Bearer ${bearer}`}})
    expect(response.statusCode).toBe(200)
    const reel = response.json().data.find((item: any) => item.id === post.id)
    expect(reel.post.id).toBe(post.id)
    expect(reel.post.content[0].attachment).toMatchObject({id: upload.attachmentId, kind: 'video', status: 'ready'})
    expect(reel.post.content[0].attachment.originalURL).toContain(`/v1/attachments/${upload.attachmentId}/content`)
    await db.updateTable('posts').set({audience: 'private'}).where('id', '=', post.id).execute()
    const privateList = await app.inject({method: 'GET', url: '/v1/reels'})
    expect(privateList.json().data.some((item: any) => item.id === post.id)).toBe(false)
    await db.updateTable('posts').set({audience: 'public', deleted_at: new Date()}).where('id', '=', post.id).execute()
    const deletedList = await app.inject({method: 'GET', url: '/v1/reels'})
    expect(deletedList.json().data.some((item: any) => item.id === post.id)).toBe(false)
  })

  it('blocks cross-account, mismatched bytes, reuse and unready publication', async () => {
    const upload = await service.createUpload(owner.accountId, {filename: 'private.pdf', mimeType: 'application/pdf', size: 8})
    await expect(service.upload(attacker.accountId, upload.uploadId, Buffer.from('%PDF-1\n'))).rejects.toMatchObject({code: 'FORBIDDEN'})
    await expect(service.upload(owner.accountId, upload.uploadId, Buffer.from('not-pdf!'))).rejects.toMatchObject({code: 'VALIDATION_FAILED'})

    const ready = await service.createUpload(owner.accountId, {filename: 'owned.png', mimeType: 'image/png', size: png.length})
    await service.upload(owner.accountId, ready.uploadId, png)
    await expect(service.upload(owner.accountId, ready.uploadId, png)).rejects.toMatchObject({code: 'CONFLICT'})
    await expect(posts.create(attacker.actorId, {text: '', content: [{type: 'image', attachmentId: ready.attachmentId}]}))
      .rejects.toMatchObject({code: 'FORBIDDEN'})

    const unready = await service.createUpload(owner.accountId, {filename: 'later.pdf', mimeType: 'application/pdf', size: 8})
    await expect(posts.create(attacker.actorId, {text: '', content: [{type: 'pdf', attachmentId: unready.attachmentId}]}))
      .rejects.toMatchObject({code: 'FORBIDDEN'})
    await expect(posts.create(owner.actorId, {text: '', content: [{type: 'pdf', attachmentId: unready.attachmentId}]}))
      .rejects.toMatchObject({code: 'CONFLICT'})
    await expect(posts.create(owner.actorId, {text: '', content: [{type: 'pdf', attachmentId: '------------------------------------'}]}))
      .rejects.toMatchObject({code: 'VALIDATION_FAILED'})

    const disguised = Buffer.from('00000018667479706865696300000000', 'hex')
    const fakeVideo = await service.createUpload(owner.accountId, {filename: 'fake.mp4', mimeType: 'video/mp4', size: disguised.length})
    await expect(service.upload(owner.accountId, fakeVideo.uploadId, disguised)).rejects.toMatchObject({code: 'VALIDATION_FAILED'})

    const authoritative = Buffer.from('%PDF-1\n')
    const fakeExtension = await service.createUpload(owner.accountId, {filename: 'looks-like-a-photo.jpg', mimeType: 'application/pdf', size: authoritative.length})
    const uploaded = await service.upload(owner.accountId, fakeExtension.uploadId, authoritative)
    expect(uploaded.kind).toBe('pdf')
    expect(uploaded.mimeType).toBe('application/pdf')
  })

  it('rejects expired sessions and atomically claims concurrent uploads', async () => {
    const expired = await service.createUpload(owner.accountId, {filename: 'expired.png', mimeType: 'image/png', size: png.length})
    await db.updateTable('attachment_upload_sessions').set({expires_at: new Date(0)}).where('upload_id', '=', expired.uploadId).execute()
    await expect(service.upload(owner.accountId, expired.uploadId, png)).rejects.toMatchObject({code: 'CONFLICT'})

    const concurrent = await service.createUpload(owner.accountId, {filename: 'once.png', mimeType: 'image/png', size: png.length})
    const results = await Promise.allSettled([
      service.upload(owner.accountId, concurrent.uploadId, png),
      service.upload(owner.accountId, concurrent.uploadId, png),
    ])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)

    const reaped = await service.createUpload(owner.accountId, {filename: 'reaped.png', mimeType: 'image/png', size: png.length})
    async function* expireDuringTransfer() {
      yield png.subarray(0, 16)
      await db.transaction().execute(async trx => {
        await trx.updateTable('attachment_upload_sessions').set({state: 'expired', updated_at: new Date()})
          .where('upload_id', '=', reaped.uploadId).execute()
        await trx.updateTable('attachments').set({status: 'expired', updated_at: new Date()})
          .where('attachment_id', '=', reaped.attachmentId).execute()
      })
      yield png.subarray(16)
    }
    await expect(service.upload(owner.accountId, reaped.uploadId, expireDuringTransfer())).rejects.toMatchObject({code: 'CONFLICT'})
    expect(await db.selectFrom('attachment_upload_sessions').select('state').where('upload_id', '=', reaped.uploadId).executeTakeFirstOrThrow())
      .toMatchObject({state: 'expired'})
    expect(await db.selectFrom('attachments').select(['status', 'storage_key']).where('attachment_id', '=', reaped.attachmentId).executeTakeFirstOrThrow())
      .toMatchObject({status: 'expired', storage_key: null})
    await expect(access(join(root, 'attachments', `${reaped.attachmentId}.png`))).rejects.toThrow()
  })

  it('accepts a streamed binary through the authenticated HTTP contract', async () => {
    const created = await app.inject({
      method: 'POST', url: '/v1/attachments/uploads',
      headers: {authorization: `Bearer ${bearer}`},
      payload: {filename: 'route.png', mimeType: 'image/png', size: png.length},
    })
    expect(created.statusCode, created.body).toBe(201)
    const session = created.json().data
    const uploaded = await app.inject({
      method: 'PUT', url: `/v1/attachments/uploads/${session.uploadId}/content`,
      headers: {authorization: `Bearer ${bearer}`, 'content-type': 'application/octet-stream'},
      payload: png,
    })
    expect(uploaded.statusCode, uploaded.body).toBe(200)
    expect(uploaded.json().data.attachment).toMatchObject({id: session.attachmentId, status: 'ready', kind: 'image'})

    const privateContent = await app.inject({method: 'GET', url: `/v1/attachments/${session.attachmentId}/content`})
    expect(privateContent.statusCode, privateContent.body).toBe(403)
    const ownerContent = await app.inject({
      method: 'GET', url: `/v1/attachments/${session.attachmentId}/content`,
      headers: {authorization: `Bearer ${bearer}`},
    })
    expect(ownerContent.statusCode, ownerContent.body).toBe(200)
    expect(ownerContent.rawPayload.equals(png)).toBe(true)

    const published = await app.inject({
      method: 'POST', url: '/v1/posts', headers: {authorization: `Bearer ${bearer}`},
      payload: {text: 'HTTP round trip', idempotencyKey: `http-${suffix}`, content: [{type: 'image', attachmentId: session.attachmentId}]},
    })
    expect(published.statusCode, published.body).toBe(201)
    expect(published.json().data.content[0].attachment.id).toBe(session.attachmentId)
    const repeated = await app.inject({
      method: 'POST', url: '/v1/posts', headers: {authorization: `Bearer ${bearer}`},
      payload: {text: 'HTTP round trip', idempotencyKey: `http-${suffix}`, content: [{type: 'image', attachmentId: session.attachmentId}]},
    })
    expect(repeated.statusCode, repeated.body).toBe(201)
    expect(repeated.json().data.id).toBe(published.json().data.id)

    const content = await app.inject({method: 'GET', url: `/v1/attachments/${session.attachmentId}/content`})
    expect(content.statusCode, content.body).toBe(200)
    expect(content.rawPayload.equals(png)).toBe(true)
  })

  it('binds owned image attachments as persistent avatar and cover media', async () => {
    const avatar = await service.createUpload(owner.accountId, {filename: 'avatar.png', mimeType: 'image/png', size: png.length})
    await service.upload(owner.accountId, avatar.uploadId, png)
    const bound = await app.inject({
      method: 'POST', url: '/v1/profiles/me/avatar',
      headers: {authorization: `Bearer ${bearer}`}, payload: {attachmentId: avatar.attachmentId},
    })
    expect(bound.statusCode, bound.body).toBe(200)
    expect(bound.json().data.avatarUri).toBe(`https://api.example.test/v1/attachments/${avatar.attachmentId}/content`)

    const fresh = await app.inject({method: 'GET', url: `/v1/profiles/${owner.handle}`})
    expect(fresh.statusCode, fresh.body).toBe(200)
    expect(fresh.json().data.avatarUri).toBe(bound.json().data.avatarUri)
    const publicContent = await app.inject({method: 'GET', url: `/v1/attachments/${avatar.attachmentId}/content`})
    expect(publicContent.statusCode, publicContent.body).toBe(200)
    expect(publicContent.rawPayload.equals(png)).toBe(true)

    const cover = await service.createUpload(owner.accountId, {filename: 'cover.png', mimeType: 'image/png', size: png.length})
    await service.upload(owner.accountId, cover.uploadId, png)
    const coverBound = await app.inject({
      method: 'POST', url: '/v1/profiles/me/cover',
      headers: {authorization: `Bearer ${bearer}`}, payload: {attachmentId: cover.attachmentId},
    })
    expect(coverBound.statusCode, coverBound.body).toBe(200)
    expect(coverBound.json().data.coverUri).toContain(cover.attachmentId)

    const followed = await app.inject({
      method: 'POST', url: `/v1/profiles/${owner.profileId}/follow`,
      headers: {authorization: `Bearer ${attackerBearer}`},
    })
    expect(followed.statusCode, followed.body).toBe(200)
    await db.updateTable('profiles').set({visibility: 'followers'}).where('actor_id', '=', owner.actorId).execute()
    const anonymousFollowerCover = await app.inject({method: 'GET', url: `/v1/attachments/${cover.attachmentId}/content`})
    expect(anonymousFollowerCover.statusCode, anonymousFollowerCover.body).toBe(403)
    const followerCover = await app.inject({
      method: 'GET', url: `/v1/attachments/${cover.attachmentId}/content`,
      headers: {authorization: `Bearer ${attackerBearer}`},
    })
    expect(followerCover.statusCode, followerCover.body).toBe(200)

    await db.updateTable('profiles').set({visibility: 'private'}).where('actor_id', '=', owner.actorId).execute()
    const privateCover = await app.inject({method: 'GET', url: `/v1/attachments/${cover.attachmentId}/content`})
    expect(privateCover.statusCode, privateCover.body).toBe(403)
    const ownerCover = await app.inject({
      method: 'GET', url: `/v1/attachments/${cover.attachmentId}/content`,
      headers: {authorization: `Bearer ${bearer}`},
    })
    expect(ownerCover.statusCode, ownerCover.body).toBe(200)

    const denied = await app.inject({
      method: 'POST', url: '/v1/profiles/me/avatar',
      headers: {authorization: `Bearer ${attackerBearer}`}, payload: {attachmentId: avatar.attachmentId},
    })
    expect(denied.statusCode, denied.body).toBe(403)

    const removed = await app.inject({
      method: 'DELETE', url: '/v1/profiles/me/avatar', headers: {authorization: `Bearer ${bearer}`},
    })
    expect(removed.statusCode, removed.body).toBe(200)
    expect(removed.json().data.avatarUri).toBeUndefined()
  })

  it('binds comment media exactly once and expires it when the comment is deleted', async () => {
    const upload = await service.createUpload(owner.accountId, {filename: 'comment.png', mimeType: 'image/png', size: png.length})
    await service.upload(owner.accountId, upload.uploadId, png)
    const post = await app.inject({
      method: 'POST', url: '/v1/posts', headers: {authorization: `Bearer ${bearer}`},
      payload: {text: 'Comment media lifecycle', audience: 'public', idempotencyKey: `comment-media-${suffix}`},
    })
    expect(post.statusCode, post.body).toBe(201)
    const media = [{type: 'attachment', attachmentId: upload.attachmentId}]
    const comment = await app.inject({
      method: 'POST', url: `/v1/posts/${post.json().data.id}/comments`,
      headers: {authorization: `Bearer ${bearer}`}, payload: {text: 'Bound media', media},
    })
    expect(comment.statusCode, comment.body).toBe(201)
    const bound = await db.selectFrom('attachments').select(['status', 'attached_at'])
      .where('attachment_id', '=', upload.attachmentId).executeTakeFirstOrThrow()
    expect(bound.status).toBe('ready')
    expect(bound.attached_at).not.toBeNull()

    const duplicate = await app.inject({
      method: 'POST', url: `/v1/posts/${post.json().data.id}/comments`,
      headers: {authorization: `Bearer ${bearer}`}, payload: {text: 'Must not reuse media', media},
    })
    expect(duplicate.statusCode, duplicate.body).toBe(400)

    const removed = await app.inject({
      method: 'DELETE', url: `/v1/comments/${comment.json().data.comment_id}`,
      headers: {authorization: `Bearer ${bearer}`},
    })
    expect(removed.statusCode, removed.body).toBe(200)
    const expired = await db.selectFrom('attachments').select(['status', 'attached_at'])
      .where('attachment_id', '=', upload.attachmentId).executeTakeFirstOrThrow()
    expect(expired).toMatchObject({status: 'expired', attached_at: null})
    const content = await app.inject({
      method: 'GET', url: `/v1/attachments/${upload.attachmentId}/content`,
      headers: {authorization: `Bearer ${bearer}`},
    })
    expect(content.statusCode).toBe(404)
  })
})

function identity(kind: string, suffix: string) {
  return {accountId: `post04-${kind}-account-${suffix}`, actorId: `post04-${kind}-actor-${suffix}`, profileId: `post04-${kind}-profile-${suffix}`, handle: `p04${kind}${suffix}`.slice(0, 24)}
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
    NODE_ENV: 'test', MODULA_ENVIRONMENT: 'development', MODULA_API_HOST: '127.0.0.1', MODULA_API_PORT: '4027',
    MODULA_PUBLIC_API_URL: 'https://api.example.test', MODULA_DATABASE_URL: databaseUrl!,
    MODULA_ALLOWED_ORIGINS: 'https://modula.digital', MODULA_MEDIA_ROOT: root,
    MODULA_PREVIEW_WRITES_ENABLED: 'true', MODULA_RATE_LIMIT_ENABLED: 'false',
  })
}
