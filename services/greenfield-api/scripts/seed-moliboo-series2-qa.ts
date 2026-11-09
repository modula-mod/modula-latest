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
import {validateMolibooArtifact} from '../src/domains/moliboos/service.js'
import {GreenfieldModulePublisherService} from '../src/modules/publisher-service.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {
  GreenfieldPublisherSigningKeyService,
  buildPublisherReleaseStatement,
  statementBytes,
} from '../src/modules/release-signing.js'

const MISSION = 'GREENFIELD-FEATURE-REALITY-01'
const SOURCE_REPOSITORY = 'modula-mod/modula-native'
const POSTER_SOURCE_REF = '791d42e968b4f1b4f3ad309857b4b9fee262c495'
const MEDIA_TYPE = 'application/vnd.modula.moliboo-asset-pack+json'
const args = new Set(process.argv.slice(2))
for (const arg of args) if (arg !== '--apply') fail(`Unknown argument: ${arg}`)
const apply = args.has('--apply')

const nativeRoot = resolve(process.env.MODULA_NATIVE_ROOT ?? '/root/modula-worktrees/modula-native-vps-reference')
const sourceRef = process.env.MODULA_NATIVE_SERIES2_REF ?? POSTER_SOURCE_REF
if (sourceRef !== POSTER_SOURCE_REF) fail(`Series 2 must use the approved poster-cutout source ${POSTER_SOURCE_REF}`)
const resolvedRef = git(nativeRoot, ['rev-parse', `${sourceRef}^{commit}`])
if (resolvedRef !== POSTER_SOURCE_REF) fail('The immutable Series 2 source ref does not resolve to the approved commit')

const source = readGitJson<SeriesSource>(nativeRoot, sourceRef, 'Tools/moliboo/packages/series2/manifest.json')
validateSeriesSource(source)
const packages = source.packages.map(entry => loadPackage(nativeRoot, sourceRef, entry))

if (!apply) {
  printResult('DRY_RUN', packages, null)
  process.exit(0)
}
const databaseUrl = process.env.MODULA_DATABASE_MIGRATOR_URL
if (!databaseUrl) fail('MODULA_DATABASE_MIGRATOR_URL is required')
assertQaDatabase(databaseUrl)
if (process.env.MODULA_QA_FIXTURE_APPLY !== MISSION) fail(`MODULA_QA_FIXTURE_APPLY must equal ${MISSION}`)
const privateKeyPath = process.env.MODULA_QA_SIGNING_KEY_PATH
if (!privateKeyPath) fail('MODULA_QA_SIGNING_KEY_PATH is required for --apply')
const keyStat = statSync(privateKeyPath)
if (!keyStat.isFile() || (keyStat.mode & 0o077) !== 0) fail('QA signing key must be a regular file with mode 0600 or stricter')
const privateKey = createPrivateKey(readFileSync(privateKeyPath))
if (privateKey.asymmetricKeyType !== 'ed25519') fail('QA signing key must be Ed25519')
const publicKey = createPublicKey(privateKey)
const publicKeyPem = publicKey.export({format: 'pem', type: 'spki'}).toString()
const keyId = sha256(publicKey.export({format: 'der', type: 'spki'}))

const db = createDb(databaseUrl)
try {
  const firstManifest = buildManifest(packages[0]!)
  await new GreenfieldModulePublisherService(db).ensurePublisherForManifest(firstManifest)
  await ensureQaKey(db, keyId, publicKeyPem)
  await ensureLegends(db)
  const releases = new GreenfieldModuleReleaseService(db)
  let created = 0
  let existing = 0
  for (const entry of packages) {
    const outcome = await publishPackage(db, releases, entry, keyId, privateKey)
    outcome === 'created' ? created++ : existing++
  }
  const count = await db.selectFrom('greenfield_moliboo_pack_releases as pack')
    .innerJoin('greenfield_moliboo_characters as character', 'character.character_id', 'pack.character_id')
    .select(eb => eb.fn.countAll<number>().as('count'))
    .where('character.series', '=', 2).where('pack.availability', '=', 'approved').executeTakeFirstOrThrow()
  if (Number(count.count) !== 100) fail(`Expected exactly 100 approved Series 2 packs, found ${count.count}`)
  printResult('APPLIED', packages, {created, existing, approvedSeries2: Number(count.count), keyId})
} finally {
  await db.destroy()
}

type SeriesSource = {
  schemaVersion: string
  availability: string
  art: string
  packages: SeriesEntry[]
}

type SeriesEntry = {
  packageId: string
  version: string
  characterId: string
  key: string
  familyId: string
  number: number
  directory: string
  containerFiles: string[]
  files: Array<{path: string; mediaType: string; sha256: string; bytes: number; art?: string}>
}

type LoadedPackage = SeriesEntry & {
  characterBytes: Buffer
  portraitBytes: Buffer
  artifact: Buffer
  artifactSha256: string
}

function validateSeriesSource(value: SeriesSource) {
  if (value.schemaVersion !== 'modula.moliboo.series2-sources.1' || value.art !== 'poster-cutout') fail('Series 2 source manifest is not the approved poster-cutout contract')
  if (!Array.isArray(value.packages) || value.packages.length !== 100) fail('Series 2 must contain exactly 100 package records')
  const numbers = value.packages.map(item => item.number).sort((a, b) => a - b)
  if (numbers.some((number, index) => number !== 116 + index)) fail('Series 2 IDs must be the contiguous range 116-215')
  if (value.packages[0]?.key !== 'brinlo' || value.packages.at(-1)?.key !== 'jubilo') fail('Series 2 boundary identities must be Brinlo and Jubilo')
  const packageIds = new Set(value.packages.map(item => item.packageId))
  const characterIds = new Set(value.packages.map(item => item.characterId))
  if (packageIds.size !== 100 || characterIds.size !== 100) fail('Series 2 package and character IDs must be unique')
}

function loadPackage(root: string, ref: string, entry: SeriesEntry): LoadedPackage {
  const expectedPackageId = `moliboo.character.${entry.number}`
  const expectedCharacterId = `moliboo.${entry.number}`
  if (entry.packageId !== expectedPackageId || entry.characterId !== expectedCharacterId || entry.version !== '0.1.0'
      || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(entry.familyId)
      || !/^sources\/[0-9]{3}_[a-z0-9_]+$/.test(entry.directory)
      || entry.containerFiles.join(',') !== 'character.json,portrait.png') fail(`Invalid source identity for character ${entry.number}`)
  const prefix = `Tools/moliboo/packages/series2/${entry.directory}`
  const characterBytes = gitBytes(root, ref, `${prefix}/character.json`)
  const portraitBytes = gitBytes(root, ref, `${prefix}/portrait.png`)
  for (const [path, bytes] of [['character.json', characterBytes], ['portrait.png', portraitBytes]] as const) {
    const fact = entry.files.find(file => file.path === path)
    if (!fact || fact.bytes !== bytes.length || fact.sha256 !== sha256(bytes)) fail(`Immutable source checksum mismatch for ${entry.packageId}/${path}`)
  }
  const artifact = Buffer.from(JSON.stringify({
    schemaVersion: 'modula.moliboo.assetpack.1', packageId: entry.packageId, version: entry.version,
    characterId: entry.characterId,
    files: [
      {path: 'character.json', mediaType: 'application/json', sha256: sha256(characterBytes), bytes: characterBytes.length, data: characterBytes.toString('base64')},
      {path: 'portrait.png', mediaType: 'image/png', sha256: sha256(portraitBytes), bytes: portraitBytes.length, data: portraitBytes.toString('base64')},
    ],
  }))
  validateMolibooArtifact(artifact, {packageId: entry.packageId, version: entry.version, characterId: entry.characterId})
  return {...entry, characterBytes, portraitBytes, artifact, artifactSha256: sha256(artifact)}
}

function buildManifest(entry: LoadedPackage): GreenfieldModuleManifest {
  const manifest = {
    manifestVersion: GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
    moduleId: entry.packageId,
    name: `Moliboo ${title(entry.key)}`,
    description: `Content-only Moliboo Series 2 pack for ${title(entry.key)}.`,
    version: entry.version,
    standardVersion: '2.1.0',
    sectionVersions: createDefaultModuleSectionVersions(),
    publisher: {publisherId: 'modula', displayName: 'Modula', website: 'https://modula.digital'},
    source: {
      provider: 'github', repository: SOURCE_REPOSITORY, commit: POSTER_SOURCE_REF,
      manifestPath: `Tools/moliboo/packages/series2/${entry.directory}/character.json`,
      releaseTag: `qa-${entry.packageId}-v${entry.version}`,
      releaseAssetName: `${entry.packageId}-${entry.version}.json`,
    },
    license: {status: 'firstParty', evidenceIds: [`native-source:${POSTER_SOURCE_REF}:${entry.directory}`]},
    trust: {requestedLevel: 'firstParty'},
    compatibility: {minimumGreenfieldVersion: '0.1.0', minimumModulaHostVersion: '0.1.0', protocolVersions: ['greenfield.v1'], platforms: ['ios']},
    permissions: [], dependencies: [], contributions: {},
    dependencyGraph: {version: '2.0.0', requires: [], optional: [], recommended: [], conflicts: [], replaces: [], provides: []},
    capabilityDiscovery: {version: '2.0.0'}, serviceRegistry: {version: '2.0.0', items: []},
    apiRegistry: {version: '2.0.0', items: []}, hookRegistry: {version: '2.0.0', items: []},
    permissionModel: {version: '2.0.0', categories: {}}, jobRegistry: {version: '2.0.0', items: []},
    storageModel: {version: '2.0.0', items: []}, widgetRegistry: {version: '2.0.0', items: []},
    navigationRegistry: {version: '2.0.0', items: []}, uiContributions: {version: '2.0.0', items: []},
    eventBus: {version: '2.0.0', items: []},
    extensionProduct: {
      version: entry.version, kind: 'module', targets: [], extensionPoints: [], contributions: [],
      retention: {defaultMode: 'KEEP_DATA', supportsUserChoice: true}, graphPolicy: {maxDepth: 16, maxNodes: 256},
    },
    lifecycle: {executionMode: 'declarative'},
    integrity: {manifestSha256: '', releaseSha256: entry.artifactSha256},
  } as GreenfieldModuleManifest
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  return manifest
}

async function publishPackage(db: ModulaDb, releases: GreenfieldModuleReleaseService, entry: LoadedPackage, keyId: string, privateKey: ReturnType<typeof createPrivateKey>) {
  const existing = await releases.getRelease(entry.packageId, entry.version)
  if (existing) {
    const pack = await db.selectFrom('greenfield_moliboo_pack_releases').selectAll().where('release_id', '=', existing.releaseId).executeTakeFirst()
    if (existing.releaseState !== 'published' || existing.releaseSha256 !== entry.artifactSha256 || existing.sourceCommit !== POSTER_SOURCE_REF
        || !pack || pack.artifact_id !== `release:${existing.releaseId}:moliboo-asset-pack` || pack.availability !== 'approved') {
      fail(`Refusing to replace inconsistent existing release ${entry.packageId}@${entry.version}`)
    }
    return 'existing' as const
  }
  const manifest = buildManifest(entry)
  const statement = buildPublisherReleaseStatement({manifest, sourceSha: POSTER_SOURCE_REF, artifactSha256: entry.artifactSha256, signingKeyId: keyId})
  const releaseSignature = sign(null, statementBytes(statement), privateKey).toString('base64url')
  const imported = await releases.importPendingReview(manifest, {
    repository: SOURCE_REPOSITORY, releaseTag: manifest.source.releaseTag!, releaseCommit: POSTER_SOURCE_REF,
    artifactSha256: entry.artifactSha256, manifestSha256: manifest.integrity.manifestSha256,
    signature: {algorithm: 'Ed25519', keyId, value: releaseSignature},
  })
  await releases.publishRelease(entry.packageId, entry.version)
  const artifactId = `release:${imported.releaseId}:moliboo-asset-pack`
  const now = new Date()
  await db.transaction().execute(async trx => {
    await trx.insertInto('greenfield_release_asset_blobs').values({
      sha256: entry.artifactSha256, media_type: MEDIA_TYPE, byte_size: entry.artifact.length, bytes: entry.artifact, created_at: now,
    }).onConflict(oc => oc.column('sha256').doNothing()).execute()
    await trx.insertInto('greenfield_release_artifacts').values({
      artifact_id: artifactId, release_id: imported.releaseId, kind: 'asset', sha256: entry.artifactSha256,
      filename: `${entry.packageId}-${entry.version}.json`, access_class: 'public', required_for_offline_launch: true, created_at: now,
    }).execute()
    await trx.insertInto('greenfield_release_artifact_signatures').values({
      artifact_signature_id: `artifact-signature:${artifactId}:${keyId}`, artifact_id: artifactId,
      signature_key_id: keyId, algorithm: 'Ed25519', signed_digest: entry.artifactSha256,
      signature: sign(null, Buffer.from(entry.artifactSha256), privateKey).toString('base64'),
      verification_state: 'verified', verified_at: now, created_at: now,
    }).execute()
    await trx.insertInto('greenfield_moliboo_characters').values({
      character_id: entry.characterId, character_number: entry.number, character_key: entry.key,
      display_name: title(entry.key), family_id: entry.familyId, series: 2, wearable: true, created_at: now, updated_at: now,
    }).execute()
    await trx.insertInto('greenfield_moliboo_items').values({
      item_id: entry.characterId, name: title(entry.key), slot: 'character', rarity: 'common', access: 'earnable',
      family: entry.familyId, set_id: null, icon_key: `character_${entry.number}`, palette: JSON.stringify([]),
      sort_order: entry.number, active: true, item_type: 'character', character_id: entry.characterId,
      wearable: true, revoked_at: null, created_at: now, updated_at: now,
    }).execute()
    await trx.insertInto('greenfield_moliboo_pack_releases').values({
      release_id: imported.releaseId, artifact_id: artifactId, package_id: entry.packageId, version: entry.version,
      character_id: entry.characterId, family_id: entry.familyId, minimum_host_version: '0.1.0', runtime_version: 1,
      asset_capabilities: JSON.stringify(['character.patch', 'portrait.png']), rollback_compatible: true,
      availability: 'approved', state_revision: 1, approved_at: now, withdrawn_at: null,
      withdrawal_reason: null, created_at: now, updated_at: now,
    }).execute()
    await trx.insertInto('greenfield_moliboo_pack_release_events').values({
      event_id: randomUUID(), release_id: imported.releaseId, event_type: 'approved', state_revision: 1,
      actor_account_id: null, reason: `${MISSION} QA fixture from immutable poster-cutout source`, occurred_at: now,
    }).execute()
  })
  return 'created' as const
}

async function ensureQaKey(db: ModulaDb, keyId: string, publicKeyPem: string) {
  const existing = await db.selectFrom('greenfield_publisher_signing_keys').select(['key_id', 'publisher_id', 'public_key_pem', 'state'])
    .where('key_id', '=', keyId).executeTakeFirst()
  if (existing) {
    if (existing.publisher_id !== 'modula' || existing.public_key_pem !== publicKeyPem || existing.state !== 'ACTIVE') fail('Existing QA signing key facts do not match')
    return
  }
  await new GreenfieldPublisherSigningKeyService(db).register('modula', {keyId, publicKeyPem}, null)
}

async function ensureLegends(db: ModulaDb) {
  const legends = [
    [101, 'kringle', 'The Gift Bringer'], [102, 'sasqui', 'The Forest Wanderer'], [103, 'lochie', 'The Loch Keeper'],
    [104, 'yetti', 'The Snow Giant'], [105, 'krakie', 'The Deep Dreamer'], [106, 'pyra', 'The Reborn Flame'],
    [107, 'unika', 'The Rainbow Horn'], [108, 'gryff', 'The Sky Lion'], [109, 'frostie', 'The Frost Painter'],
    [110, 'pearli', 'The Midnight Collector'], [111, 'kitsu', 'The Nine-Tailed Fox'], [112, 'chupi', 'The Desert Prowler'],
    [113, 'motho', 'The Night Watcher'], [114, 'jacko', 'The Antlered Hare'], [115, 'thundra', 'The Storm Bringer'],
  ] as const
  const now = new Date()
  await db.transaction().execute(async trx => {
    await trx.insertInto('greenfield_moliboo_characters').values(legends.map(([number, key, name]) => ({
      character_id: `moliboo.${number}`, character_number: number, character_key: key, display_name: name,
      family_id: 'legends', series: 1, wearable: false, created_at: now, updated_at: now,
    }))).onConflict(oc => oc.column('character_id').doNothing()).execute()
    await trx.insertInto('greenfield_moliboo_items').values(legends.map(([number, key, name]) => ({
      item_id: `moliboo.${number}`, name, slot: 'character', rarity: 'legendary' as const, access: 'earnable' as const,
      family: 'legends', set_id: null, icon_key: `character_${key}`, palette: JSON.stringify([]),
      sort_order: number, active: true, item_type: 'character' as const, character_id: `moliboo.${number}`,
      wearable: false, revoked_at: null, created_at: now, updated_at: now,
    }))).onConflict(oc => oc.column('item_id').doNothing()).execute()
  })
}

function assertQaDatabase(value: string) {
  let url: URL
  try { url = new URL(value) } catch { fail('MODULA_DATABASE_MIGRATOR_URL is invalid') }
  const database = decodeURIComponent(url.pathname.slice(1))
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname)
  if (!loopback || !/(?:qa|test|disposable|feature_reality)/i.test(database)) fail('Refusing to seed a database that is not demonstrably loopback-only QA/test')
  if (process.env.MODULA_ENVIRONMENT !== 'qa') fail('MODULA_ENVIRONMENT must equal qa')
}

function readGitJson<T>(root: string, ref: string, path: string): T {
  return JSON.parse(gitBytes(root, ref, path).toString('utf8')) as T
}

function gitBytes(root: string, ref: string, path: string) {
  return execFileSync('git', ['show', `${ref}:${path}`], {cwd: root, maxBuffer: 8 * 1024 * 1024})
}

function git(root: string, command: string[]) {
  return execFileSync('git', command, {cwd: root, encoding: 'utf8'}).trim()
}

function sha256(value: Buffer | string) { return createHash('sha256').update(value).digest('hex') }
function title(value: string) { return value.split(/[-_]/).map(part => part ? part[0]!.toUpperCase() + part.slice(1) : part).join(' ') }

function printResult(status: string, entries: LoadedPackage[], result: Record<string, unknown> | null) {
  process.stdout.write(`${JSON.stringify({mission: MISSION, status, sourceRef: POSTER_SOURCE_REF, sourceArt: 'poster-cutout', first: entries[0]?.packageId, last: entries.at(-1)?.packageId, packages: entries.length, result}, null, 2)}\n`)
}

function fail(message: string): never { throw new Error(message) }
