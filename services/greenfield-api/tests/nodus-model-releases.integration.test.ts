import {createHash, createPublicKey, verify} from 'node:crypto'
import {createServer as createHttpServer, type Server} from 'node:http'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {createServer} from '../src/app/create-server.js'
import {nodusModelManifestBytes, stripNodusReleaseDescriptorV2ToV1} from '../src/app/nodus-release-descriptor.js'
import {loadConfig} from '../src/config/env.js'
import {createDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModulePublisherService} from '../src/modules/publisher-service.js'
import {adapterManifest, configureRegistryTestEnv, registerAccount} from './helpers/registry-fixtures.js'
import {registerAuthorizedSigningIdentity} from './helpers/authorized-publication-fixture.js'
import {buildSignedV2Descriptor, fakeFileSha256, fakeModelBlob, makeNodusTestKey} from './helpers/nodus-release-fixture.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = Math.random().toString(36).slice(2, 8)
const adminHandle = `nodusadmin${suffix}`.slice(0, 20)
const publicApiUrl = 'https://api.test.modula.digital'

function digest(bytes: Buffer) { return createHash('sha256').update(bytes).digest('hex') }

/**
 * Fixture artifact origin. `smart` honours Range (206); `dumb` always
 * answers 200 with the full body, so the server must slice ranges itself.
 */
function fixtureOrigin(files: Map<string, Buffer>, smart: boolean): Promise<{server: Server; url: string}> {
  return new Promise(resolve => {
    const server = createHttpServer((req, res) => {
      const path = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname).replace(/^\//, '')
      const body = files.get(path)
      if (!body) {
        res.writeHead(404).end()
        return
      }
      const range = req.headers.range
      if (smart && range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range)
        if (match) {
          const start = match[1] ? Number(match[1]) : Math.max(0, body.length - Number(match[2]))
          const end = match[2] ? Math.min(Number(match[2]), body.length - 1) : body.length - 1
          if (start < body.length && end >= start) {
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${body.length}`,
              'Content-Length': String(end - start + 1),
              'Accept-Ranges': 'bytes',
            })
            res.end(body.subarray(start, end + 1))
            return
          }
          res.writeHead(416, {'Content-Range': `bytes */${body.length}`}).end()
          return
        }
      }
      res.writeHead(200, {'Content-Length': String(body.length), 'Accept-Ranges': 'bytes'})
      res.end(body)
    })
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({server, url: `http://127.0.0.1:${port}`})
    })
  })
}

describeIfDb('Nodus model releases: draft -> publish -> supersede -> rollback, verified Range downloads', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: ReturnType<typeof createDb>
  let baseUrl = ''
  let admin: {accountId: string; token: string}
  let user: {accountId: string; token: string}
  let smartOrigin: {server: Server; url: string}
  let dumbOrigin: {server: Server; url: string}
  const key = makeNodusTestKey(`test-nodus-key-${suffix}`)
  const blob = fakeModelBlob()
  const configBytes = Buffer.from('{"model":"test"}\n')
  const files = new Map([
    ['weights/model.safetensors', blob],
    ['config.json', configBytes],
  ])

  async function requestAs(token: string | null, method: 'GET' | 'POST', url: string, payload?: unknown, headers: Record<string, string> = {}) {
    return app.inject({
      method,
      url,
      headers: {...(token ? {authorization: `Bearer ${token}`} : {}), ...headers},
      payload,
    })
  }

  async function download(path: string, headers: Record<string, string> = {}) {
    const response = await fetch(`${baseUrl}${path}`, {headers})
    return {response, body: Buffer.from(await response.arrayBuffer())}
  }

  async function createDraft(version: string, releaseNumber: number, originUrl: string, supersedes: string | null = null, mutate?: (descriptor: any) => void) {
    const descriptor = buildSignedV2Descriptor({
      key,
      publicApiUrl,
      version,
      files: [
        {path: 'weights/model.safetensors', bytes: blob},
        {path: 'config.json', bytes: configBytes},
      ],
      releaseNumber,
      supersedes,
    })
    if (mutate) mutate(descriptor)
    return {
      descriptor,
      response: await requestAs(admin.token, 'POST', '/v1/admin/intelligence/nodus/releases', {descriptor, originUrl}),
    }
  }

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!, '4075')
    process.env.MODULA_ADMIN_HANDLES = adminHandle
    process.env.MODULA_PUBLIC_API_URL = publicApiUrl
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    const bootstrapManifest = adapterManifest(`nodus.registry.${suffix}`, '1.0.0')
    await new GreenfieldModulePublisherService(db).ensurePublisherForManifest(bootstrapManifest)
    await registerAuthorizedSigningIdentity({
      authorityUrl: process.env.MODULA_SIGNING_IDENTITY_AUTHORITY_DATABASE_URL!,
      publisherId: 'modula',
      signingKeyId: key.keyId,
      publicKeyPem: key.publicKeyPem,
      providerKeyRef: `test/nodus-model-releases/${suffix}`,
    })
    smartOrigin = await fixtureOrigin(files, true)
    dumbOrigin = await fixtureOrigin(files, false)
    const created = await createServer(loadConfig())
    app = created.app
    await app.ready()
    await app.listen({port: 0, host: '127.0.0.1'})
    const address = app.server.address()
    baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
    admin = await registerAccount(app, `nodus-admin-${suffix}@example.com`, adminHandle, db)
    user = await registerAccount(app, `nodus-user-${suffix}@example.com`, `nodususer${suffix}`.slice(0, 20), db)
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
    smartOrigin?.server.close()
    dumbOrigin?.server.close()
  })

  it('rejects admin writes without an allowlisted admin handle', async () => {
    const descriptor = buildSignedV2Descriptor({
      key, publicApiUrl, version: '9.9.9-admin-check',
      files: [{path: 'weights/model.safetensors', bytes: blob}],
    })
    const noAuth = await requestAs(null, 'POST', '/v1/admin/intelligence/nodus/releases', {descriptor, originUrl: smartOrigin.url})
    expect(noAuth.statusCode).toBe(401)
    const nonAdmin = await requestAs(user.token, 'POST', '/v1/admin/intelligence/nodus/releases', {descriptor, originUrl: smartOrigin.url})
    expect(nonAdmin.statusCode).toBe(403)
    expect(nonAdmin.json()).toMatchObject({ok: false, error: {code: 'FORBIDDEN'}})
  })

  it('rejects a draft whose manifest signature does not verify, and one whose manifest hash is wrong', async () => {
    const badSignature = await createDraft('9.9.9-bad-sig', 1, smartOrigin.url, null, descriptor => {
      const flipped = descriptor.signature[10] === 'A' ? 'B' : 'A'
      descriptor.signature = `${descriptor.signature.slice(0, 10)}${flipped}${descriptor.signature.slice(11)}`
    })
    expect(badSignature.response.statusCode, badSignature.response.body).toBe(400)
    expect(badSignature.response.json()).toMatchObject({ok: false, error: {code: 'VALIDATION_FAILED'}})
    const badHash = await createDraft('9.9.9-bad-hash', 1, smartOrigin.url, null, descriptor => {
      descriptor.manifestSHA256 = '0'.repeat(64)
    })
    expect(badHash.response.statusCode, badHash.response.body).toBe(400)
    expect(badHash.response.json()).toMatchObject({ok: false, error: {code: 'VALIDATION_FAILED'}})
  })

  it('creates a draft, keeps it unpublished, then publishes it and serves it as v2, v1-stripped /latest, and manifest', async () => {
    const {descriptor, response} = await createDraft('r7-test-1', 1, smartOrigin.url)
    expect(response.statusCode, response.body).toBe(201)
    expect(response.json().data).toMatchObject({version: 'r7-test-1', releaseNumber: 1, status: 'draft'})
    expect(response.json().data.signature).toMatchObject({keyId: key.keyId, verificationState: 'verified'})

    // Drafts are never served publicly.
    expect((await requestAs(null, 'GET', '/v1/intelligence/nodus/releases/r7-test-1')).statusCode).toBe(404)
    expect((await requestAs(null, 'GET', '/v1/intelligence/nodus/releases?platform=ios')).json()).toEqual([])
    expect((await requestAs(null, 'GET', '/v1/intelligence/nodus/releases/latest?platform=ios')).statusCode).toBe(404)

    const publish = await requestAs(admin.token, 'POST', '/v1/admin/intelligence/nodus/releases/r7-test-1/publish')
    expect(publish.statusCode, publish.body).toBe(200)
    expect(publish.json().data).toMatchObject({version: 'r7-test-1', status: 'published'})
    expect(publish.json().data.publishedAt).not.toBeNull()

    const served = await requestAs(null, 'GET', '/v1/intelligence/nodus/releases/r7-test-1')
    expect(served.statusCode).toBe(200)
    expect(served.json()).toMatchObject({schemaVersion: 2, nodusVersion: 'r7-test-1', releaseNumber: 1})
    expect(served.json().publishedAt).toBe(publish.json().data.publishedAt)

    const latest = await requestAs(null, 'GET', '/v1/intelligence/nodus/releases/latest?platform=ios')
    expect(latest.statusCode).toBe(200)
    expect(latest.json()).toEqual(stripNodusReleaseDescriptorV2ToV1(served.json()))
    expect(latest.json()).not.toHaveProperty('ok')

    const list = await requestAs(null, 'GET', '/v1/intelligence/nodus/releases?platform=ios')
    expect(list.json()).toEqual([{
      version: 'r7-test-1',
      releaseNumber: 1,
      publishedAt: publish.json().data.publishedAt,
      nodusVersion: 'r7-test-1',
    }])

    // The manifest endpoint serves exactly the bytes the signature covers.
    const manifest = await requestAs(null, 'GET', '/v1/intelligence/nodus/releases/r7-test-1/manifest')
    expect(manifest.statusCode).toBe(200)
    expect(manifest.headers['content-type']).toContain('application/json')
    expect(manifest.headers.etag).toContain(descriptor.manifestSHA256)
    expect(digest(Buffer.from(manifest.body))).toBe(descriptor.manifestSHA256)
    expect(manifest.body).toBe(Buffer.from(nodusModelManifestBytes(descriptor)).toString('utf8'))
    const publicKey = createPublicKey(key.publicKeyPem)
    expect(verify(null, Buffer.from(manifest.body), publicKey, Buffer.from(descriptor.signature, 'base64url'))).toBe(true)

    const duplicate = await createDraft('r7-test-1', 2, smartOrigin.url)
    expect(duplicate.response.statusCode).toBe(409)
  })

  it('downloads files with full and ranged requests against a Range-honouring origin', async () => {
    const {response: fullRes, body: fullBody} = await download('/v1/intelligence/nodus/releases/r7-test-1/files/weights/model.safetensors')
    expect(fullRes.status).toBe(200)
    expect(fullRes.headers.get('etag')).toContain(fakeFileSha256(blob))
    expect(fullRes.headers.get('x-modula-artifact-sha256')).toBe(fakeFileSha256(blob))
    expect(fullRes.headers.get('accept-ranges')).toBe('bytes')
    expect(fullBody).toEqual(blob)

    const {response: rangeRes, body: rangeBody} = await download('/v1/intelligence/nodus/releases/r7-test-1/files/weights/model.safetensors', {Range: 'bytes=0-99'})
    expect(rangeRes.status).toBe(206)
    expect(rangeRes.headers.get('content-range')).toBe(`bytes 0-99/${blob.length}`)
    expect(rangeBody).toEqual(blob.subarray(0, 100))

    // Resume: the tail from an offset.
    const {response: resumeRes, body: resumeBody} = await download('/v1/intelligence/nodus/releases/r7-test-1/files/weights/model.safetensors', {Range: `bytes=${blob.length - 10}-`})
    expect(resumeRes.status).toBe(206)
    expect(resumeRes.headers.get('content-range')).toBe(`bytes ${blob.length - 10}-${blob.length - 1}/${blob.length}`)
    expect(resumeBody).toEqual(blob.subarray(blob.length - 10))

    // Suffix range: the last 10 bytes.
    const {response: suffixRes, body: suffixBody} = await download('/v1/intelligence/nodus/releases/r7-test-1/files/weights/model.safetensors', {Range: 'bytes=-10'})
    expect(suffixRes.status).toBe(206)
    expect(suffixBody).toEqual(blob.subarray(blob.length - 10))

    // Invalid range: 416 with the size.
    const {response: invalidRes} = await download('/v1/intelligence/nodus/releases/r7-test-1/files/weights/model.safetensors', {Range: `bytes=${blob.length}-`})
    expect(invalidRes.status).toBe(416)
    expect(invalidRes.headers.get('content-range')).toBe(`bytes */${blob.length}`)

    // Matching If-None-Match without Range: 304. Stale If-Range: full 200.
    const etag = fullRes.headers.get('etag') as string
    const {response: notModifiedRes} = await download('/v1/intelligence/nodus/releases/r7-test-1/files/weights/model.safetensors', {'If-None-Match': etag})
    expect(notModifiedRes.status).toBe(304)
    const {response: staleRes, body: staleBody} = await download('/v1/intelligence/nodus/releases/r7-test-1/files/weights/model.safetensors', {Range: 'bytes=0-99', 'If-Range': '"sha256-deadbeef"'})
    expect(staleRes.status).toBe(200)
    expect(staleBody).toEqual(blob)

    expect((await download('/v1/intelligence/nodus/releases/r7-test-1/files/weights/nope.bin')).response.status).toBe(404)
    expect((await download('/v1/intelligence/nodus/releases/r7-test-1/files/../escape')).response.status).toBe(404)
  })

  it('supersedes on second publish, keeps the old version downloadable, and rolls back', async () => {
    const wrongNumber = await createDraft('r7-test-2', 99, dumbOrigin.url, 'r7-test-1')
    expect(wrongNumber.response.statusCode).toBe(400)
    const {response} = await createDraft('r7-test-2', 2, dumbOrigin.url, 'r7-test-1')
    expect(response.statusCode, response.body).toBe(201)
    const publish = await requestAs(admin.token, 'POST', '/v1/admin/intelligence/nodus/releases/r7-test-2/publish')
    expect(publish.statusCode, publish.body).toBe(200)
    expect(publish.json().data).toMatchObject({version: 'r7-test-2', status: 'published', supersedesVersion: 'r7-test-1'})

    const latest = await requestAs(null, 'GET', '/v1/intelligence/nodus/releases/latest?platform=ios')
    expect(latest.json().nodusVersion).toBe('r7-test-2')

    // The superseded version is still served (rollback needs its bytes),
    // including a ranged download against the dumb origin that ignores Range.
    expect((await requestAs(null, 'GET', '/v1/intelligence/nodus/releases/r7-test-1')).statusCode).toBe(200)
    const {response: dumbRangeRes, body: dumbRangeBody} = await download('/v1/intelligence/nodus/releases/r7-test-1/files/weights/model.safetensors', {Range: 'bytes=100-199'})
    expect(dumbRangeRes.status).toBe(206)
    expect(dumbRangeRes.headers.get('content-range')).toBe(`bytes 100-199/${blob.length}`)
    expect(dumbRangeBody).toEqual(blob.subarray(100, 200))

    const rollback = await requestAs(admin.token, 'POST', '/v1/admin/intelligence/nodus/releases/r7-test-1/rollback')
    expect(rollback.statusCode, rollback.body).toBe(200)
    expect(rollback.json().data).toMatchObject({version: 'r7-test-1', status: 'published'})

    const latestAfter = await requestAs(null, 'GET', '/v1/intelligence/nodus/releases/latest?platform=ios')
    expect(latestAfter.json().nodusVersion).toBe('r7-test-1')

    // The deprecated bad version is no longer served at all.
    expect((await requestAs(null, 'GET', '/v1/intelligence/nodus/releases/r7-test-2')).statusCode).toBe(404)
    expect((await requestAs(null, 'GET', '/v1/intelligence/nodus/releases/r7-test-2/files/weights/model.safetensors')).statusCode).toBe(404)

    const adminList = await requestAs(admin.token, 'GET', '/v1/admin/intelligence/nodus/releases')
    expect(adminList.statusCode).toBe(200)
    expect(adminList.json().data.map((row: {version: string; status: string}) => `${row.version}:${row.status}`)).toEqual([
      'r7-test-2:deprecated',
      'r7-test-1:published',
    ])

    const republishDraft = await requestAs(admin.token, 'POST', '/v1/admin/intelligence/nodus/releases/r7-test-2/publish')
    expect(republishDraft.statusCode).toBe(409)
    const rollbackDraft = await createDraft('r7-test-3', 3, smartOrigin.url, 'r7-test-1')
    expect(rollbackDraft.response.statusCode).toBe(201)
    const rollbackMissing = await requestAs(admin.token, 'POST', '/v1/admin/intelligence/nodus/releases/r7-test-3/rollback')
    expect(rollbackMissing.statusCode).toBe(409)
  })
})
