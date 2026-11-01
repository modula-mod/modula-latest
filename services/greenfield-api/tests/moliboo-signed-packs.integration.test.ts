import {createHash, generateKeyPairSync, randomBytes, randomUUID, sign, verify} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {manifestChecksum, type GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import {createServer} from '../src/app/create-server.js'
import {loadConfig} from '../src/config/env.js'
import {createDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {validateMolibooArtifact} from '../src/domains/moliboos/service.js'
import {GreenfieldModulePublisherService} from '../src/modules/publisher-service.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {
  GreenfieldPublisherSigningKeyService,
  buildPublisherReleaseStatement,
  statementBytes,
} from '../src/modules/release-signing.js'
import {adapterManifest, configureRegistryTestEnv, registerAccount} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)
const adminHandle = `molibooadmin${suffix}`.slice(0, 20)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')

function digest(bytes: Buffer) { return createHash('sha256').update(bytes).digest('hex') }

function container(input: {number: number; version: string; path?: string; portrait?: Buffer}) {
  const packageId = `moliboo.character.${input.number}`
  const characterId = `moliboo.${input.number}`
  const character = Buffer.from(JSON.stringify({
    schemaVersion: 'modula.moliboo.character.1', characterId, key: `character-${input.number}`, assetVersion: input.version,
  }))
  const portrait = input.portrait ?? png
  return Buffer.from(JSON.stringify({
    schemaVersion: 'modula.moliboo.assetpack.1', packageId, version: input.version, characterId,
    files: [
      {path: 'character.json', mediaType: 'application/json', sha256: digest(character), bytes: character.length, data: character.toString('base64')},
      {path: input.path ?? 'portrait.png', mediaType: 'image/png', sha256: digest(portrait), bytes: portrait.length, data: portrait.toString('base64')},
    ],
  }))
}

function rechecksum(manifest: GreenfieldModuleManifest) {
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  return manifest
}

describe('Moliboo content-only artifact validation', () => {
  it('accepts the native JSON container and rejects traversal, missing portraits, bad PNGs, and one-byte file tampering', () => {
    const valid = container({number: 116, version: '1.0.0'})
    expect(validateMolibooArtifact(valid, {packageId: 'moliboo.character.116', version: '1.0.0', characterId: 'moliboo.116'}).files).toHaveLength(2)

    const traversal = JSON.parse(valid.toString())
    traversal.files[1].path = '../portrait.png'
    expect(() => validateMolibooArtifact(Buffer.from(JSON.stringify(traversal)), {packageId: 'moliboo.character.116', version: '1.0.0', characterId: 'moliboo.116'})).toThrow(/unsafe or duplicate path/)

    const noPortrait = JSON.parse(valid.toString())
    noPortrait.files = noPortrait.files.filter((file: {path: string}) => file.path !== 'portrait.png')
    expect(() => validateMolibooArtifact(Buffer.from(JSON.stringify(noPortrait)), {packageId: 'moliboo.character.116', version: '1.0.0', characterId: 'moliboo.116'})).toThrow(/portrait.png/)

    const badPng = container({number: 116, version: '1.0.0', portrait: Buffer.from('not a png')})
    expect(() => validateMolibooArtifact(badPng, {packageId: 'moliboo.character.116', version: '1.0.0', characterId: 'moliboo.116'})).toThrow(/PNG signature/)

    const tampered = JSON.parse(valid.toString())
    const decoded = Buffer.from(tampered.files[0].data, 'base64')
    decoded[decoded.length - 1] ^= 1
    tampered.files[0].data = decoded.toString('base64')
    expect(() => validateMolibooArtifact(Buffer.from(JSON.stringify(tampered)), {packageId: 'moliboo.character.116', version: '1.0.0', characterId: 'moliboo.116'})).toThrow(/integrity failed/)
  })

  it('has no archive, link, or executable entry representation and rejects undeclared extensions', () => {
    const value = JSON.parse(container({number: 116, version: '1.0.0'}).toString())
    value.files[1].path = 'payload.dylib'
    value.files[1].mediaType = 'application/octet-stream'
    expect(() => validateMolibooArtifact(Buffer.from(JSON.stringify(value)), {packageId: 'moliboo.character.116', version: '1.0.0', characterId: 'moliboo.116'})).toThrow(/unsafe or duplicate path/)
  })
})

describeIfDb('Moliboo signed pack delivery, withdrawal, ownership, and outfits', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: ReturnType<typeof createDb>
  let releases: GreenfieldModuleReleaseService
  let owner: {accountId: string; token: string}
  let admin: {accountId: string; token: string}
  const keys = generateKeyPairSync('ed25519')
  const publicPem = keys.publicKey.export({format: 'pem', type: 'spki'}).toString()
  const keyId = createHash('sha256').update(keys.publicKey.export({format: 'der', type: 'spki'})).digest('hex')
  const artifacts = new Map<string, Buffer>()

  async function publishPack(number: number, version: string, options: {signature?: Buffer; wearable?: boolean} = {}) {
    const packageId = `moliboo.character.${number}`
    const characterId = `moliboo.${number}`
    const artifact = container({number, version})
    const artifactSha = digest(artifact)
    const manifest = rechecksum(adapterManifest(packageId, version, {
      name: `Moliboo ${number}`,
      description: `Content-only Moliboo character ${number}`,
      source: {
        provider: 'github', repository: 'modula-mod/modula-native',
        commit: '791d42e968b4f1b4f3ad309857b4b9fee262c495',
        manifestPath: `Tools/moliboo/packages/series2/sources/${number}/character.json`,
        releaseTag: `${packageId}-v${version}`, releaseAssetName: `${packageId}-${version}.json`,
      },
      compatibility: {
        minimumGreenfieldVersion: '0.1.0', minimumModulaHostVersion: '0.1.0',
        protocolVersions: ['greenfield.v1'], platforms: ['ios'],
      },
      lifecycle: {executionMode: 'declarative'},
      integrity: {manifestSha256: '', releaseSha256: artifactSha},
    }))
    const statement = buildPublisherReleaseStatement({
      manifest, sourceSha: manifest.source.commit, artifactSha256: artifactSha, signingKeyId: keyId,
    })
    const releaseSignature = sign(null, statementBytes(statement), keys.privateKey).toString('base64url')
    const release = await releases.importPendingReview(manifest, {
      repository: manifest.source.repository, releaseTag: manifest.source.releaseTag!, releaseCommit: manifest.source.commit,
      artifactSha256: artifactSha, manifestSha256: manifest.integrity.manifestSha256,
      signature: {algorithm: 'Ed25519', keyId, value: releaseSignature},
    })
    await releases.publishRelease(packageId, version)
    const artifactId = `release:${release.releaseId}:moliboo-asset-pack`
    const now = new Date()
    await db.transaction().execute(async trx => {
      await trx.insertInto('greenfield_release_asset_blobs').values({
        sha256: artifactSha, media_type: 'application/vnd.modula.moliboo-asset-pack+json',
        byte_size: artifact.length, bytes: artifact, created_at: now,
      }).onConflict(oc => oc.column('sha256').doNothing()).execute()
      await trx.insertInto('greenfield_release_artifacts').values({
        artifact_id: artifactId, release_id: release.releaseId, kind: 'asset', sha256: artifactSha,
        filename: `${packageId}-${version}.json`, access_class: 'public', required_for_offline_launch: true, created_at: now,
      }).execute()
      await trx.insertInto('greenfield_release_artifact_signatures').values({
        artifact_signature_id: `artifact-signature:${artifactId}:${keyId}`, artifact_id: artifactId, signature_key_id: keyId,
        algorithm: 'Ed25519', signed_digest: artifactSha,
        signature: (options.signature ?? sign(null, Buffer.from(artifactSha), keys.privateKey)).toString('base64'),
        verification_state: 'verified', verified_at: now, created_at: now,
      }).execute()
      await trx.insertInto('greenfield_moliboo_characters').values({
        character_id: characterId, character_number: number, character_key: `character-${number}`,
        display_name: `Character ${number}`, family_id: number < 150 ? 'tideborn' : 'lantern-parade',
        series: number >= 116 ? 2 : 1, wearable: options.wearable ?? number > 115, created_at: now, updated_at: now,
      }).onConflict(oc => oc.column('character_id').doNothing()).execute()
      await trx.insertInto('greenfield_moliboo_items').values({
        item_id: characterId, item_type: 'character', character_id: characterId, slot: 'character',
        wearable: options.wearable ?? number > 115, revoked_at: null, created_at: now, updated_at: now,
      }).onConflict(oc => oc.column('item_id').doNothing()).execute()
      await trx.insertInto('greenfield_moliboo_pack_releases').values({
        release_id: release.releaseId, artifact_id: artifactId, package_id: packageId, version, character_id: characterId,
        family_id: number < 150 ? 'tideborn' : 'lantern-parade', minimum_host_version: '0.1.0', runtime_version: 1,
        asset_capabilities: JSON.stringify(['character.patch', 'portrait.png']), rollback_compatible: true, availability: 'approved',
        state_revision: 1, approved_at: now, withdrawn_at: null, withdrawal_reason: null, created_at: now, updated_at: now,
      }).execute()
      await trx.insertInto('greenfield_moliboo_pack_release_events').values({
        event_id: randomUUID(), release_id: release.releaseId, event_type: 'approved', state_revision: 1,
        actor_account_id: null, reason: 'QA signed fixture', occurred_at: now,
      }).execute()
    })
    artifacts.set(`${packageId}@${version}`, artifact)
    return {packageId, characterId, releaseId: release.releaseId, artifactSha}
  }

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!, '4071')
    process.env.MODULA_ADMIN_HANDLES = adminHandle
    process.env.GREENFIELD_MODULE_ALLOW_UNTRUSTED_DEVELOPMENT_RELEASES = 'false'
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    const bootstrapManifest = adapterManifest(`moliboo.character.${900 + Number.parseInt(suffix.slice(0, 2), 16)}`, '1.0.0')
    await new GreenfieldModulePublisherService(db).ensurePublisherForManifest(bootstrapManifest)
    await new GreenfieldPublisherSigningKeyService(db).register('modula', {keyId, publicKeyPem: publicPem}, null)
    releases = new GreenfieldModuleReleaseService(db)
    const created = await createServer(loadConfig())
    app = created.app
    await app.ready()
    owner = await registerAccount(app, `moliboo-owner-${suffix}@example.com`, `moliboo${suffix}`.slice(0, 20), db)
    admin = await registerAccount(app, `moliboo-admin-${suffix}@example.com`, adminHandle, db)
    await publishPack(101, '1.0.0', {wearable: false})
    await publishPack(116, '1.0.0')
    await publishPack(116, '1.1.0')
    await publishPack(117, '1.0.0')
    await publishPack(118, '1.0.0')
    await publishPack(119, '1.0.0', {signature: randomBytes(64)})
    for (const itemId of ['moliboo.101', 'moliboo.116', 'moliboo.117']) {
      await db.insertInto('greenfield_moliboo_ownership').values({
        account_id: owner.accountId, item_id: itemId, grant_id: `qa:${suffix}:${itemId}`,
        grant_source: 'qa_fixture', granted_at: new Date(),
      }).execute()
    }
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('advertises only cryptographically valid latest releases and exposes an exact native catalogue', async () => {
    const list = await app.inject({method: 'GET', url: '/v1/moliboos/packs?series=2&limit=50'})
    expect(list.statusCode, list.body).toBe(200)
    const items = list.json().data.items as any[]
    expect(items.find(item => item.packageId === 'moliboo.character.116')).toMatchObject({
      version: '1.1.0', category: 'asset-pack', artifact: {mediaType: 'application/vnd.modula.moliboo-asset-pack+json'},
      signature: {algorithm: 'Ed25519', keyId}, moliboo: {characterId: 'moliboo.116', runtimeVersion: 1},
    })
    expect(items.some(item => item.packageId === 'moliboo.character.119')).toBe(false)

    const catalog = await app.inject({method: 'GET', url: '/v1/moliboos/packs/catalog.json'})
    expect(catalog.statusCode, catalog.body).toBe(200)
    expect(catalog.json()).toMatchObject({schemaVersion: 'modula.moliboo.catalog.1'})
    expect(catalog.json().packages.some((item: any) => item.packageId === 'moliboo.character.119')).toBe(false)
  })

  it('serves immutable bytes whose digest and direct artifact signature match PackageManager', async () => {
    const manifest = await app.inject({method: 'GET', url: '/v1/moliboos/packs/moliboo.character.116/manifest?version=1.0.0'})
    expect(manifest.statusCode, manifest.body).toBe(200)
    const descriptor = manifest.json().data.manifest
    const download = await app.inject({method: 'GET', url: '/v1/moliboos/packs/moliboo.character.116/download?version=1.0.0'})
    expect(download.statusCode, download.body).toBe(200)
    const bytes = download.rawPayload
    expect(digest(bytes)).toBe(descriptor.artifact.sha256)
    expect(bytes.equals(artifacts.get('moliboo.character.116@1.0.0')!)).toBe(true)
    expect(verify(null, Buffer.from(descriptor.artifact.sha256), keys.publicKey, Buffer.from(descriptor.signature.signature, 'base64'))).toBe(true)
    expect(download.headers['cache-control']).toContain('immutable')
  })

  it('keeps the prior approved release available and supports audited QA withdrawal and restoration', async () => {
    const old = await app.inject({method: 'GET', url: '/v1/moliboos/packs/moliboo.character.116/manifest?version=1.0.0'})
    expect(old.statusCode).toBe(200)
    const withdraw = await app.inject({
      method: 'POST', url: '/v1/admin/qa/moliboos/packs/moliboo.character.116/withdraw',
      headers: {authorization: `Bearer ${admin.token}`}, payload: {version: '1.1.0', reason: 'QA rollback exercise'},
    })
    expect(withdraw.statusCode, withdraw.body).toBe(200)
    const latestWhileWithdrawn = await app.inject({method: 'GET', url: '/v1/moliboos/packs/moliboo.character.116/manifest'})
    expect(latestWhileWithdrawn.statusCode).toBe(200)
    expect(latestWhileWithdrawn.json().data.manifest.version).toBe('1.0.0')
    const withdrawn = await app.inject({method: 'GET', url: '/v1/moliboos/packs/moliboo.character.116/manifest?version=1.1.0'})
    expect(withdrawn.statusCode).toBe(403)
    expect(withdrawn.json().error.code).toBe('RELEASE_REVOKED')
    const restore = await app.inject({
      method: 'POST', url: '/v1/admin/qa/moliboos/packs/moliboo.character.116/restore',
      headers: {authorization: `Bearer ${admin.token}`}, payload: {version: '1.1.0', reason: 'QA rollback exercise passed'},
    })
    expect(restore.statusCode, restore.body).toBe(200)
    expect((await app.inject({method: 'GET', url: '/v1/moliboos/packs/moliboo.character.116/manifest'})).json().data.manifest.version).toBe('1.1.0')

    const withdrawInvalid = await app.inject({
      method: 'POST', url: '/v1/admin/qa/moliboos/packs/moliboo.character.119/withdraw',
      headers: {authorization: `Bearer ${admin.token}`}, payload: {version: '1.0.0', reason: 'QA invalid-signature restore exercise'},
    })
    expect(withdrawInvalid.statusCode, withdrawInvalid.body).toBe(200)
    const restoreInvalid = await app.inject({
      method: 'POST', url: '/v1/admin/qa/moliboos/packs/moliboo.character.119/restore',
      headers: {authorization: `Bearer ${admin.token}`}, payload: {version: '1.0.0', reason: 'must fail closed'},
    })
    expect(restoreInvalid.statusCode).toBe(403)
    expect(restoreInvalid.json().error.code).toBe('UNTRUSTED_RELEASE')
  })

  it('enforces ownership, legend non-wearability, optimistic concurrency, and cross-session persistence', async () => {
    const unowned = await app.inject({
      method: 'PUT', url: '/v1/me/moliboos/outfit', headers: {authorization: `Bearer ${owner.token}`},
      payload: {expectedRevision: 0, items: [{slot: 'character', itemId: 'moliboo.118'}]},
    })
    expect(unowned.statusCode).toBe(403)
    const legend = await app.inject({
      method: 'PUT', url: '/v1/me/moliboos/outfit', headers: {authorization: `Bearer ${owner.token}`},
      payload: {expectedRevision: 0, items: [{slot: 'character', itemId: 'moliboo.101'}]},
    })
    expect(legend.statusCode).toBe(403)
    const equipped = await app.inject({
      method: 'PUT', url: '/v1/me/moliboos/outfit', headers: {authorization: `Bearer ${owner.token}`},
      payload: {expectedRevision: 0, items: [{slot: 'character', itemId: 'moliboo.116'}]},
    })
    expect(equipped.statusCode, equipped.body).toBe(200)
    expect(equipped.json().data).toMatchObject({revision: 1, items: [{slot: 'character', itemId: 'moliboo.116'}]})

    const relogin = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email: `moliboo-owner-${suffix}@example.com`, password: 'secure-pass-word-1'}})
    expect(relogin.statusCode, relogin.body).toBe(200)
    const restored = await app.inject({method: 'GET', url: '/v1/me/moliboos/outfit', headers: {authorization: `Bearer ${relogin.json().data.accessToken}`}})
    expect(restored.json().data).toMatchObject({revision: 1, items: [{itemId: 'moliboo.116'}]})

    const concurrent = await Promise.all(['moliboo.116', 'moliboo.117'].map(itemId => app.inject({
      method: 'PUT', url: '/v1/me/moliboos/outfit', headers: {authorization: `Bearer ${owner.token}`},
      payload: {expectedRevision: 1, items: [{slot: 'character', itemId}]},
    })))
    expect(concurrent.map(response => response.statusCode).sort()).toEqual([200, 409])
    const final = await app.inject({method: 'GET', url: '/v1/me/moliboos/outfit', headers: {authorization: `Bearer ${owner.token}`}})
    expect(final.json().data.revision).toBe(2)
    expect(['moliboo.116', 'moliboo.117']).toContain(final.json().data.items[0].itemId)
  })

  it('keeps duplicate ownership grants impossible at the database boundary', async () => {
    await expect(db.insertInto('greenfield_moliboo_ownership').values({
      account_id: owner.accountId, item_id: 'moliboo.116', grant_id: `qa:${suffix}:duplicate`,
      grant_source: 'qa_fixture', granted_at: new Date(),
    }).execute()).rejects.toThrow()
    const rows = await db.selectFrom('greenfield_moliboo_ownership').select('item_id')
      .where('account_id', '=', owner.accountId).where('item_id', '=', 'moliboo.116').execute()
    expect(rows).toHaveLength(1)
  })
})
