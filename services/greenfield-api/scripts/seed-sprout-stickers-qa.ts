import {createHash, createPrivateKey, createPublicKey, randomUUID, sign} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {readFileSync, statSync} from 'node:fs'
import {resolve} from 'node:path'
import {
  GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
  createDefaultModuleSectionVersions,
  manifestChecksum,
  type GreenfieldModuleManifest,
} from '@modula/greenfield-module-manifest'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {GreenfieldModulePublisherService} from '../src/modules/publisher-service.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldPublisherSigningKeyService, buildPublisherReleaseStatement, statementBytes} from '../src/modules/release-signing.js'

const MISSION = 'GREENFIELD-FEATURE-REALITY-01'
const SOURCE_REPOSITORY = 'modula-mod/modula-native'
const STICKER_SOURCE_REF = '20fcf3cc7acdce677d9de5091107ddfe884bd31b'
const VERSION = '1.0.0'
const args = new Set(process.argv.slice(2))
for (const arg of args) if (arg !== '--apply') fail(`Unknown argument: ${arg}`)
const apply = args.has('--apply')
const nativeRoot = resolve(process.env.MODULA_NATIVE_ROOT ?? '/root/modula-worktrees/modula-native-vps-reference')
const sourceRef = process.env.MODULA_NATIVE_STICKER_REF ?? STICKER_SOURCE_REF
if (sourceRef !== STICKER_SOURCE_REF || git(nativeRoot, ['rev-parse', `${sourceRef}^{commit}`]) !== STICKER_SOURCE_REF) fail('Sticker fixtures must use the audited native main source ref')
const stickers = loadStickers(nativeRoot, sourceRef)
const packs = [1, 2].map(series => buildPack(series, stickers.filter(sticker => sticker.series === series)))

if (!apply) {
  printResult('DRY_RUN', packs, null)
  process.exit(0)
}
const databaseUrl = process.env.MODULA_DATABASE_MIGRATOR_URL
if (!databaseUrl) fail('MODULA_DATABASE_MIGRATOR_URL is required')
assertQaDatabase(databaseUrl)
if (process.env.MODULA_QA_FIXTURE_APPLY !== MISSION) fail(`MODULA_QA_FIXTURE_APPLY must equal ${MISSION}`)
const privateKeyPath = process.env.MODULA_QA_SIGNING_KEY_PATH
if (!privateKeyPath) fail('MODULA_QA_SIGNING_KEY_PATH is required for --apply')
const keyStat = statSync(privateKeyPath)
if (!keyStat.isFile() || (keyStat.mode & 0o077) !== 0) fail('QA signing key must have mode 0600 or stricter')
const privateKey = createPrivateKey(readFileSync(privateKeyPath))
if (privateKey.asymmetricKeyType !== 'ed25519') fail('QA signing key must be Ed25519')
const publicKey = createPublicKey(privateKey)
const publicKeyPem = publicKey.export({format: 'pem', type: 'spki'}).toString()
const keyId = sha256(publicKey.export({format: 'der', type: 'spki'}))

const db = createDb(databaseUrl)
try {
  await new GreenfieldModulePublisherService(db).ensurePublisherForManifest(buildReleaseManifest(packs[0]!))
  await ensureKey(db, keyId, publicKeyPem)
  const releases = new GreenfieldModuleReleaseService(db)
  let created = 0, existing = 0
  for (const pack of packs) (await publishPack(db, releases, pack, keyId, privateKey)) === 'created' ? created++ : existing++
  const count = await db.selectFrom('greenfield_stickers').select(eb => eb.fn.countAll<number>().as('count')).executeTakeFirstOrThrow()
  if (Number(count.count) !== 65) fail(`Expected 65 Sprout stickers, found ${count.count}`)
  printResult('APPLIED', packs, {created, existing, stickers: Number(count.count), keyId})
} finally {
  await db.destroy()
}

type SourceSticker = {id: string; label: string; series: number; assetName: string; bytes: Buffer; sha256: string}
type Pack = {
  packId: string; moduleId: string; series: number; title: string; icon: string
  stickers: SourceSticker[]; manifest: Buffer; manifestSha256: string
}

function loadStickers(root: string, ref: string): SourceSticker[] {
  const swift = gitBytes(root, ref, 'ios/Modula/DesignSystem/SproutStickerPack.swift').toString('utf8')
  const pattern = /SproutSticker\(id: "([^"]+)", title: "([^"]+)", series: ([0-9]+), assetName: "([^"]+)"\)/g
  const values: SourceSticker[] = []
  for (const match of swift.matchAll(pattern)) {
    const [, id, label, rawSeries, assetName] = match
    const series = Number(rawSeries)
    const bytes = gitBytes(root, ref, `ios/Modula/Assets.xcassets/${assetName}.imageset/sticker.png`)
    if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.length > 4 * 1024 * 1024) fail(`Invalid PNG for ${id}`)
    values.push({id: id!, label: label!, series, assetName: assetName!, bytes, sha256: sha256(bytes)})
  }
  if (values.filter(item => item.series === 1).length !== 36 || values.filter(item => item.series === 2).length !== 29
      || values.some(item => item.id === '02_18_space_explorer') || new Set(values.map(item => item.id)).size !== 65) {
    fail('Native Sprout sticker identity/count contract is invalid')
  }
  return values
}

function buildPack(series: number, stickers: SourceSticker[]): Pack {
  const packId = `sprout-series-${series}`
  const manifest = Buffer.from(JSON.stringify({
    schemaVersion: 'modula.sticker-pack.1', packId, version: VERSION,
    stickers: stickers.map(sticker => ({
      id: sticker.id, label: sticker.label, path: `stickers/${sticker.id}.png`,
      mediaType: 'image/png', sha256: sticker.sha256, bytes: sticker.bytes.length,
    })),
  }))
  return {packId, moduleId: `digital.modula.stickers.${packId}`, series, title: `Sprout Series ${series}`, icon: '🌱', stickers, manifest, manifestSha256: sha256(manifest)}
}

function buildReleaseManifest(pack: Pack): GreenfieldModuleManifest {
  const manifest = {
    manifestVersion: GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
    moduleId: pack.moduleId, name: pack.title, description: `Signed first-party ${pack.title} artwork pack.`, version: VERSION,
    standardVersion: '2.1.0', sectionVersions: createDefaultModuleSectionVersions(),
    publisher: {publisherId: 'modula', displayName: 'Modula', website: 'https://modula.digital'},
    source: {
      provider: 'github', repository: SOURCE_REPOSITORY, commit: STICKER_SOURCE_REF,
      manifestPath: 'ios/Modula/DesignSystem/SproutStickerPack.swift', releaseTag: `qa-${pack.moduleId}-v${VERSION}`,
      releaseAssetName: `${pack.packId}-${VERSION}.json`,
    },
    license: {status: 'firstParty', evidenceIds: [`native-source:${STICKER_SOURCE_REF}:SproutStickerPack.swift`]},
    trust: {requestedLevel: 'firstParty'},
    compatibility: {minimumGreenfieldVersion: '0.1.0', minimumModulaHostVersion: '0.1.0', protocolVersions: ['greenfield.v1'], platforms: ['ios', 'android', 'web']},
    permissions: [], dependencies: [], contributions: {},
    dependencyGraph: {version: '2.0.0', requires: [], optional: [], recommended: [], conflicts: [], replaces: [], provides: []},
    capabilityDiscovery: {version: '2.0.0'}, serviceRegistry: {version: '2.0.0', items: []}, apiRegistry: {version: '2.0.0', items: []},
    hookRegistry: {version: '2.0.0', items: []}, permissionModel: {version: '2.0.0', categories: {}}, jobRegistry: {version: '2.0.0', items: []},
    storageModel: {version: '2.0.0', items: []}, widgetRegistry: {version: '2.0.0', items: []}, navigationRegistry: {version: '2.0.0', items: []},
    uiContributions: {version: '2.0.0', items: []}, eventBus: {version: '2.0.0', items: []}, lifecycle: {executionMode: 'declarative'},
    extensionProduct: {
      version: VERSION, kind: 'module', targets: [], extensionPoints: [], contributions: [],
      retention: {defaultMode: 'KEEP_DATA', supportsUserChoice: true}, graphPolicy: {maxDepth: 16, maxNodes: 256},
    },
    integrity: {manifestSha256: '', releaseSha256: pack.manifestSha256},
  } as GreenfieldModuleManifest
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  return manifest
}

async function publishPack(db: ModulaDb, releases: GreenfieldModuleReleaseService, pack: Pack, keyId: string, privateKey: ReturnType<typeof createPrivateKey>) {
  const existing = await releases.getRelease(pack.moduleId, VERSION)
  if (existing) {
    const row = await db.selectFrom('greenfield_sticker_pack_releases').selectAll().where('release_id', '=', existing.releaseId).executeTakeFirst()
    if (existing.releaseState !== 'published' || existing.releaseSha256 !== pack.manifestSha256 || existing.sourceCommit !== STICKER_SOURCE_REF || !row || row.availability !== 'approved') {
      fail(`Refusing to replace inconsistent sticker release ${pack.moduleId}@${VERSION}`)
    }
    return 'existing' as const
  }
  const manifest = buildReleaseManifest(pack)
  const statement = buildPublisherReleaseStatement({manifest, sourceSha: STICKER_SOURCE_REF, artifactSha256: pack.manifestSha256, signingKeyId: keyId})
  const signature = sign(null, statementBytes(statement), privateKey).toString('base64url')
  const release = await releases.importPendingReview(manifest, {
    repository: SOURCE_REPOSITORY, releaseTag: manifest.source.releaseTag!, releaseCommit: STICKER_SOURCE_REF,
    artifactSha256: pack.manifestSha256, manifestSha256: manifest.integrity.manifestSha256,
    signature: {algorithm: 'Ed25519', keyId, value: signature},
  })
  await releases.publishRelease(pack.moduleId, VERSION)
  const manifestArtifactId = `release:${release.releaseId}:sticker-manifest`
  const now = new Date()
  await db.transaction().execute(async trx => {
    await trx.insertInto('greenfield_release_asset_blobs').values({
      sha256: pack.manifestSha256, media_type: 'application/json', byte_size: pack.manifest.length, bytes: pack.manifest, created_at: now,
    }).onConflict(oc => oc.column('sha256').doNothing()).execute()
    await trx.insertInto('greenfield_release_artifacts').values({
      artifact_id: manifestArtifactId, release_id: release.releaseId, kind: 'asset', sha256: pack.manifestSha256,
      filename: `${pack.packId}-${VERSION}.json`, access_class: 'public', required_for_offline_launch: true, created_at: now,
    }).execute()
    await trx.insertInto('greenfield_release_artifact_signatures').values({
      artifact_signature_id: `artifact-signature:${manifestArtifactId}:${keyId}`, artifact_id: manifestArtifactId,
      signature_key_id: keyId, algorithm: 'Ed25519', signed_digest: pack.manifestSha256,
      signature: sign(null, Buffer.from(pack.manifestSha256), privateKey).toString('base64'),
      verification_state: 'verified', verified_at: now, created_at: now,
    }).execute()
    await trx.insertInto('greenfield_sticker_pack_releases').values({
      release_id: release.releaseId, manifest_artifact_id: manifestArtifactId, pack_id: pack.packId, version: VERSION,
      title: pack.title, icon: pack.icon, series: pack.series, availability: 'approved', sort_order: pack.series,
      approved_at: now, withdrawn_at: null, created_at: now, updated_at: now,
    }).execute()
    for (const [index, sticker] of pack.stickers.entries()) {
      const artifactId = `release:${release.releaseId}:sticker:${sticker.id}`
      await trx.insertInto('greenfield_release_asset_blobs').values({
        sha256: sticker.sha256, media_type: 'image/png', byte_size: sticker.bytes.length, bytes: sticker.bytes, created_at: now,
      }).onConflict(oc => oc.column('sha256').doNothing()).execute()
      await trx.insertInto('greenfield_release_artifacts').values({
        artifact_id: artifactId, release_id: release.releaseId, kind: 'asset', sha256: sticker.sha256,
        filename: `${sticker.id}.png`, access_class: 'public', required_for_offline_launch: true, created_at: now,
      }).execute()
      await trx.insertInto('greenfield_stickers').values({
        release_id: release.releaseId, sticker_id: sticker.id, label: sticker.label, emoji: '🌱',
        artifact_id: artifactId, sort_order: index + 1, created_at: now,
      }).execute()
    }
  })
  return 'created' as const
}

async function ensureKey(db: ModulaDb, keyId: string, publicKeyPem: string) {
  const existing = await db.selectFrom('greenfield_publisher_signing_keys').select(['publisher_id', 'public_key_pem', 'state']).where('key_id', '=', keyId).executeTakeFirst()
  if (existing) {
    if (existing.publisher_id !== 'modula' || existing.public_key_pem !== publicKeyPem || existing.state !== 'ACTIVE') fail('Existing QA signing key facts do not match')
    return
  }
  await new GreenfieldPublisherSigningKeyService(db).register('modula', {keyId, publicKeyPem}, null)
}

function assertQaDatabase(value: string) {
  const url = new URL(value), database = decodeURIComponent(url.pathname.slice(1))
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname) || !/(?:qa|test|disposable|feature_reality)/i.test(database)
      || process.env.MODULA_ENVIRONMENT !== 'qa') fail('Refusing sticker seed outside loopback-only QA/test')
}

function gitBytes(root: string, ref: string, path: string) { return execFileSync('git', ['show', `${ref}:${path}`], {cwd: root, maxBuffer: 8 * 1024 * 1024}) }
function git(root: string, command: string[]) { return execFileSync('git', command, {cwd: root, encoding: 'utf8'}).trim() }
function sha256(value: Buffer | string) { return createHash('sha256').update(value).digest('hex') }
function printResult(status: string, packs: Pack[], result: Record<string, unknown> | null) {
  process.stdout.write(`${JSON.stringify({mission: MISSION, status, sourceRef: STICKER_SOURCE_REF, packs: packs.map(pack => ({id: pack.packId, series: pack.series, stickers: pack.stickers.length})), result}, null, 2)}\n`)
}
function fail(message: string): never { throw new Error(message) }
