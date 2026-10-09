import {generateKeyPairSync, randomBytes, randomUUID, sign, type KeyObject} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {manifestChecksum, type GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldMpsIngestService} from '../src/product-standard/ingest-service.js'
import {GreenfieldPublisherSigningKeyService, buildPublisherReleaseStatement, parsePublisherPublicKey, statementBytes} from '../src/modules/release-signing.js'
import {adapterManifest, configureRegistryTestEnv, evidenceFor, fixtureProduct, registerAccount, sha256} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)

function keyPair() {
  const keys = generateKeyPairSync('ed25519')
  return {privateKey: keys.privateKey, publicKeyPem: keys.publicKey.export({format: 'pem', type: 'spki'}).toString()}
}

function signRelease(input: {manifest: GreenfieldModuleManifest; artifactSha256: string; productBytes?: string | Buffer | null; frontendBytes?: string | Buffer | null; keyId: string; privateKey: KeyObject}) {
  const statement = buildPublisherReleaseStatement({
    manifest: input.manifest,
    sourceSha: input.manifest.source.commit,
    artifactSha256: input.artifactSha256,
    productManifestSha256: input.productBytes ? sha256(input.productBytes) : null,
    frontendSha256: input.frontendBytes ? sha256(input.frontendBytes) : null,
    signingKeyId: input.keyId,
  })
  return {algorithm: 'Ed25519', keyId: input.keyId, value: sign(null, statementBytes(statement), input.privateKey).toString('base64url')}
}

function rechecksum(manifest: GreenfieldModuleManifest) {
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  return manifest
}

describe('publisher signing key parsing', () => {
  it('accepts Ed25519 SPKI public keys and refuses private or non-Ed25519 keys', () => {
    const {privateKey, publicKeyPem} = keyPair()
    expect(parsePublisherPublicKey(publicKeyPem).fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(() => parsePublisherPublicKey(privateKey.export({format: 'pem', type: 'pkcs8'}).toString())).toThrow(/Private keys are never accepted/)
    const rsa = generateKeyPairSync('rsa', {modulusLength: 2048}).publicKey.export({format: 'pem', type: 'spki'}).toString()
    expect(() => parsePublisherPublicKey(rsa)).toThrow(/Ed25519/)
    expect(() => parsePublisherPublicKey('not a key')).toThrow()
  })
})

describeIfDb('registry trust pipeline: Ed25519 publisher signatures', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let releases: GreenfieldModuleReleaseService
  let keys: GreenfieldPublisherSigningKeyService
  let token = ''
  const primary = keyPair()
  const primaryKeyId = `modula-test-${suffix}-a`
  let n = 0
  const nextId = () => `digital.modula.signed-${suffix}-${++n}`

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!)
    process.env.GREENFIELD_MODULE_ALLOW_UNTRUSTED_DEVELOPMENT_RELEASES = 'false'
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    releases = new GreenfieldModuleReleaseService(db)
    keys = new GreenfieldPublisherSigningKeyService(db)
    await keys.register('modula', {keyId: primaryKeyId, publicKeyPem: primary.publicKeyPem}, null)
    token = (await registerAccount(app, `signed-${suffix}@example.com`, `signed${suffix}`.slice(0, 20), db)).token
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  function signedImport(id: string, opts: {keyId?: string; privateKey?: KeyObject; tamper?: (s: ReturnType<typeof signRelease>) => void; signedArtifact?: string; signedManifest?: GreenfieldModuleManifest} = {}) {
    const product = fixtureProduct(id, '1.0.0')
    const manifest = adapterManifest(id, '1.0.0')
    const evidence = evidenceFor(manifest)
    const signature = signRelease({
      manifest: opts.signedManifest ?? manifest,
      artifactSha256: opts.signedArtifact ?? evidence.artifactSha256,
      productBytes: product.mpsBytes,
      frontendBytes: product.frontend?.bytes ?? null,
      keyId: opts.keyId ?? primaryKeyId,
      privateKey: opts.privateKey ?? primary.privateKey,
    })
    opts.tamper?.(signature)
    return {product, manifest, evidence: {...evidence, productManifestSha256: sha256(product.mpsBytes), frontendSha256: product.frontend ? sha256(product.frontend.bytes) : null, signature}}
  }

  it('verifies a valid signature at import and verify, binds the product bytes and surfaces it in the trust block', async () => {
    const id = nextId()
    const {product, manifest, evidence} = signedImport(id)
    const imported = await releases.importPendingReview(manifest, evidence)
    expect(imported.signatureKeyId).toBe(primaryKeyId)
    const published = await releases.publishRelease(id, '1.0.0')
    expect(published.releaseState).toBe('published')
    const row = await db.selectFrom('greenfield_module_release_signatures').selectAll().where('release_id', '=', published.releaseId).executeTakeFirstOrThrow()
    expect(row.verification_state).toBe('verified')
    expect(row.public_key_fingerprint).toBe(parsePublisherPublicKey(primary.publicKeyPem).fingerprint)
    expect(row.statement_sha256).toMatch(/^[0-9a-f]{64}$/)
    const ingest = new GreenfieldMpsIngestService(db)
    await expect(ingest.ingest({filename: 'modula.product.json', bytes: `${product.mpsBytes}\n`, releaseId: published.releaseId, frontend: product.frontend, schemas: product.schemas, assets: product.assets}))
      .rejects.toThrow(/does not match the digest the publisher signed/)
    await ingest.ingest({filename: 'modula.product.json', bytes: product.mpsBytes, releaseId: published.releaseId, frontend: product.frontend, schemas: product.schemas, assets: product.assets})
    const detail = await app.inject({method: 'GET', url: `/v1/registry/modules/${id}`})
    expect(detail.statusCode, detail.body).toBe(200)
    expect(detail.json().data.registryTrust.signature).toMatchObject({state: 'verified', algorithm: 'Ed25519', keyId: primaryKeyId, publicKeyFingerprint: row.public_key_fingerprint})
    expect(detail.json().data.registryTrust.warnings.map((w: {code: string}) => w.code)).not.toContain('RELEASE_UNSIGNED')
  })

  it('fails closed when a signed release has no integrity evidence row', async () => {
    const id = nextId()
    const {product, manifest, evidence} = signedImport(id)
    const imported = await releases.importPendingReview(manifest, evidence)
    await releases.publishRelease(id, '1.0.0')
    await new GreenfieldMpsIngestService(db).ingest({filename: 'modula.product.json', bytes: product.mpsBytes, releaseId: imported.releaseId, frontend: product.frontend, schemas: product.schemas, assets: product.assets})
    await db.deleteFrom('greenfield_module_release_integrity').where('release_id', '=', imported.releaseId).execute()

    const detail = await app.inject({method: 'GET', url: `/v1/registry/modules/${id}`})
    expect(detail.statusCode, detail.body).toBe(200)
    expect(detail.json().data.registryTrust).toMatchObject({
      verified: false,
      signature: {state: 'verified'},
    })
    expect(detail.json().data.registryTrust.warnings.map((warning: {code: string}) => warning.code)).toContain('NO_INTEGRITY_EVIDENCE')
  })

  it('keeps a valid signed release installable under strict production trust policy', async () => {
    const id = nextId()
    const {product, manifest, evidence} = signedImport(id)
    await releases.importPendingReview(manifest, evidence)
    const published = await releases.publishRelease(id, '1.0.0')
    await new GreenfieldMpsIngestService(db).ingest({filename: 'modula.product.json', bytes: product.mpsBytes, releaseId: published.releaseId, frontend: product.frontend, schemas: product.schemas, assets: product.assets})

    const response = await app.inject({
      method: 'POST',
      url: `/v1/modules/${id}/install`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `signed-install-${suffix}`},
      payload: {version: '1.0.0', approvedPermissions: []},
    })
    expect(response.statusCode, response.body).toBe(202)
    expect(response.json().data).toMatchObject({status: 'installing'})
  })

  it('rejects a signature from an unknown key', async () => {
    const stranger = keyPair()
    const {manifest, evidence} = signedImport(nextId(), {keyId: `unregistered-${suffix}`, privateKey: stranger.privateKey})
    await expect(releases.importPendingReview(manifest, evidence)).rejects.toThrow(/unknownKey/)
  })

  it('rejects an invalid signature and a signature from the wrong private key', async () => {
    const forged = signedImport(nextId(), {tamper: s => { s.value = randomBytes(64).toString('base64url') }})
    await expect(releases.importPendingReview(forged.manifest, forged.evidence)).rejects.toThrow(/invalid/)
    const wrongKey = signedImport(nextId(), {privateKey: keyPair().privateKey})
    await expect(releases.importPendingReview(wrongKey.manifest, wrongKey.evidence)).rejects.toThrow(/invalid/)
  })

  it('rejects an altered artifact at import and quarantines one altered after import', async () => {
    const altered = signedImport(nextId(), {signedArtifact: sha256('the artifact the publisher actually built')})
    await expect(releases.importPendingReview(altered.manifest, altered.evidence)).rejects.toThrow(/invalid/)

    const id = nextId()
    const {manifest, evidence} = signedImport(id)
    const imported = await releases.importPendingReview(manifest, evidence)
    await db.updateTable('greenfield_module_releases').set({release_sha256: sha256('swapped artifact')}).where('release_id', '=', imported.releaseId).execute()
    await expect(releases.verifyRelease(id, '1.0.0')).rejects.toThrow(/signature invalid/)
    const after = await releases.getRelease(id, '1.0.0')
    expect(after?.releaseState).toBe('quarantined')
    const row = await db.selectFrom('greenfield_module_release_signatures').select(['verification_state']).where('release_id', '=', imported.releaseId).executeTakeFirstOrThrow()
    expect(row.verification_state).toBe('invalid')
  })

  it('rejects an altered manifest', async () => {
    const id = nextId()
    const original = adapterManifest(id, '1.0.0')
    const tampered = signedImport(id, {signedManifest: original})
    tampered.manifest.description = 'Altered after signing'
    rechecksum(tampered.manifest)
    // A consistent forgery: evidence agrees with the altered manifest; only the signature can catch it.
    tampered.evidence.manifestSha256 = tampered.manifest.integrity.manifestSha256
    await expect(releases.importPendingReview(tampered.manifest, tampered.evidence)).rejects.toThrow(/invalid/)
  })

  it('rejects new signatures from a revoked key and quarantines pending releases signed by it', async () => {
    const revocable = keyPair()
    const keyId = `modula-test-${suffix}-revoked`
    await keys.register('modula', {keyId, publicKeyPem: revocable.publicKeyPem}, null)
    const id = nextId()
    const pending = signedImport(id, {keyId, privateKey: revocable.privateKey})
    const imported = await releases.importPendingReview(pending.manifest, pending.evidence)
    const revoked = await keys.revoke('modula', keyId, 'key compromised in test', null)
    expect(revoked.state).toBe('REVOKED')
    const row = await db.selectFrom('greenfield_module_release_signatures').select(['verification_state', 'revoked_at']).where('release_id', '=', imported.releaseId).executeTakeFirstOrThrow()
    expect(row.verification_state).toBe('revokedKey')
    await expect(releases.verifyRelease(id, '1.0.0')).rejects.toThrow(/revokedKey/)
    expect((await releases.getRelease(id, '1.0.0'))?.releaseState).toBe('quarantined')
    const fresh = signedImport(nextId(), {keyId, privateKey: revocable.privateKey})
    await expect(releases.importPendingReview(fresh.manifest, fresh.evidence)).rejects.toThrow(/revokedKey/)
    const revocation = await db.selectFrom('greenfield_module_revocations').select(['scope']).where('target_id', '=', keyId).executeTakeFirstOrThrow()
    expect(revocation.scope).toBe('signingKey')
  })

  it('rotates keys with history and rejects new signatures from the rotated key', async () => {
    const oldKey = keyPair()
    const newKey = keyPair()
    const oldId = `modula-test-${suffix}-old`
    const newId = `modula-test-${suffix}-new`
    await keys.register('modula', {keyId: oldId, publicKeyPem: oldKey.publicKeyPem}, null)
    await keys.register('modula', {keyId: newId, publicKeyPem: newKey.publicKeyPem, rotatesKeyId: oldId}, null)
    const stale = signedImport(nextId(), {keyId: oldId, privateKey: oldKey.privateKey})
    await expect(releases.importPendingReview(stale.manifest, stale.evidence)).rejects.toThrow(/rotated/)
    const current = signedImport(nextId(), {keyId: newId, privateKey: newKey.privateKey})
    await expect(releases.importPendingReview(current.manifest, current.evidence)).resolves.toMatchObject({signatureKeyId: newId})
    await expect(keys.register('modula', {keyId: `dup-${suffix}`, publicKeyPem: newKey.publicKeyPem}, null)).rejects.toMatchObject({code: 'CONFLICT'})

    const listing = await app.inject({method: 'GET', url: '/v1/registry/publishers/modula/signing-keys'})
    expect(listing.statusCode, listing.body).toBe(200)
    const body = listing.json().data
    expect(body.protocol).toMatchObject({statementType: 'modula.publisher-release.v1', algorithm: 'Ed25519'})
    expect(body.keys.find((k: {keyId: string}) => k.keyId === oldId)).toMatchObject({state: 'ROTATED', rotatedToKeyId: newId})
    expect(body.history.filter((e: {keyId: string}) => e.keyId === oldId).map((e: {eventType: string}) => e.eventType)).toEqual(['registered', 'rotated'])
    expect(JSON.stringify(body)).not.toMatch(/PRIVATE KEY/)
  })

  it('keeps unsigned release facts visible but never marks them trusted', async () => {
    const id = nextId()
    const manifest = adapterManifest(id, '1.0.0')
    await releases.importPendingReview(manifest, evidenceFor(manifest))
    const published = await releases.publishRelease(id, '1.0.0')
    expect(published.releaseState).toBe('published')
    const detail = await app.inject({method: 'GET', url: `/v1/registry/modules/${id}`})
    expect(detail.json().data.registryTrust).toMatchObject({verified: false, signature: {state: 'unsigned'}})
  })
})
