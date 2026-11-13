import Fastify from 'fastify'
import {describe, expect, it} from 'vitest'
import {
  nativeEndpointOptionsFromEnv,
  parseNodusReleaseDescriptor,
  registerNativeEndpointRoutes,
} from '../src/app/register-native-endpoint-routes.js'
import {hex, validDescriptor} from './helpers/nodus-release-fixture.js'

async function appWith(options: Parameters<typeof registerNativeEndpointRoutes>[4]) {
  const app = Fastify()
  // Unit tests never reach the database; any query would throw here.
  const db = new Proxy({}, {get: () => { throw new Error('database must not be touched') }}) as any
  app.addHook('onRequest', async request => {
    if (request.headers['x-test-actor']) (request as any).auth = {actorId: String(request.headers['x-test-actor'])}
  })
  await registerNativeEndpointRoutes(app, db, 'https://api.example.test', {feedConfig: {}}, options)
  await app.ready()
  return app
}

describe('GF native endpoints: Nodus release descriptor validation (mirrors NodusModelRelease.validate)', () => {
  it('accepts a valid descriptor and strips unknown keys', () => {
    const parsed = parseNodusReleaseDescriptor(JSON.stringify({...validDescriptor, extra: 'x', files: validDescriptor.files.map(f => ({...f, note: 1}))}))
    expect(parsed).toEqual(validDescriptor)
  })

  it('treats unset, blank and malformed configuration as no release', () => {
    expect(parseNodusReleaseDescriptor(undefined)).toBeNull()
    expect(parseNodusReleaseDescriptor('')).toBeNull()
    expect(parseNodusReleaseDescriptor('   ')).toBeNull()
    expect(parseNodusReleaseDescriptor('not json')).toBeNull()
    expect(parseNodusReleaseDescriptor('[]')).toBeNull()
  })

  it('rejects every descriptor Native would reject', () => {
    const first = validDescriptor.files[0]!
    const bad: unknown[] = [
      {...validDescriptor, schemaVersion: 2},
      {...validDescriptor, nodusVersion: ''},
      {...validDescriptor, artifactHash: 'sha256:XYZ'},
      {...validDescriptor, artifactHash: hex('a')},
      {...validDescriptor, manifestURL: 'http://cdn.example.test/m.json'},
      {...validDescriptor, manifestURL: 'https://user:pw@cdn.example.test/m.json'},
      {...validDescriptor, manifestSHA256: hex('B')},
      {...validDescriptor, files: []},
      {...validDescriptor, files: [{...first, path: '../escape'}]},
      {...validDescriptor, files: [{...first, path: '/abs'}]},
      {...validDescriptor, files: [{...first, path: 'a//b'}]},
      {...validDescriptor, files: [{...first, path: 'a\\b'}]},
      {...validDescriptor, files: [{...first, path: 'nodus-manifest.json'}]},
      {...validDescriptor, files: [first, first]},
      {...validDescriptor, files: [{...first, url: 'http://cdn.example.test/a'}]},
      {...validDescriptor, files: [{...first, sha256: first.sha256.toUpperCase()}]},
      {...validDescriptor, files: [{...first, bytes: 0}]},
      {...validDescriptor, files: [{...first, bytes: 1.5}]},
      {...validDescriptor, files: [{...first, bytes: '12'}]},
    ]
    for (const descriptor of bad) expect(parseNodusReleaseDescriptor(JSON.stringify(descriptor)), JSON.stringify(descriptor)).toBeNull()
  })

  it('reads configuration from the environment only, defaulting to disabled', () => {
    expect(nativeEndpointOptionsFromEnv({})).toEqual({nodusReleaseIosJson: undefined, reelsByIdEnabled: false})
    expect(nativeEndpointOptionsFromEnv({MODULA_REELS_BY_ID_ENABLED: '1'}).reelsByIdEnabled).toBe(false)
    expect(nativeEndpointOptionsFromEnv({MODULA_REELS_BY_ID_ENABLED: 'true', MODULA_NODUS_RELEASE_IOS_JSON: '{}'}))
      .toEqual({nodusReleaseIosJson: '{}', reelsByIdEnabled: true})
  })
})

describe('GF native endpoints: GET /v1/intelligence/nodus/releases/latest', () => {
  it('returns 404 when no release is configured, never a fabricated descriptor', async () => {
    const app = await appWith({})
    const res = await app.inject({method: 'GET', url: '/v1/intelligence/nodus/releases/latest?platform=ios&hostVersion=0.1.0'})
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ok: false, error: {code: 'NOT_FOUND'}})
    expect(res.headers['cache-control']).toBe('no-store')
    await app.close()
  })

  it('returns 404 when the configured descriptor is invalid', async () => {
    const app = await appWith({nodusReleaseIosJson: JSON.stringify({...validDescriptor, manifestURL: 'http://insecure.test/m'})})
    expect((await app.inject({method: 'GET', url: '/v1/intelligence/nodus/releases/latest?platform=ios'})).statusCode).toBe(404)
    await app.close()
  })

  it('serves the configured descriptor as the raw NodusModelRelease body without auth', async () => {
    const app = await appWith({nodusReleaseIosJson: JSON.stringify(validDescriptor)})
    const res = await app.inject({method: 'GET', url: '/v1/intelligence/nodus/releases/latest?platform=ios&hostVersion=0.1.0', headers: {accept: 'application/json'}})
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(validDescriptor)
    expect(res.json()).not.toHaveProperty('ok')
    expect(res.headers['cache-control']).toBe('no-store')
    // Missing platform defaults to ios; other platforms have no channel.
    expect((await app.inject({method: 'GET', url: '/v1/intelligence/nodus/releases/latest'})).statusCode).toBe(200)
    expect((await app.inject({method: 'GET', url: '/v1/intelligence/nodus/releases/latest?platform=android'})).statusCode).toBe(404)
    expect((await app.inject({method: 'GET', url: `/v1/intelligence/nodus/releases/latest?platform=${'x'.repeat(40)}`})).statusCode).toBe(400)
    await app.close()
  })
})

describe('GF native endpoints: GET /v1/reels/:id (no database)', () => {
  it('is 404 when disabled, before auth or id checks', async () => {
    const app = await appWith({reelsByIdEnabled: false})
    expect((await app.inject({method: 'GET', url: '/v1/reels/abc'})).statusCode).toBe(404)
    expect((await app.inject({method: 'GET', url: '/v1/reels/abc', headers: {'x-test-actor': 'a1'}})).statusCode).toBe(404)
    await app.close()
  })

  it('requires an authenticated session when enabled', async () => {
    const app = await appWith({reelsByIdEnabled: true})
    const res = await app.inject({method: 'GET', url: '/v1/reels/abc'})
    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ok: false, error: {code: 'UNAUTHENTICATED'}})
    await app.close()
  })

  it('rejects ids Native would never send with 400 before touching the database', async () => {
    const app = await appWith({reelsByIdEnabled: true})
    // Dot segments are normalised away by the router and never reach the handler.
    for (const id of ['%2E%2E', '.']) {
      expect([400, 404], id).toContain((await app.inject({method: 'GET', url: `/v1/reels/${id}`, headers: {'x-test-actor': 'a1'}})).statusCode)
    }
    // Fastify's default 100-character param cap answers 414 before the handler.
    expect((await app.inject({method: 'GET', url: `/v1/reels/${'x'.repeat(161)}`, headers: {'x-test-actor': 'a1'}})).statusCode).toBe(414)
    for (const id of ['a%20b', 'a%2Fb', 'r%C3%A9el', 'a%3Bdrop']) {
      const res = await app.inject({method: 'GET', url: `/v1/reels/${id}`, headers: {'x-test-actor': 'a1'}})
      expect(res.statusCode, id).toBe(400)
      expect(res.json()).toMatchObject({ok: false, error: {code: 'VALIDATION_FAILED'}})
    }
    await app.close()
  })
})
