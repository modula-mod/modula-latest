import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {runSeed} from '../seeds/preview-seed.js'
import {assertSafeHttpsUrl, isBlockedIp} from '../src/security/ssrf.js'
import {claimNextJob} from '../../greenfield-worker/src/jobs/claim.js'
import {createWorkerDb} from '../../greenfield-worker/src/database.js'
import {randomUUID} from 'node:crypto'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIf = databaseUrl ? describe : describe.skip

describeIf('Phase 6 security', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let andreiToken = ''
  let gaiaToken = ''
  let andreiPostId = ''

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4022'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4022'
    process.env.MODULA_DATABASE_URL = databaseUrl!
    process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
    process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
    process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
    process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
    process.env.MODULA_ATPROTO_ENABLED = 'true'
    await migrateUp(databaseUrl!)
    await runSeed(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()

    const andrei = await app.inject({
      method: 'POST',
      url: '/v1/auth/preview/session',
      payload: {handle: 'andrei.modula'},
    })
    andreiToken = andrei.json().data.accessToken
    const gaia = await app.inject({
      method: 'POST',
      url: '/v1/auth/preview/session',
      payload: {handle: 'gaia.modula'},
    })
    gaiaToken = gaia.json().data.accessToken

    const createdPost = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: {authorization: `Bearer ${andreiToken}`},
      payload: {text: 'Phase 6 security post', audience: 'public', idempotencyKey: 'sec-post-1'},
    })
    andreiPostId = createdPost.json().data.id
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('enables phase 6 capabilities in meta', async () => {
    const res = await app.inject({method: 'GET', url: '/v1/meta'})
    const caps = res.json().data.capabilities
    expect(caps.authentication).toBe(true)
    expect(caps.mutations).toBe(true)
    expect(caps.atprotoOAuth).toBe(true)
  })

  it('denies cross-actor post edit', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/posts/${andreiPostId}`,
      headers: {authorization: `Bearer ${gaiaToken}`},
      payload: {expectedVersion: 1, text: 'hijack'},
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('FORBIDDEN')
  })

  it('denies cross-actor profile edit via actorId field', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/profiles/me',
      headers: {authorization: `Bearer ${gaiaToken}`},
      payload: {displayName: 'Gaia', actorId: 'actor-andrei'},
    })
    expect(res.statusCode).toBe(403)
  })

  it('denies cross-actor connection access', async () => {
    const start = await app.inject({
      method: 'POST',
      url: '/v1/atproto/oauth/start',
      headers: {authorization: `Bearer ${andreiToken}`},
      payload: {returnRoute: '/settings/connections/atproto', clientKind: 'web'},
    })
    const state = start.json().data.state
    const callback = await app.inject({
      method: 'GET',
      url: `/v1/atproto/oauth/callback?preview=1&state=${state}&handle=andrei.preview.test&pdsUrl=https://bsky.social`,
      headers: {authorization: `Bearer ${andreiToken}`},
    })
    expect(callback.statusCode).toBe(200)
    const connectionId = callback.json().data.connection.id
    const other = await app.inject({
      method: 'GET',
      url: `/v1/atproto/connections/${connectionId}/status`,
      headers: {authorization: `Bearer ${gaiaToken}`},
    })
    expect(other.statusCode).toBe(404)
  })

  it('rejects expired and revoked sessions', async () => {
    const minted = await app.inject({
      method: 'POST',
      url: '/v1/auth/preview/session',
      payload: {handle: 'andrei.modula'},
    })
    const token = minted.json().data.accessToken
    const sessionId = minted.json().data.session.id
    await db.updateTable('sessions').set({status: 'expired'}).where('id', '=', sessionId).execute()
    const expired = await app.inject({
      method: 'GET',
      url: '/v1/sessions/me',
      headers: {authorization: `Bearer ${token}`},
    })
    expect(expired.statusCode).toBe(401)

    const minted2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/preview/session',
      payload: {handle: 'andrei.modula'},
    })
    const token2 = minted2.json().data.accessToken
    await app.inject({
      method: 'DELETE',
      url: '/v1/sessions/me',
      headers: {authorization: `Bearer ${token2}`},
    })
    const revoked = await app.inject({
      method: 'GET',
      url: '/v1/sessions/me',
      headers: {authorization: `Bearer ${token2}`},
    })
    expect(revoked.statusCode).toBe(401)
  })

  it('enforces missing capability', async () => {
    const minted = await app.inject({
      method: 'POST',
      url: '/v1/auth/preview/session',
      payload: {handle: 'andrei.modula'},
    })
    const sessionId = minted.json().data.session.id
    const token = minted.json().data.accessToken
    await db.deleteFrom('session_capabilities').where('session_id', '=', sessionId).execute()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: {authorization: `Bearer ${token}`},
      payload: {text: 'no caps'},
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('CAPABILITY_DISABLED')
  })

  it('supports idempotent post creation', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: {authorization: `Bearer ${andreiToken}`},
      payload: {text: 'idem', idempotencyKey: 'idem-1'},
    })
    const second = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: {authorization: `Bearer ${andreiToken}`},
      payload: {text: 'idem', idempotencyKey: 'idem-1'},
    })
    expect(first.statusCode).toBe(201)
    expect(second.json().data.id).toBe(first.json().data.id)
  })

  it('returns conflict on optimistic concurrency', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: {authorization: `Bearer ${andreiToken}`},
      payload: {text: 'versioned'},
    })
    const id = created.json().data.id
    const stale = await app.inject({
      method: 'PATCH',
      url: `/v1/posts/${id}`,
      headers: {authorization: `Bearer ${andreiToken}`},
      payload: {expectedVersion: 999, text: 'nope'},
    })
    expect(stale.statusCode).toBe(409)
    expect(stale.json().error.code).toBe('CONFLICT')
  })

  it('filters blocks and mutes in search', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/profiles/profile-gaia/block',
      headers: {authorization: `Bearer ${andreiToken}`},
    })
    const search = await app.inject({
      method: 'GET',
      url: '/v1/search?q=Gaia&type=profiles',
      headers: {authorization: `Bearer ${andreiToken}`},
    })
    expect(search.statusCode).toBe(200)
    const handles = search.json().data.results
      .filter((item: any) => item.entityType === 'profile')
      .map((item: any) => item.metadata.handle)
    expect(handles).not.toContain('gaia.modula')
    await app.inject({
      method: 'DELETE',
      url: '/v1/profiles/profile-gaia/block',
      headers: {authorization: `Bearer ${andreiToken}`},
    })
  })

  it('keeps reports private to reporter envelope', async () => {
    const report = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: {authorization: `Bearer ${andreiToken}`},
      payload: {targetType: 'post', targetId: andreiPostId, category: 'spam', details: 'test'},
    })
    expect(report.statusCode).toBe(201)
    expect(report.json().data.category).toBe('spam')
    const body = JSON.stringify(report.json())
    expect(body.toLowerCase()).not.toContain('refresh')
  })

  it('rejects invalid, reused, expired OAuth state and invalid return route', async () => {
    const badReturn = await app.inject({
      method: 'POST',
      url: '/v1/atproto/oauth/start',
      headers: {authorization: `Bearer ${andreiToken}`},
      payload: {returnRoute: 'https://evil.example'},
    })
    expect(badReturn.statusCode).toBe(400)

    const start = await app.inject({
      method: 'POST',
      url: '/v1/atproto/oauth/start',
      headers: {authorization: `Bearer ${andreiToken}`},
      payload: {returnRoute: '/settings/connections/atproto'},
    })
    const state = start.json().data.state
    const first = await app.inject({
      method: 'GET',
      url: `/v1/atproto/oauth/callback?state=${state}`,
      headers: {authorization: `Bearer ${andreiToken}`},
    })
    expect(first.statusCode).toBe(200)
    const reuse = await app.inject({
      method: 'GET',
      url: `/v1/atproto/oauth/callback?state=${state}`,
      headers: {authorization: `Bearer ${andreiToken}`},
    })
    expect(reuse.statusCode).toBe(403)

    const invalid = await app.inject({
      method: 'GET',
      url: '/v1/atproto/oauth/callback?state=does-not-exist',
      headers: {authorization: `Bearer ${andreiToken}`},
    })
    expect(invalid.statusCode).toBe(400)

    const start2 = await app.inject({
      method: 'POST',
      url: '/v1/atproto/oauth/start',
      headers: {authorization: `Bearer ${andreiToken}`},
      payload: {returnRoute: '/settings/connections/atproto'},
    })
    const state2 = start2.json().data.state
    await db
      .updateTable('atproto_oauth_states')
      .set({expires_at: new Date(Date.now() - 1000)})
      .where('state', '=', state2)
      .execute()
    const expired = await app.inject({
      method: 'GET',
      url: `/v1/atproto/oauth/callback?state=${state2}`,
      headers: {authorization: `Bearer ${andreiToken}`},
    })
    expect(expired.statusCode).toBe(403)
  })

  it('blocks private-IP PDS and metadata SSRF cases', async () => {
    expect(isBlockedIp('127.0.0.1')).toBe(true)
    expect(isBlockedIp('169.254.169.254')).toBe(true)
    expect(isBlockedIp('10.0.0.5')).toBe(true)
    await expect(assertSafeHttpsUrl('http://example.com')).rejects.toThrow(/https/i)
    await expect(assertSafeHttpsUrl('https://127.0.0.1/metadata')).rejects.toThrow(/Blocked|disallowed/i)
    const privatePds = await app.inject({
      method: 'POST',
      url: '/v1/atproto/oauth/start',
      headers: {authorization: `Bearer ${andreiToken}`},
      payload: {returnRoute: '/settings/connections/atproto'},
    })
    const state = privatePds.json().data.state
    const callback = await app.inject({
      method: 'GET',
      url: `/v1/atproto/oauth/callback?preview=1&state=${state}&pdsUrl=https://127.0.0.1`,
      headers: {authorization: `Bearer ${andreiToken}`},
    })
    expect(callback.statusCode).toBe(403)
  })

  it('enforces job lease exclusivity with SKIP LOCKED', async () => {
    const workerDb = createWorkerDb(databaseUrl!)
    const jobId = randomUUID()
    await db
      .insertInto('background_jobs')
      .values({
        id: jobId,
        job_type: 'search.index',
        payload: {postId: 'x'},
        status: 'pending',
        priority: 1,
        available_at: new Date(),
        lease_owner: null,
        lease_expires_at: null,
        attempt_count: 0,
        maximum_attempts: 5,
        last_error: null,
        created_at: new Date(),
        updated_at: new Date(),
        completed_at: null,
      })
      .execute()
    const first = await claimNextJob(workerDb as any, 'worker-a', 30)
    const second = await claimNextJob(workerDb as any, 'worker-b', 30)
    expect(first?.id).toBe(jobId)
    expect(second?.id === jobId).toBe(false)
    await workerDb.destroy()
  })
})
