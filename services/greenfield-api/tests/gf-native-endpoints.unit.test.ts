import {createPublicKey, verify} from 'node:crypto'
import Fastify from 'fastify'
import {describe, expect, it} from 'vitest'
import {
  nodusModelManifestBytes,
  nodusModelManifestSha256,
  nodusReleaseDescriptorV2Problem,
  parseNodusReleaseDescriptorV2,
  stripNodusReleaseDescriptorV2ToV1,
} from '../src/app/nodus-release-descriptor.js'
import {
  nativeEndpointOptionsFromEnv,
  nodusReleaseDescriptorProblem,
  parseNodusReleaseDescriptor,
  registerNativeEndpointRoutes,
} from '../src/app/register-native-endpoint-routes.js'
import {buildSignedV2Descriptor, hex, makeNodusTestKey, validDescriptor, validDescriptorV2} from './helpers/nodus-release-fixture.js'

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
describe('GF native endpoints: Nodus release descriptor problems (operator-facing reasons)', () => {
  it('returns null for a valid descriptor', () => {
    expect(nodusReleaseDescriptorProblem(JSON.stringify(validDescriptor))).toBeNull()
  })

  it('names the first problem for each invalid shape', () => {
    const first = validDescriptor.files[0]!
    const cases: [unknown, RegExp][] = [
      [undefined, /unset or blank/],
      ['not json', /not valid JSON/],
      [[], /must be a JSON object/],
      [{...validDescriptor, schemaVersion: 2}, /schemaVersion must be 1/],
      [{...validDescriptor, nodusVersion: ''}, /nodusVersion/],
      [{...validDescriptor, artifactHash: 'sha256:XYZ'}, /artifactHash/],
      [{...validDescriptor, manifestURL: 'http://cdn.example.test/m.json'}, /manifestURL/],
      [{...validDescriptor, manifestSHA256: hex('B')}, /manifestSHA256/],
      [{...validDescriptor, files: []}, /files must be a non-empty array/],
      [{...validDescriptor, files: [{...first, path: '../escape'}]}, /files\[0\]\.path must be a safe relative path/],
      [{...validDescriptor, files: [first, first]}, /duplicated/],
      [{...validDescriptor, files: [{...first, url: 'http://cdn.example.test/a'}]}, /files\[0\]\.url/],
      [{...validDescriptor, files: [{...first, sha256: 'zz'}]}, /files\[0\]\.sha256/],
      [{...validDescriptor, files: [{...first, bytes: 0}]}, /files\[0\]\.bytes/],
    ]
    for (const [descriptor, pattern] of cases) {
      const raw = typeof descriptor === 'string' || descriptor === undefined ? (descriptor as string | undefined) : JSON.stringify(descriptor)
      expect(nodusReleaseDescriptorProblem(raw), JSON.stringify(descriptor)).toMatch(pattern)
    }
  })

  it('parse and problem agree on every shape', () => {
    expect(parseNodusReleaseDescriptor(JSON.stringify(validDescriptor))).toEqual(validDescriptor)
    expect(nodusReleaseDescriptorProblem(JSON.stringify(validDescriptor))).toBeNull()
    for (const bad of [
      {...validDescriptor, schemaVersion: 2},
      {...validDescriptor, files: []},
      {...validDescriptor, files: [{...validDescriptor.files[0]!, bytes: -1}]},
    ]) {
      expect(parseNodusReleaseDescriptor(JSON.stringify(bad))).toBeNull()
      expect(nodusReleaseDescriptorProblem(JSON.stringify(bad))).not.toBeNull()
    }
  })
})

describe('GF native endpoints: Nodus release descriptor v2 (model-as-patch registry)', () => {
  it('accepts a valid v2 descriptor and its manifest hash is self-consistent', () => {
    const descriptor = validDescriptorV2()
    expect(nodusReleaseDescriptorV2Problem(JSON.stringify(descriptor))).toBeNull()
    expect(parseNodusReleaseDescriptorV2(JSON.stringify(descriptor))).toEqual(descriptor)
    expect(nodusModelManifestSha256(descriptor)).toBe(descriptor.manifestSHA256)
  })

  it('rejects every v2 shape the registry would reject', () => {
    const descriptor = validDescriptorV2()
    const bad: unknown[] = [
      {...descriptor, schemaVersion: 1},
      {...descriptor, releaseNumber: 0},
      {...descriptor, releaseNumber: 1.5},
      {...descriptor, signature: 'x'},
      {...descriptor, signature: 'A'.repeat(85)},
      {...descriptor, signingKeyId: ''},
      {...descriptor, signingKeyId: 'x'},
      {...descriptor, publishedAt: 'not-a-date'},
      {...descriptor, supersedes: 'x'.repeat(65)},
      {...descriptor, supersedes: 3},
      {...descriptor, manifestSHA256: hex('F')},
      {...descriptor, files: []},
    ]
    for (const candidate of bad) {
      expect(parseNodusReleaseDescriptorV2(JSON.stringify(candidate)), JSON.stringify(candidate)).toBeNull()
      expect(nodusReleaseDescriptorV2Problem(JSON.stringify(candidate))).not.toBeNull()
    }
  })

  it('names the first v2 problem', () => {
    const descriptor = validDescriptorV2()
    expect(nodusReleaseDescriptorV2Problem(JSON.stringify({...descriptor, releaseNumber: 0}))).toMatch(/releaseNumber/)
    expect(nodusReleaseDescriptorV2Problem(JSON.stringify({...descriptor, signature: 'bad'}))).toMatch(/signature/)
    expect(nodusReleaseDescriptorV2Problem(JSON.stringify({...descriptor, signingKeyId: ''}))).toMatch(/signingKeyId/)
    expect(nodusReleaseDescriptorV2Problem(JSON.stringify({...descriptor, publishedAt: 'nope'}))).toMatch(/publishedAt/)
  })

  it('strips a v2 descriptor to the v1 shape today\u2019s client decodes', () => {
    const descriptor = validDescriptorV2()
    const stripped = stripNodusReleaseDescriptorV2ToV1(descriptor)
    expect(stripped).toEqual({
      schemaVersion: 1,
      nodusVersion: descriptor.nodusVersion,
      artifactHash: descriptor.artifactHash,
      manifestURL: descriptor.manifestURL,
      manifestSHA256: descriptor.manifestSHA256,
      files: descriptor.files,
    })
    expect(stripped).not.toHaveProperty('releaseNumber')
    expect(stripped).not.toHaveProperty('signature')
    expect(stripped).not.toHaveProperty('signingKeyId')
  })

  it('the fixture signature really verifies over the canonical manifest bytes', () => {
    const key = makeNodusTestKey()
    const descriptor = buildSignedV2Descriptor({
      key,
      publicApiUrl: 'https://api.test.modula.digital',
      version: '2.0.0',
      files: [{path: 'weights/model.safetensors', bytes: Buffer.alloc(64, 9)}],
    })
    const publicKey = createPublicKey(key.publicKeyPem)
    expect(verify(null, nodusModelManifestBytes(descriptor), publicKey, Buffer.from(descriptor.signature, 'base64url'))).toBe(true)
    // One flipped manifest byte breaks the signature.
    const tampered = {...descriptor, nodusVersion: '2.0.1'}
    expect(verify(null, nodusModelManifestBytes(tampered), publicKey, Buffer.from(descriptor.signature, 'base64url'))).toBe(false)
  })
})

describe('GF native endpoints: GET /v1/intelligence/nodus/releases/latest fallback order (DB > env > 404)', () => {
  it('serves the DB release stripped to v1 before the env descriptor', async () => {
    const app = await appWith({
      nodusReleaseIosJson: JSON.stringify(validDescriptor),
      nodusReleaseStore: {findPublished: async () => validDescriptorV2()},
    })
    const res = await app.inject({method: 'GET', url: '/v1/intelligence/nodus/releases/latest?platform=ios'})
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(stripNodusReleaseDescriptorV2ToV1(validDescriptorV2()))
    expect(res.json()).not.toHaveProperty('releaseNumber')
    await app.close()
  })

  it('falls back to the env descriptor when the store has no release', async () => {
    const app = await appWith({
      nodusReleaseIosJson: JSON.stringify(validDescriptor),
      nodusReleaseStore: {findPublished: async () => null},
    })
    const res = await app.inject({method: 'GET', url: '/v1/intelligence/nodus/releases/latest?platform=ios'})
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(validDescriptor)
    await app.close()
  })

  it('answers 404 when neither the store nor the env has a release', async () => {
    const app = await appWith({nodusReleaseStore: {findPublished: async () => null}})
    expect((await app.inject({method: 'GET', url: '/v1/intelligence/nodus/releases/latest?platform=ios'})).statusCode).toBe(404)
    await app.close()
  })
})
