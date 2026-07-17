import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {runSeed} from '../seeds/preview-seed.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIf = databaseUrl ? describe : describe.skip

describeIf('Modula API integration', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4021'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4021'
    process.env.MODULA_DATABASE_URL = databaseUrl!
    process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
    process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
    process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
    process.env.MODULA_RATE_LIMIT_ENABLED = 'true'
    await migrateUp(databaseUrl!)
    await runSeed(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  it('validates configuration refuses wildcard CORS', () => {
    expect(() =>
      loadConfig({
        ...process.env,
        MODULA_ALLOWED_ORIGINS: '*',
        MODULA_PUBLIC_API_URL: 'http://127.0.0.1:4021',
        MODULA_DATABASE_URL: databaseUrl!,
      }),
    ).toThrow(/origin list/)
  })

  it('lives without database dependency', async () => {
    const res = await app.inject({method: 'GET', url: '/v1/health/live'})
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.meta.requestId).toBeTruthy()
  })

  it('is ready after migrations and seed', async () => {
    const res = await app.inject({method: 'GET', url: '/v1/health/ready'})
    expect(res.statusCode).toBe(200)
    expect(res.json().data.status).toBe('ready')
  })

  it('returns metadata capabilities', async () => {
    const res = await app.inject({method: 'GET', url: '/v1/meta'})
    const body = res.json()
    expect(body.data.capabilities.publicRead).toBe(true)
    expect(body.data.capabilities.authentication).toBe(true)
    expect(body.data.capabilities.mutations).toBe(true)
    expect(body.data.capabilities.atprotoOAuth).toBe(true)
  })

  it('returns home feed and profile', async () => {
    const feed = await app.inject({method: 'GET', url: '/v1/feed/home'})
    expect(feed.statusCode).toBe(200)
    expect(feed.json().data.items.length).toBeGreaterThan(0)
    const profile = await app.inject({method: 'GET', url: '/v1/profiles/andrei.modula'})
    expect(profile.statusCode).toBe(200)
    expect(profile.json().data.handle).toBe('andrei.modula')
  })

  it('rejects missing profile and invalid handle', async () => {
    const missing = await app.inject({method: 'GET', url: '/v1/profiles/missing.modula'})
    expect(missing.statusCode).toBe(404)
    const invalid = await app.inject({method: 'GET', url: '/v1/profiles/ab'})
    expect(invalid.statusCode).toBe(400)
  })

  it('rejects excessive page size and invalid cursor', async () => {
    const large = await app.inject({method: 'GET', url: '/v1/feed/home?limit=999'})
    expect(large.statusCode).toBe(400)
    const cursor = await app.inject({method: 'GET', url: '/v1/feed/home?cursor=' + 'x'.repeat(600)})
    expect(cursor.statusCode).toBe(400)
  })

  it('allows and rejects CORS origins', async () => {
    const allow = await app.inject({
      method: 'GET',
      url: '/v1/meta',
      headers: {origin: 'https://modula.digital'},
    })
    expect(allow.headers['access-control-allow-origin']).toBe('https://modula.digital')
    const deny = await app.inject({
      method: 'GET',
      url: '/v1/meta',
      headers: {origin: 'https://evil.example'},
    })
    expect(deny.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('requires authentication for write routes', async () => {
    const res = await app.inject({method: 'POST', url: '/v1/posts', payload: {text: 'nope'}})
    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('UNAUTHENTICATED')
  })

  it('serves discover activity and reels', async () => {
    for (const path of ['/v1/discover', '/v1/activity', '/v1/reels']) {
      const res = await app.inject({method: 'GET', url: path})
      expect(res.statusCode).toBe(200)
      expect(res.json().ok).toBe(true)
    }
  })
})

describe('config unit', () => {
  it('refuses non-https public URL in preview', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        MODULA_ENVIRONMENT: 'preview',
        MODULA_API_HOST: '127.0.0.1',
        MODULA_API_PORT: '4020',
        MODULA_PUBLIC_API_URL: 'http://api.example',
        MODULA_DATABASE_URL: 'postgresql://modula_api:secret@db/modula',
        MODULA_ALLOWED_ORIGINS: 'https://modula.digital',
        MODULA_PREVIEW_WRITES_ENABLED: 'false',
      }),
    ).toThrow(/HTTPS/)
  })
})
