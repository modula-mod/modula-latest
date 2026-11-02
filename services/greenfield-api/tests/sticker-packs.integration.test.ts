import {createHash, generateKeyPairSync, randomBytes, randomUUID, sign} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {manifestChecksum, type GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import {createServer} from '../src/app/create-server.js'
import {loadConfig} from '../src/config/env.js'
import {createDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {normalizeCommentMedia} from '../src/domains/comments/media.js'
import {GreenfieldModulePublisherService} from '../src/modules/publisher-service.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldPublisherSigningKeyService, buildPublisherReleaseStatement, statementBytes} from '../src/modules/release-signing.js'
import {adapterManifest, configureRegistryTestEnv, registerAccount} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
const alternatePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=', 'base64')
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

function rechecksum(manifest: GreenfieldModuleManifest) {
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  return manifest
}

describeIfDb('signed sticker pack catalogue and composer integration', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: ReturnType<typeof createDb>
  let releases: GreenfieldModuleReleaseService
  let accountId: string
  const keys = generateKeyPairSync('ed25519')
  const publicPem = keys.publicKey.export({format: 'pem', type: 'spki'}).toString()
  const keyId = sha256(keys.publicKey.export({format: 'der', type: 'spki'}))
  const packId = `qa-stickers-${suffix}`
  const stickerId = `qa_${suffix}_1`
  let manifestSha = ''

  async function publishPack(id: string, validDirectSignature = true) {
    const moduleId = `digital.modula.stickers.${id}`
    const stickerFacts = [
      {id: id === packId ? stickerId : `invalid_${suffix}_1`, label: 'QA Sprout', bytes: png},
      {id: id === packId ? `qa_${suffix}_2` : `invalid_${suffix}_2`, label: 'QA Leaf', bytes: alternatePng},
    ]
    const packManifest = Buffer.from(JSON.stringify({
      schemaVersion: 'modula.sticker-pack.1', packId: id, version: '1.0.0',
      stickers: stickerFacts.map(item => ({
        id: item.id, label: item.label, path: `stickers/${item.id}.png`, mediaType: 'image/png',
        sha256: sha256(item.bytes), bytes: item.bytes.length,
      })),
    }))
    const digest = sha256(packManifest)
    const manifest = rechecksum(adapterManifest(moduleId, '1.0.0', {
      name: `QA sticker pack ${id}`, description: 'Signed QA sticker pack fixture',
      source: {
        provider: 'github', repository: 'modula-mod/modula-native', commit: 'a'.repeat(40),
        manifestPath: 'ios/Modula/DesignSystem/SproutStickerPack.swift', releaseTag: `qa-${id}-v1.0.0`,
        releaseAssetName: `${id}-1.0.0.json`,
      },
      compatibility: {
        minimumGreenfieldVersion: '0.1.0', minimumModulaHostVersion: '0.1.0',
        protocolVersions: ['greenfield.v1'], platforms: ['ios', 'android', 'web'],
      },
      lifecycle: {executionMode: 'declarative'}, integrity: {manifestSha256: '', releaseSha256: digest},
    }))
    const statement = buildPublisherReleaseStatement({manifest, sourceSha: manifest.source.commit, artifactSha256: digest, signingKeyId: keyId})
    const signature = sign(null, statementBytes(statement), keys.privateKey).toString('base64url')
    const release = await releases.importPendingReview(manifest, {
      repository: manifest.source.repository, releaseTag: manifest.source.releaseTag!, releaseCommit: manifest.source.commit,
      artifactSha256: digest, manifestSha256: manifest.integrity.manifestSha256,
      signature: {algorithm: 'Ed25519', keyId, value: signature},
    })
    await releases.publishRelease(moduleId, '1.0.0')
    const manifestArtifactId = `release:${release.releaseId}:sticker-manifest`
    const now = new Date()
    await db.transaction().execute(async trx => {
      await trx.insertInto('greenfield_release_asset_blobs').values({
        sha256: digest, media_type: 'application/json', byte_size: packManifest.length, bytes: packManifest, created_at: now,
      }).onConflict(oc => oc.column('sha256').doNothing()).execute()
      await trx.insertInto('greenfield_release_artifacts').values({
        artifact_id: manifestArtifactId, release_id: release.releaseId, kind: 'asset', sha256: digest,
        filename: `${id}.json`, access_class: 'public', required_for_offline_launch: true, created_at: now,
      }).execute()
      await trx.insertInto('greenfield_release_artifact_signatures').values({
        artifact_signature_id: `artifact-signature:${manifestArtifactId}:${keyId}`, artifact_id: manifestArtifactId,
        signature_key_id: keyId, algorithm: 'Ed25519', signed_digest: digest,
        signature: (validDirectSignature ? sign(null, Buffer.from(digest), keys.privateKey) : randomBytes(64)).toString('base64'),
        verification_state: 'verified', verified_at: now, created_at: now,
      }).execute()
      await trx.insertInto('greenfield_sticker_pack_releases').values({
        release_id: release.releaseId, manifest_artifact_id: manifestArtifactId, pack_id: id, version: '1.0.0',
        title: 'QA Sprouts', icon: '🌱', series: 9, availability: 'approved', sort_order: 9,
        approved_at: now, withdrawn_at: null, created_at: now, updated_at: now,
      }).execute()
      for (const [index, item] of stickerFacts.entries()) {
        const artifactId = `release:${release.releaseId}:sticker:${item.id}`
        const imageSha = sha256(item.bytes)
        await trx.insertInto('greenfield_release_asset_blobs').values({
          sha256: imageSha, media_type: 'image/png', byte_size: item.bytes.length, bytes: item.bytes, created_at: now,
        }).onConflict(oc => oc.column('sha256').doNothing()).execute()
        await trx.insertInto('greenfield_release_artifacts').values({
          artifact_id: artifactId, release_id: release.releaseId, kind: 'asset', sha256: imageSha,
          filename: `${item.id}.png`, access_class: 'public', required_for_offline_launch: true, created_at: now,
        }).execute()
        await trx.insertInto('greenfield_stickers').values({
          release_id: release.releaseId, sticker_id: item.id, label: item.label, emoji: '🌱',
          artifact_id: artifactId, sort_order: index + 1, created_at: now,
        }).execute()
      }
    })
    return digest
  }

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!, '4074')
    process.env.GREENFIELD_MODULE_ALLOW_UNTRUSTED_DEVELOPMENT_RELEASES = 'false'
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    const bootstrap = adapterManifest(`digital.modula.stickers.bootstrap-${suffix}`, '1.0.0')
    await new GreenfieldModulePublisherService(db).ensurePublisherForManifest(bootstrap)
    const existing = await db.selectFrom('greenfield_publisher_signing_keys').select('key_id').where('key_id', '=', keyId).executeTakeFirst()
    if (!existing) await new GreenfieldPublisherSigningKeyService(db).register('modula', {keyId, publicKeyPem: publicPem}, null)
    releases = new GreenfieldModuleReleaseService(db)
    const server = await createServer(loadConfig())
    app = server.app
    await app.ready()
    accountId = (await registerAccount(app, `sticker-${suffix}@example.com`, `sticker${suffix}`.slice(0, 20), db)).accountId
    manifestSha = await publishPack(packId)
    await publishPack(`qa-invalid-${suffix}`, false)
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('lists only trusted packs with bounded pagination and immutable asset metadata', async () => {
    const response = await app.inject({method: 'GET', url: '/v1/stickers/packs?series=9&limit=10'})
    expect(response.statusCode, response.body).toBe(200)
    const packs = response.json().data.packs as any[]
    const pack = packs.find(item => item.id === packId)
    expect(pack).toMatchObject({
      id: packId, series: 9, version: '1.0.0', package: {sha256: manifestSha, signature: {algorithm: 'Ed25519', keyId}},
    })
    expect(pack.stickers).toHaveLength(2)
    expect(pack.stickers[0]).toMatchObject({id: stickerId, emoji: '🌱', asset: {mediaType: 'image/png'}})
    expect(packs.some(pack => pack.id === `qa-invalid-${suffix}`)).toBe(false)
  })

  it('serves sticker bytes through the canonical content-addressed distribution route', async () => {
    const listing = await app.inject({method: 'GET', url: '/v1/stickers/packs?series=9'})
    const asset = listing.json().data.packs[0].stickers[0].asset
    const response = await app.inject({method: 'GET', url: new URL(asset.url).pathname})
    expect(response.statusCode, response.body).toBe(200)
    expect(sha256(response.rawPayload)).toBe(asset.sha256)
    expect(response.headers['cache-control']).toContain('immutable')
  })

  it('allows a trusted sticker in the existing comment composer without trusting client labels', async () => {
    const media = await normalizeCommentMedia(db, accountId, [{type: 'sticker', stickerId, packId: 'forged', label: 'forged', emoji: '💣'}])
    expect(media).toEqual([{type: 'sticker', packId, stickerId, emoji: '🌱', label: 'QA Sprout'}])
    await expect(normalizeCommentMedia(db, accountId, [{type: 'sticker', stickerId: `unknown_${suffix}`}])).rejects.toThrow(/Unknown sticker/)
  })

  it('rejects malformed cursors with a machine-readable contract error', async () => {
    const response = await app.inject({method: 'GET', url: '/v1/stickers/packs?cursor=not-a-cursor'})
    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('INVALID_CURSOR')
  })
})
