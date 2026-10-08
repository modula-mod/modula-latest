import {generateKeyPairSync, randomUUID, sign} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldGithubReleaseSyncService, type VerifiedGithubRelease} from '../src/modules/github-release-sync-service.js'
import {GreenfieldPublisherSigningKeyService, buildPublisherReleaseStatement, statementBytes, statementSha256} from '../src/modules/release-signing.js'
import {adapterManifest, configureRegistryTestEnv, evidenceFor, registerAccount, sha256} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)

describeIfDb('retrospective publisher release signatures', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let releases: GreenfieldModuleReleaseService
  let adminToken = ''
  let ordinaryToken = ''
  const adminHandle = `sigadmin${suffix}`
  const keyId = `modula-retro-${suffix}`
  const signer = generateKeyPairSync('ed25519')
  const verifiedPackages = new Map<string, VerifiedGithubRelease>()
  const fetchVerified = vi.spyOn(GreenfieldGithubReleaseSyncService.prototype, 'fetchVerified')
  let serial = 0

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!, '4071')
    fetchVerified.mockImplementation(async input => {
      const verified = verifiedPackages.get(input.releaseTag)
      if (!verified || verified.repository !== input.repository) throw new Error('Verified fixture missing')
      return verified
    })
    process.env.MODULA_ADMIN_HANDLES = adminHandle
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    releases = new GreenfieldModuleReleaseService(db)
    await new GreenfieldPublisherSigningKeyService(db).register('modula', {
      keyId,
      publicKeyPem: signer.publicKey.export({format: 'pem', type: 'spki'}).toString(),
    }, null)
    adminToken = (await registerAccount(app, `sigadmin-${suffix}@example.com`, adminHandle, db)).token
    ordinaryToken = (await registerAccount(app, `siguser-${suffix}@example.com`, `siguser${suffix}`, db)).token
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
    fetchVerified.mockRestore()
  })

  async function unsignedRelease() {
    const moduleId = `digital.modula.retro-${suffix}-${++serial}`
    const manifest = adapterManifest(moduleId, '1.0.0')
    const evidence = evidenceFor(manifest)
    await releases.importPendingReview(manifest, evidence)
    const release = await releases.publishRelease(moduleId, '1.0.0')
    verifiedPackages.set(manifest.source.releaseTag!, {
      productId: moduleId,
      version: '1.0.0',
      repository: evidence.repository,
      releaseTag: evidence.releaseTag,
      releaseCommit: evidence.releaseCommit,
      packageFile: manifest.source.releaseAssetName!,
      packageSha256: evidence.artifactSha256,
      packageBytes: Buffer.from(`artifact:${moduleId}:1.0.0`),
      mpsBytes: Buffer.alloc(0),
      manifest,
      frontend: null,
      schemas: [],
      assets: [],
      evidence,
      checks: ['package.sha256', 'tag.commit', 'provenance.identity'],
    })
    const statement = buildPublisherReleaseStatement({
      manifest,
      sourceSha: manifest.source.commit,
      artifactSha256: evidence.artifactSha256,
      signingKeyId: keyId,
    })
    return {
      moduleId,
      release,
      payload: {
        statementSha256: statementSha256(statement),
        signature: {algorithm: 'Ed25519', keyId, value: sign(null, statementBytes(statement), signer.privateKey).toString('base64url')},
      },
    }
  }

  const endpoint = (releaseId: string) => `/v1/admin/registry/releases/${encodeURIComponent(releaseId)}/signature`
  const auth = (token: string) => ({authorization: `Bearer ${token}`})

  it('attaches a verified signature to an existing published release exactly once', async () => {
    const {moduleId, release, payload} = await unsignedRelease()
    const before = await app.inject({method: 'GET', url: `/v1/registry/modules/${moduleId}`})
    expect(before.json().data.registryTrust).toMatchObject({verified: false, signature: {state: 'unsigned'}})

    const attached = await app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(adminToken), payload})
    expect(attached.statusCode, attached.body).toBe(200)
    expect(attached.json().data).toMatchObject({releaseId: release.releaseId, keyId, verificationState: 'verified', statementSha256: payload.statementSha256})
    const row = await db.selectFrom('greenfield_module_release_signatures').selectAll().where('release_id', '=', release.releaseId).executeTakeFirstOrThrow()
    expect(row.verification_state).toBe('verified')
    expect(row.statement_sha256).toBe(payload.statementSha256)
    const after = await app.inject({method: 'GET', url: `/v1/registry/modules/${moduleId}`})
    expect(after.json().data.registryTrust).toMatchObject({verified: true, signature: {state: 'verified'}})

    const again = await app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(adminToken), payload})
    expect(again.statusCode, again.body).toBe(200)
    expect(again.json().data).toMatchObject({alreadyAttached: true})
    expect(await db.selectFrom('greenfield_module_release_signatures').select('signature_id').where('release_id', '=', release.releaseId).execute()).toHaveLength(1)
  })

  it('handles simultaneous identical submissions with one signature row', async () => {
    const {release, payload} = await unsignedRelease()
    const submit = () => app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(adminToken), payload})
    const responses = await Promise.all([submit(), submit()])
    expect(responses.map(response => response.statusCode)).toEqual([200, 200])
    expect(responses.map(response => response.json().data.alreadyAttached ?? false).sort()).toEqual([false, true])
    expect(await db.selectFrom('greenfield_module_release_signatures').select('signature_id').where('release_id', '=', release.releaseId).execute()).toHaveLength(1)
  })

  it('requires an authenticated registry administrator and validates the request shape', async () => {
    const {release, payload} = await unsignedRelease()
    expect((await app.inject({method: 'POST', url: endpoint(release.releaseId), payload})).statusCode).toBe(401)
    expect((await app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(ordinaryToken), payload})).statusCode).toBe(403)
    expect((await app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(adminToken), payload: {...payload, signature: {...payload.signature, value: 'not-ed25519'}}})).statusCode).toBe(400)
    expect(await db.selectFrom('greenfield_module_release_signatures').select('signature_id').where('release_id', '=', release.releaseId).execute()).toHaveLength(0)
  })

  it('refuses wrong statement hash, invalid signature, and unknown signer without changing trust', async () => {
    const {moduleId, release, payload} = await unsignedRelease()
    const cases = [
      {...payload, statementSha256: sha256('wrong statement')},
      {...payload, signature: {...payload.signature, value: sign(null, Buffer.from('wrong statement'), signer.privateKey).toString('base64url')}},
      {...payload, signature: {...payload.signature, keyId: `unknown-${suffix}`}},
    ]
    for (const candidate of cases) {
      const response = await app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(adminToken), payload: candidate})
      expect(response.statusCode, response.body).toBe(400)
    }
    expect(await db.selectFrom('greenfield_module_release_signatures').select('signature_id').where('release_id', '=', release.releaseId).execute()).toHaveLength(0)
    const detail = await app.inject({method: 'GET', url: `/v1/registry/modules/${moduleId}`})
    expect(detail.json().data.registryTrust).toMatchObject({verified: false, signature: {state: 'unsigned'}})
  })

  it('refuses a release whose stored integrity facts no longer match', async () => {
    const {release, payload} = await unsignedRelease()
    await db.updateTable('greenfield_module_release_integrity').set({release_sha256: sha256('different artifact')}).where('release_id', '=', release.releaseId).execute()
    const response = await app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(adminToken), payload})
    expect(response.statusCode, response.body).toBe(400)
    expect(await db.selectFrom('greenfield_module_release_signatures').select('signature_id').where('release_id', '=', release.releaseId).execute()).toHaveLength(0)
  })

  it('refuses a package whose independently verified digest differs from the registry', async () => {
    const {release, payload} = await unsignedRelease()
    const tag = (await releases.getReleaseById(release.releaseId))!.manifest.source.releaseTag!
    const verified = verifiedPackages.get(tag)!
    verifiedPackages.set(tag, {...verified, packageSha256: sha256('different package bytes')})
    const response = await app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(adminToken), payload})
    expect(response.statusCode, response.body).toBe(400)
    expect(await db.selectFrom('greenfield_module_release_signatures').select('signature_id').where('release_id', '=', release.releaseId).execute()).toHaveLength(0)
  })

  it('keeps superseded legacy releases ineligible', async () => {
    const {release, payload} = await unsignedRelease()
    await db.updateTable('greenfield_module_releases').set({release_state: 'superseded'}).where('release_id', '=', release.releaseId).execute()
    const response = await app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(adminToken), payload})
    expect(response.statusCode, response.body).toBe(409)
  })
})
