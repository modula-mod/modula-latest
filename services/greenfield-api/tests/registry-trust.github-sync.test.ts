import {generateKeyPairSync, randomUUID, sign} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {gzipSync} from 'node:zlib'
import {sql} from 'kysely'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {readTarGz} from '../src/lib/tar-gz.js'
import {GreenfieldGithubReleaseSyncService, verifyOptionalArchive, verifyWebGameArchive, type GithubRelease, type GithubReleaseAsset, type GithubReleaseSource} from '../src/modules/github-release-sync-service.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldPublisherSigningKeyService, buildPublisherReleaseStatement, statementBytes} from '../src/modules/release-signing.js'
import {adapterManifest, configureRegistryTestEnv, fixtureProduct, fixtureRoot, registerAccount, sha256} from './helpers/registry-fixtures.js'
import {createDb as createWorkerDb} from '../../greenfield-worker/src/database.js'
import {loadConfig as loadWorkerConfig} from '../../greenfield-worker/src/config.js'
import {handleModuleInstall} from '../../greenfield-worker/src/modules/installation-handler.js'
import {handleModuleUpdate} from '../../greenfield-worker/src/modules/update-handler.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)
const REPOSITORY = 'modula-mod/registry-trust-fixtures'
const COMMIT = '0123456789abcdef0123456789abcdef01234567'

function tarEntry(path: string, bytes: Buffer): Buffer {
  const header = Buffer.alloc(512)
  header.write(path, 0, 100, 'utf8')
  header.write('0000644\0', 100)
  header.write('0000000\0', 108)
  header.write('0000000\0', 116)
  header.write(`${bytes.length.toString(8).padStart(11, '0')}\0`, 124)
  header.write('00000000000\0', 136)
  header.write('        ', 148)
  header.write('0', 156)
  header.write('ustar\0', 257)
  header.write('00', 263)
  let sum = 0
  for (const byte of header) sum += byte
  header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148)
  return Buffer.concat([header, bytes, Buffer.alloc(Math.ceil(bytes.length / 512) * 512 - bytes.length)])
}

function tgz(files: Record<string, Buffer>): Buffer {
  return gzipSync(Buffer.concat([...Object.entries(files).map(([path, bytes]) => tarEntry(`package/${path}`, bytes)), Buffer.alloc(1024)]))
}

it('accepts only fully inventoried offline web game archives', () => {
  const html = Buffer.from('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; connect-src \'none\'">')
  const js = Buffer.from('document.title="Game"')
  const inventory = Buffer.from(JSON.stringify({schema: 'modula.game-files.1', files: {'index.html': sha256(html), 'main.js': sha256(js)}}))
  const game = gzipSync(Buffer.concat([tarEntry('index.html', html), tarEntry('main.js', js), tarEntry('game.files.json', inventory), Buffer.alloc(1024)]))
  expect(() => verifyWebGameArchive(game)).not.toThrow()
  const changed = gzipSync(Buffer.concat([tarEntry('index.html', html), tarEntry('main.js', Buffer.from('changed')), tarEntry('game.files.json', inventory), Buffer.alloc(1024)]))
  expect(() => verifyWebGameArchive(changed)).toThrow(/digest mismatch/)
  const outside = gzipSync(Buffer.concat([tarEntry('../outside.js', js), tarEntry('index.html', html), tarEntry('game.files.json', inventory), Buffer.alloc(1024)]))
  expect(() => verifyWebGameArchive(outside)).toThrow(/unsafe/i)
  const collidingInventory = Buffer.from(JSON.stringify({schema: 'modula.game-files.1', files: {
    'index.html': sha256(html), 'main.js': sha256(js), 'MAIN.js': sha256(Buffer.from('other')),
  }}))
  const colliding = gzipSync(Buffer.concat([
    tarEntry('index.html', html), tarEntry('main.js', js),
    tarEntry('MAIN.js', Buffer.from('other')), tarEntry('game.files.json', collidingInventory), Buffer.alloc(1024),
  ]))
  expect(() => verifyWebGameArchive(colliding)).toThrow(/case-conflicting/)
  const tooMany = gzipSync(Buffer.concat([
    ...Array.from({length: 513}, (_, index) => tarEntry('file-' + index + '.txt', Buffer.from('x'))),
    Buffer.alloc(1024),
  ]))
  expect(() => verifyWebGameArchive(tooMany)).toThrow(/too many entries/)
  const invalidHeader = Buffer.from(tarEntry('index.html', html))
  invalidHeader.write('gnu!!', 257)
  invalidHeader.fill(32, 148, 156)
  const checksum = invalidHeader.subarray(0, 512).reduce((sum, byte) => sum + byte, 0)
  invalidHeader.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148)
  const nonUstar = gzipSync(Buffer.concat([invalidHeader, Buffer.alloc(1024)]))
  expect(() => verifyWebGameArchive(nonUstar)).toThrow(/regular ustar/)
})

it('accepts an inventoried web runtime and rejects substitution or native members', () => {
  const js = Buffer.from('export const Phaser = {VERSION: "4.2.1"}')
  const inventory = Buffer.from(JSON.stringify({schema: 'modula.package-files.1', files: {'engine.mjs': sha256(js)}}))
  const runtime = gzipSync(Buffer.concat([tarEntry('engine.mjs', js), tarEntry('package.files.json', inventory), Buffer.alloc(1024)]))
  expect(() => verifyOptionalArchive(runtime, 'web-runtime')).not.toThrow()
  const changed = gzipSync(Buffer.concat([tarEntry('engine.mjs', Buffer.from('substituted')), tarEntry('package.files.json', inventory), Buffer.alloc(1024)]))
  expect(() => verifyOptionalArchive(changed, 'web-runtime')).toThrow(/digest mismatch/)
  const native = gzipSync(Buffer.concat([tarEntry('native.dylib', js), tarEntry('package.files.json', inventory), Buffer.alloc(1024)]))
  expect(() => verifyOptionalArchive(native, 'web-runtime')).toThrow(/native payload|unsafe member/)
})

it('requires module package inventories and rejects tampered or executable content', () => {
  const frontend = Buffer.from('{"schemaVersion":"1.0.0","views":[]}')
  const inventory = Buffer.from(JSON.stringify({
    schema: 'modula.package-files.1',
    files: {'frontend/frontend.manifest.json': sha256(frontend)},
  }))
  const modulePackage = gzipSync(Buffer.concat([
    tarEntry('frontend/frontend.manifest.json', frontend),
    tarEntry('package.files.json', inventory),
    Buffer.alloc(1024),
  ]))
  expect(() => verifyOptionalArchive(modulePackage, 'module')).not.toThrow()

  const changed = gzipSync(Buffer.concat([
    tarEntry('frontend/frontend.manifest.json', Buffer.from('{"changed":true}')),
    tarEntry('package.files.json', inventory),
    Buffer.alloc(1024),
  ]))
  expect(() => verifyOptionalArchive(changed, 'module')).toThrow(/digest mismatch/)

  const nativeInventory = Buffer.from(JSON.stringify({
    schema: 'modula.package-files.1',
    files: {'native/module.dylib': sha256(Buffer.from('native'))},
  }))
  const native = gzipSync(Buffer.concat([
    tarEntry('native/module.dylib', Buffer.from('native')),
    tarEntry('package.files.json', nativeInventory),
    Buffer.alloc(1024),
  ]))
  expect(() => verifyOptionalArchive(native, 'module')).toThrow(/native payload|unsafe member/)
})

type Built = {source: FakeSource; productId: string; version: string; tag: string; packageBytes: Buffer; files: Record<string, Buffer>; provenance: Record<string, unknown>}

class FakeSource implements GithubReleaseSource {
  downloads: string[] = []
  constructor(public release: GithubRelease, public bytes: Map<string, Buffer>, public commit: string) {}
  async getRelease(repository: string, tag: string) {
    if (repository !== REPOSITORY || tag !== this.release.tagName) throw Object.assign(new Error('not found'), {code: 'NOT_FOUND'})
    return this.release
  }
  async resolveTagCommit() { return this.commit }
  async downloadAsset(asset: GithubReleaseAsset) {
    this.downloads.push(asset.name)
    return this.bytes.get(asset.name)!
  }
}

function buildRelease(productId: string, version: string, options: {
  mutateFiles?: (files: Record<string, Buffer>) => void
  mutateProvenance?: (provenance: Record<string, unknown>) => void
  mutateProduct?: (mps: Record<string, any>, frontend: Record<string, any>) => void
  manifestOverrides?: Parameters<typeof adapterManifest>[2]
  legacy?: Record<string, unknown> | null
  sign?: {keyId: string; privateKey: ReturnType<typeof generateKeyPairSync>['privateKey']}
} = {}): Built {
  const tag = `${productId}-v${version}`
  const packageFile = `${productId}-${version}.tgz`
  const product = fixtureProduct(productId, version, (mps, frontend) => {
    mps.source = {...(mps.source ?? {}), provider: 'github', repository: REPOSITORY}
    mps.publisher = {...(mps.publisher ?? {}), id: 'modula'}
    options.mutateProduct?.(mps, frontend)
  })
  const manifest = adapterManifest(productId, version, options.manifestOverrides)
  const files: Record<string, Buffer> = {
    'modula.product.json': Buffer.from(product.mpsBytes),
    'module.manifest.json': Buffer.from(JSON.stringify(manifest, null, 2)),
    [product.frontend.path]: product.frontend.bytes,
  }
  for (const record of (product.mps.backend?.records ?? []) as Array<{schemaPath?: string}>) {
    if (record.schemaPath) files[record.schemaPath] = readFileSync(join(fixtureRoot, record.schemaPath))
  }
  for (const asset of product.assets) files[asset.path] = asset.bytes
  if (options.legacy !== null) files['modula.module.json'] = Buffer.from(JSON.stringify(options.legacy ?? {id: productId, moduleVersion: version, publisher: {id: 'modula'}}))
  options.mutateFiles?.(files)
  const packageBytes = tgz(files)
  const provenance: Record<string, unknown> = {
    productId, version, repository: REPOSITORY, releaseCommit: COMMIT, releaseTag: tag, packageFile,
    packageChecksum: sha256(packageBytes),
    productManifestChecksum: sha256(Buffer.from(product.mpsBytes)),
    greenfieldManifestChecksum: manifest.integrity.manifestSha256,
    frontendArtifact: product.frontend.path,
    frontendChecksum: sha256(product.frontend.bytes),
  }
  if (files['modula.module.json']) provenance.standardManifestChecksum = sha256(files['modula.module.json'])
  if (options.sign) {
    const statement = buildPublisherReleaseStatement({manifest, sourceSha: COMMIT, artifactSha256: sha256(packageBytes), productManifestSha256: sha256(Buffer.from(product.mpsBytes)), frontendSha256: sha256(product.frontend.bytes), signingKeyId: options.sign.keyId})
    provenance.signature = {algorithm: 'Ed25519', keyId: options.sign.keyId, value: sign(null, statementBytes(statement), options.sign.privateKey).toString('base64url')}
  }
  options.mutateProvenance?.(provenance)
  const provenanceBytes = Buffer.from(JSON.stringify(provenance, null, 2))
  const assets: GithubReleaseAsset[] = [
    {name: packageFile, size: packageBytes.length, apiUrl: `https://api.github.com/assets/${packageFile}`, digest: `sha256:${sha256(packageBytes)}`},
    {name: `${tag}.provenance.json`, size: provenanceBytes.length, apiUrl: `https://api.github.com/assets/${tag}.provenance.json`, digest: `sha256:${sha256(provenanceBytes)}`},
  ]
  const source = new FakeSource({tagName: tag, draft: false, prerelease: false, assets}, new Map([[packageFile, packageBytes], [`${tag}.provenance.json`, provenanceBytes]]), COMMIT)
  return {source, productId, version, tag, packageBytes, files, provenance}
}

describe('release tarball reader', () => {
  it('reads regular files and rejects path traversal', () => {
    const entries = readTarGz(tgz({'a.txt': Buffer.from('hello')}), {maxUncompressedBytes: 1_000_000})
    expect(entries.get('package/a.txt')?.toString()).toBe('hello')
    const evil = gzipSync(Buffer.concat([tarEntry('../escape.txt', Buffer.from('x')), Buffer.alloc(1024)]))
    expect(() => readTarGz(evil, {maxUncompressedBytes: 1_000_000})).toThrow(/unsafe/)
    expect(() => readTarGz(Buffer.from('not gzip'), {maxUncompressedBytes: 1_000_000})).toThrow(/gzip/)
  })

  it('rejects native payload names and executable binary signatures', () => {
    expect(() => readTarGz(tgz({'native/addon.dylib': Buffer.from('not-native')}), {maxUncompressedBytes: 1_000_000})).toThrow(/forbidden native payload/)
    expect(() => readTarGz(tgz({'native/addon.bin': Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02])}), {maxUncompressedBytes: 1_000_000})).toThrow(/native executable bytes/)
    expect(() => readTarGz(tgz({'native/addon.bin': Buffer.from([0x4d, 0x5a, 0x90, 0x00])}), {maxUncompressedBytes: 1_000_000})).toThrow(/native executable bytes/)
  })
})

describeIfDb('registry trust pipeline: automated GitHub release sync', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let n = 0
  const nextId = () => `digital.modula.sync-${suffix}-${++n}`

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!)
    process.env.MODULA_ADMIN_HANDLES = `gubicadmin${suffix},gubicreview${suffix}`
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('dry-runs by default: verifies everything and writes nothing', async () => {
    const built = buildRelease(nextId(), '1.0.0')
    const result = await new GreenfieldGithubReleaseSyncService(db, built.source).sync({repository: REPOSITORY, releaseTag: built.tag})
    expect(result).toMatchObject({mode: 'DRY_RUN', action: 'import', productId: built.productId, packageSha256: sha256(built.packageBytes)})
    expect(result.checks).toEqual(expect.arrayContaining(['provenance.identity', 'tag.commit', 'package.sha256', 'productManifest.sha256', 'adapterManifest.sha256', 'identity.consistent', 'frontend.sha256']))
    expect(await new GreenfieldModuleReleaseService(db).getRelease(built.productId, '1.0.0')).toBeUndefined()
  })

  it('imports, verifies, publishes and ingests a release; serves its package and media; re-sync is a backfill', async () => {
    const built = buildRelease(nextId(), '1.0.0')
    const service = new GreenfieldGithubReleaseSyncService(db, built.source)
    const result = await service.sync({repository: REPOSITORY, releaseTag: built.tag, publish: true, dryRun: false})
    expect(result).toMatchObject({mode: 'APPLIED', action: 'import', releaseState: 'published', packageStored: true, signed: false})
    const run = await db.selectFrom('greenfield_module_sync_runs').select(['status']).where('sync_run_id', '=', (result as {syncRunId: string}).syncRunId).executeTakeFirstOrThrow()
    expect(run.status).toBe('completed')

    const detail = await app.inject({method: 'GET', url: `/v1/registry/modules/${built.productId}`})
    expect(detail.statusCode, detail.body).toBe(200)
    const data = detail.json().data
    expect(data.registryTrust.signature.state).toBe('unsigned')
    expect(data.registryTrust.digests).toMatchObject({releaseSha256: sha256(built.packageBytes)})
    const icon = data.presentation.icon
    expect(icon?.url).toMatch(/\/v1\/registry\/releases\/.+\/assets\//)
    const media = await app.inject({method: 'GET', url: new URL(icon.url).pathname})
    expect(media.statusCode).toBe(200)
    expect(sha256(media.rawPayload)).toBe(icon.sha256)
    const artifact = await app.inject({method: 'GET', url: `/v1/registry/releases/${encodeURIComponent(data.registryReleaseId)}/artifact`})
    expect(artifact.statusCode).toBe(404)
    const stored = await db.selectFrom('greenfield_release_asset_blobs').select(['bytes']).where('sha256', '=', sha256(built.packageBytes)).executeTakeFirstOrThrow()
    expect(sha256(stored.bytes)).toBe(sha256(built.packageBytes))

    const again = await service.sync({repository: REPOSITORY, releaseTag: built.tag, publish: true, dryRun: false})
    expect(again).toMatchObject({mode: 'APPLIED', action: 'backfill', releaseState: 'published'})
  })

  it('leaves the release verified (unpublished) unless publish is requested', async () => {
    const built = buildRelease(nextId(), '1.0.0')
    const result = await new GreenfieldGithubReleaseSyncService(db, built.source).sync({repository: REPOSITORY, releaseTag: built.tag, dryRun: false})
    expect(result).toMatchObject({mode: 'APPLIED', releaseState: 'verified'})
  })

  it('verifies a publisher signature carried in the provenance sidecar', async () => {
    const keys = generateKeyPairSync('ed25519')
    const keyId = `sync-${suffix}`
    await new GreenfieldPublisherSigningKeyService(db).register('modula', {keyId, publicKeyPem: keys.publicKey.export({format: 'pem', type: 'spki'}).toString()}, null)
    const built = buildRelease(nextId(), '1.0.0', {sign: {keyId, privateKey: keys.privateKey}})
    const result = await new GreenfieldGithubReleaseSyncService(db, built.source).sync({repository: REPOSITORY, releaseTag: built.tag, publish: true, dryRun: false})
    expect(result).toMatchObject({signed: true, releaseState: 'published'})
    const detail = await app.inject({method: 'GET', url: `/v1/registry/modules/${built.productId}`})
    expect(detail.json().data.registryTrust.signature).toMatchObject({state: 'verified', keyId})

    const releaseId = (result as {releaseId: string}).releaseId
    const descriptor = await app.inject({method: 'GET', url: `/v1/registry/releases/${releaseId}/descriptor?hostVersion=1.0.0&platform=ios`})
    expect(descriptor.statusCode, descriptor.body).toBe(200)
    expect(descriptor.json().data).toMatchObject({
      moduleId: built.productId,
      version: '1.0.0',
      releaseId,
      channel: 'stable',
      packageDigest: sha256(built.packageBytes),
      signature: {algorithm: 'Ed25519', keyId, signaturePayloadVersion: 1},
      trust: {verified: true, signatureState: 'verified', signerRevoked: false},
      moduleSdk: {min: '2.1.0'},
      productUiContract: '1.0.0',
    })
    const packageArtifact = descriptor.json().data.artifacts.find((artifact: any) => artifact.kind === 'module-package')
    expect(packageArtifact).toMatchObject({digest: sha256(built.packageBytes), size: built.packageBytes.length, immutable: true, requiredForOfflineLaunch: true, access: 'installation', download: {authorization: 'bearer', range: true}})
    expect(descriptor.json().data.artifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({kind: 'frontend', requiredForOfflineLaunch: true}),
      expect.objectContaining({kind: 'schema', requiredForOfflineLaunch: true}),
    ]))

    const account = await registerAccount(app, `distribution-${suffix}@example.com`, `dist${suffix}`, db)
    const plan = await app.inject({
      method: 'POST', url: `/v1/modules/${built.productId}/install-plan`,
      headers: {authorization: `Bearer ${account.token}`}, payload: {version: '1.0.0', platform: 'ios'},
    })
    expect(plan.statusCode, plan.body).toBe(200)
    expect(plan.json().data).toMatchObject({allowed: true, permissionReviewRequired: false})
    const installed = await app.inject({
      method: 'POST', url: `/v1/modules/${built.productId}/install`,
      headers: {authorization: `Bearer ${account.token}`, 'idempotency-key': `distribution-install-${suffix}`},
      payload: {version: '1.0.0', approvedPermissions: [], platform: 'ios'},
    })
    expect(installed.statusCode, installed.body).toBe(202)
    expect(installed.json().data).toMatchObject({distributionReady: true, installationDescriptor: {moduleId: built.productId, currentRelease: {releaseId}}})

    const installationDescriptor = await app.inject({method: 'GET', url: `/v1/modules/${built.productId}/installation-descriptor`, headers: {authorization: `Bearer ${account.token}`}})
    expect(installationDescriptor.statusCode, installationDescriptor.body).toBe(200)
    const descriptorEtag = installationDescriptor.headers.etag!
    const unchanged = await app.inject({method: 'GET', url: `/v1/modules/${built.productId}/installation-descriptor`, headers: {authorization: `Bearer ${account.token}`, 'if-none-match': descriptorEtag}})
    expect(unchanged.statusCode).toBe(304)
    const weakUnchanged = await app.inject({method: 'GET', url: `/v1/modules/${built.productId}/installation-descriptor`, headers: {authorization: `Bearer ${account.token}`, 'if-none-match': `W/${descriptorEtag}`}})
    expect(weakUnchanged.statusCode).toBe(304)

    const beta = buildRelease(built.productId, '1.1.0-beta.1', {
      sign: {keyId, privateKey: keys.privateKey},
      mutateProduct: (mps, frontend) => {
        mps.release = {...mps.release, channel: 'beta'}
        frontend.capabilities = {optional: [{id: 'ui.graph', version: '1', fallback: {id: 'ui.list', version: '1'}}]}
      },
      manifestOverrides: {permissions: [{permission: 'search:index', risk: 'medium', reason: 'Synthetic permission delta'}] as any},
    })
    await new GreenfieldGithubReleaseSyncService(db, beta.source).sync({repository: REPOSITORY, releaseTag: beta.tag, publish: true, dryRun: false})
    const stablePlan = await app.inject({
      method: 'POST', url: `/v1/modules/${built.productId}/update-plan`,
      headers: {authorization: `Bearer ${account.token}`}, payload: {platform: 'ios', hostCapabilities: []},
    })
    expect(stablePlan.statusCode, stablePlan.body).toBe(200)
    expect(stablePlan.json().data).toMatchObject({targetRelease: null, blockers: [{code: 'TARGET_NOT_FOUND'}]})
    const betaPlan = await app.inject({
      method: 'POST', url: `/v1/modules/${built.productId}/update-plan`,
      headers: {authorization: `Bearer ${account.token}`},
      payload: {version: '1.1.0-beta.1', platform: 'ios', hostCapabilities: []},
    })
    expect(betaPlan.statusCode, betaPlan.body).toBe(200)
    expect(betaPlan.json().data).toMatchObject({
      targetRelease: {version: '1.1.0-beta.1', channel: 'beta'},
      compatibility: {compatible: true},
      permissionDelta: {added: ['search:index'], removed: [], reviewRequired: true},
      permissionReviewRequired: true,
    })
    expect(betaPlan.json().data.blockers).toEqual(expect.arrayContaining([expect.objectContaining({code: 'PERMISSION_REVIEW_REQUIRED'})]))
    const installationId = installed.json().data.installationId
    const followBeta = await app.inject({
      method: 'PATCH', url: `/v1/modules/installations/${installationId}/update-policy`,
      headers: {authorization: `Bearer ${account.token}`}, payload: {mode: 'followChannel', channel: 'beta'},
    })
    expect(followBeta.statusCode, followBeta.body).toBe(200)
    const followedPlan = await app.inject({
      method: 'POST', url: `/v1/modules/${built.productId}/update-plan`,
      headers: {authorization: `Bearer ${account.token}`}, payload: {platform: 'ios', hostCapabilities: []},
    })
    expect(followedPlan.json().data.targetRelease.version).toBe('1.1.0-beta.1')
    const lock = await app.inject({
      method: 'PATCH', url: `/v1/modules/installations/${installationId}/update-policy`,
      headers: {authorization: `Bearer ${account.token}`}, payload: {mode: 'lockedVersion', lockedVersion: '1.0.0'},
    })
    expect(lock.statusCode, lock.body).toBe(200)
    const lockedPlan = await app.inject({
      method: 'POST', url: `/v1/modules/${built.productId}/update-plan`,
      headers: {authorization: `Bearer ${account.token}`}, payload: {platform: 'ios', hostCapabilities: []},
    })
    expect(lockedPlan.json().data.targetRelease).toBeNull()

    await app.inject({
      method: 'PATCH', url: `/v1/modules/installations/${installationId}/update-policy`,
      headers: {authorization: `Bearer ${account.token}`}, payload: {mode: 'automaticStable'},
    })
    const future = buildRelease(built.productId, '2.0.0', {
      sign: {keyId, privateKey: keys.privateKey},
      mutateProduct: (_mps, frontend) => { frontend.capabilities = {required: ['ui.graph@1']} },
    })
    const futureResult = await new GreenfieldGithubReleaseSyncService(db, future.source).sync({repository: REPOSITORY, releaseTag: future.tag, publish: true, dryRun: false})
    const incompatible = await app.inject({
      method: 'POST', url: `/v1/modules/${built.productId}/update-plan`,
      headers: {authorization: `Bearer ${account.token}`}, payload: {platform: 'ios', hostCapabilities: []},
    })
    expect(incompatible.statusCode, incompatible.body).toBe(200)
    expect(incompatible.json().data).toMatchObject({
      targetRelease: {version: '2.0.0', channel: 'stable'},
      allowed: false,
      compatibility: {compatible: false, reasons: [expect.objectContaining({code: 'CAPABILITY_UNAVAILABLE', capability: 'ui.graph', required: '1'})]},
    })
    const hub = await app.inject({method: 'GET', url: '/v1/registry/products?productKind=all&limit=100'})
    const hubItem = hub.json().data.items.find((item: any) => item.moduleId === built.productId)
    expect(hubItem).toMatchObject({latestVersion: '2.0.0', releaseChannel: 'stable', releaseSizeBytes: future.packageBytes.length})
    const futureReleaseId = (futureResult as {releaseId: string}).releaseId
    const futureDescriptor = await app.inject({method: 'GET', url: `/v1/registry/releases/${futureReleaseId}/descriptor`})
    const futurePackage = futureDescriptor.json().data.artifacts.find((artifact: any) => artifact.kind === 'module-package')
    await new GreenfieldModuleReleaseService(db).revokeRelease(futureReleaseId, 'synthetic failed rollout')
    const revokedDescriptor = await app.inject({method: 'GET', url: `/v1/registry/releases/${futureReleaseId}/descriptor`})
    expect(revokedDescriptor.statusCode, revokedDescriptor.body).toBe(200)
    expect(revokedDescriptor.json().data).toMatchObject({revoked: true, trust: {verified: false}})
    const afterReleaseRevocation = await app.inject({
      method: 'POST', url: `/v1/modules/${built.productId}/update-plan`,
      headers: {authorization: `Bearer ${account.token}`}, payload: {platform: 'ios', hostCapabilities: []},
    })
    expect(afterReleaseRevocation.json().data).toMatchObject({targetRelease: null, blockers: [{code: 'TARGET_NOT_FOUND'}]})
    const hubAfterRevocation = await app.inject({method: 'GET', url: '/v1/registry/products?productKind=all&limit=100'})
    expect(hubAfterRevocation.json().data.items.find((item: any) => item.moduleId === built.productId))
      .toMatchObject({latestVersion: '1.0.0', releaseChannel: 'stable'})
    const revokedArtifact = await app.inject({
      method: 'GET', url: new URL(futurePackage.download.pathOrUrl).pathname,
      headers: {authorization: `Bearer ${account.token}`},
    })
    expect(revokedArtifact.statusCode).toBe(404)

    const anonymous = await app.inject({method: 'GET', url: new URL(packageArtifact.download.pathOrUrl).pathname})
    expect(anonymous.statusCode).toBe(404)
    const firstChunk = await app.inject({
      method: 'GET', url: new URL(packageArtifact.download.pathOrUrl).pathname,
      headers: {authorization: `Bearer ${account.token}`, range: 'bytes=0-99'},
    })
    expect(firstChunk.statusCode, firstChunk.body).toBe(206)
    expect(firstChunk.headers).toMatchObject({
      'accept-ranges': 'bytes',
      'content-range': `bytes 0-99/${built.packageBytes.length}`,
      'content-length': '100',
      etag: `"sha256-${sha256(built.packageBytes)}"`,
    })
    expect(firstChunk.rawPayload).toEqual(built.packageBytes.subarray(0, 100))
    const weakArtifactNotModified = await app.inject({
      method: 'GET', url: new URL(packageArtifact.download.pathOrUrl).pathname,
      headers: {authorization: `Bearer ${account.token}`, 'if-none-match': `W/${firstChunk.headers.etag}`},
    })
    expect(weakArtifactNotModified.statusCode).toBe(304)
    const rest = await app.inject({
      method: 'GET', url: new URL(packageArtifact.download.pathOrUrl).pathname,
      headers: {authorization: `Bearer ${account.token}`, range: 'bytes=100-'},
    })
    expect(rest.statusCode).toBe(206)
    expect(sha256(Buffer.concat([firstChunk.rawPayload, rest.rawPayload]))).toBe(packageArtifact.digest)
    const legacyDownload = await app.inject({
      method: 'GET', url: `/v1/registry/releases/${encodeURIComponent(releaseId)}/artifact`,
      headers: {authorization: `Bearer ${account.token}`, range: 'bytes=0-9'},
    })
    expect(legacyDownload.statusCode).toBe(206)
    expect(legacyDownload.headers.deprecation).toBe('true')
    expect(legacyDownload.rawPayload).toEqual(built.packageBytes.subarray(0, 10))
    const foreign = await registerAccount(app, `distribution-foreign-${suffix}@example.com`, `distx${suffix}`, db)
    const foreignArtifact = await app.inject({
      method: 'GET', url: new URL(packageArtifact.download.pathOrUrl).pathname,
      headers: {authorization: `Bearer ${foreign.token}`},
    })
    expect(foreignArtifact.statusCode).toBe(404)
    const corrupted = Buffer.from(built.packageBytes)
    corrupted[0] = corrupted[0]! ^ 0xff
    expect(sha256(corrupted)).not.toBe(packageArtifact.digest)

    await expect(db.updateTable('greenfield_module_releases').set({release_channel: 'beta'}).where('release_id', '=', releaseId).execute())
      .rejects.toThrow(/published release facts are immutable/)
    await expect(db.deleteFrom('greenfield_module_releases').where('release_id', '=', releaseId).execute())
      .rejects.toThrow(/published releases are immutable/)

    await new GreenfieldPublisherSigningKeyService(db).revoke('modula', keyId, 'synthetic signer revocation', null)
    const afterRevocation = await app.inject({
      method: 'GET', url: `/v1/modules/${built.productId}/installation-descriptor`,
      headers: {authorization: `Bearer ${account.token}`, 'if-none-match': descriptorEtag},
    })
    expect(afterRevocation.statusCode, afterRevocation.body).toBe(200)
    expect(afterRevocation.json().data).toMatchObject({
      launchEligible: false,
      currentRelease: {trust: {verified: false, signerRevoked: true, signatureState: 'revokedKey'}},
    })
    expect(afterRevocation.headers.etag).not.toBe(descriptorEtag)
    const feed = await app.inject({method: 'GET', url: '/v1/modules/updates', headers: {authorization: `Bearer ${account.token}`}})
    expect(feed.statusCode, feed.body).toBe(200)
    expect(feed.json().data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        moduleId: built.productId,
        descriptorRevision: afterRevocation.json().data.descriptorRevision,
        currentTrust: {verified: false, signerRevoked: true, releaseRevoked: false},
      }),
    ]))
    const weakFeedUnchanged = await app.inject({
      method: 'GET', url: '/v1/modules/updates',
      headers: {authorization: `Bearer ${account.token}`, 'if-none-match': `W/${feed.headers.etag}`},
    })
    expect(weakFeedUnchanged.statusCode).toBe(304)
    const afterRevocationDownload = await app.inject({
      method: 'GET', url: new URL(packageArtifact.download.pathOrUrl).pathname,
      headers: {authorization: `Bearer ${account.token}`},
    })
    expect(afterRevocationDownload.statusCode).toBe(404)
  })

  it('plans and installs a signed content-only module package with entitlement and tamper gates', async () => {
    const keys = generateKeyPairSync('ed25519')
    const keyId = `module-package-${suffix}`
    await new GreenfieldPublisherSigningKeyService(db).register(
      'modula',
      {keyId, publicKeyPem: keys.publicKey.export({format: 'pem', type: 'spki'}).toString()},
      null,
    )
    const moduleId = nextId()
    const content = Buffer.from('{"schemaVersion":"1.0.0","views":[]}')
    const inventory = Buffer.from(JSON.stringify({
      schema: 'modula.package-files.1',
      files: {'frontend/frontend.manifest.json': sha256(content)},
    }))
    const packageBytes = gzipSync(Buffer.concat([
      tarEntry('frontend/frontend.manifest.json', content),
      tarEntry('package.files.json', inventory),
      Buffer.alloc(1024),
    ]))
    const packagePath = 'distribution/module-content.tgz'
    const built = buildRelease(moduleId, '1.0.0', {
      sign: {keyId, privateKey: keys.privateKey},
      mutateProduct: mps => {
        mps.distribution = {
          schema: 'modula.package.1', category: 'module',
          artifact: {
            path: packagePath, sha256: sha256(packageBytes), mediaType: 'application/gzip',
            compressedSizeBytes: packageBytes.length, installedSizeEstimateBytes: content.length,
          },
          minimumHostVersion: '>=1.0.0', platforms: ['ios'], dependencies: [], requiredCapabilities: [],
          cachePolicy: 'retain-while-owned', sharing: 'public-immutable',
        }
      },
      mutateFiles: files => { files[packagePath] = packageBytes },
    })
    const synced = await new GreenfieldGithubReleaseSyncService(db, built.source).sync({
      repository: REPOSITORY, releaseTag: built.tag, publish: true, dryRun: false,
    })
    expect(synced).toMatchObject({signed: true, releaseState: 'published'})

    const owner = await registerAccount(app, `module-package-${suffix}@example.invalid`, `pkg${suffix}`, db)
    const other = await registerAccount(app, `module-package-other-${suffix}@example.invalid`, `pkgx${suffix}`, db)
    const headers = {authorization: `Bearer ${owner.token}`}
    const path = `/v1/modules/${moduleId}/package-install-plan`
    const payload = {version: '1.0.0', hostVersion: '1.1.0', platform: 'ios', cachedPublicDigests: []}

    expect((await app.inject({method: 'POST', url: path, payload})).statusCode).toBe(401)
    const unknown = await app.inject({method: 'POST', url: path, headers, payload: {...payload, accountId: owner.accountId}})
    expect(unknown.statusCode, unknown.body).toBe(400)
    expect(unknown.json().error.code).toBe('VALIDATION_FAILED')
    const invalidDigest = await app.inject({method: 'POST', url: path, headers, payload: {...payload, cachedPublicDigests: ['not-a-digest']}})
    expect(invalidDigest.statusCode, invalidDigest.body).toBe(400)

    const initialPlan = await app.inject({method: 'POST', url: path, headers, payload})
    expect(initialPlan.statusCode, initialPlan.body).toBe(200)
    expect(initialPlan.headers['cache-control']).toBe('private, no-store')
    expect(initialPlan.json().data).toMatchObject({
      lock: {
        schemaVersion: 'modula.package-lock.1', requested: [moduleId],
        packages: [expect.objectContaining({
          packageId: moduleId, version: '1.0.0', category: 'module',
          artifact: expect.objectContaining({sha256: sha256(packageBytes), compressedSizeBytes: packageBytes.length}),
          trust: {verified: true, publisherVerified: true, revoked: false},
          signature: expect.objectContaining({algorithm: 'Ed25519', keyId}),
        })],
        newDownloadBytes: packageBytes.length,
      },
      lockSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    const cached = await app.inject({
      method: 'POST', url: path, headers,
      payload: {...payload, cachedPublicDigests: [sha256(packageBytes)]},
    })
    expect(cached.statusCode, cached.body).toBe(200)
    expect(cached.json().data.lock).toMatchObject({newDownloadBytes: 0, reusedArtifactDigests: [sha256(packageBytes)]})

    const now = new Date()
    const offerId = `offer:${moduleId}`
    await db.insertInto('greenfield_offers').values({
      offer_id: offerId, product_id: moduleId, kind: 'ONE_TIME', display_name: 'QA module package',
      capabilities: sql`${JSON.stringify([])}::jsonb`, commercial_terms: sql`${JSON.stringify({})}::jsonb`,
      trial_duration_seconds: null, state: 'ACTIVE', created_by_account_id: owner.accountId,
      created_at: now, updated_at: now,
    }).execute()
    const unownedPlan = await app.inject({
      method: 'POST', url: path, headers: {authorization: `Bearer ${other.token}`}, payload,
    })
    expect(unownedPlan.statusCode, unownedPlan.body).toBe(403)
    const unownedInstall = await app.inject({
      method: 'POST', url: `/v1/modules/${moduleId}/install`,
      headers: {authorization: `Bearer ${other.token}`, 'idempotency-key': `unowned-module-package-${suffix}`},
      payload: {...payload, approvedPermissions: [], packageLockSha256: initialPlan.json().data.lockSha256},
    })
    expect(unownedInstall.statusCode, unownedInstall.body).toBe(403)

    await db.insertInto('greenfield_entitlements').values({
      entitlement_id: `entitlement:${moduleId}:${owner.accountId}`, owner_type: 'ACCOUNT',
      owner_account_id: owner.accountId, owner_organisation_id: null, product_id: moduleId, offer_id: offerId,
      source: 'ADMIN', state: 'ACTIVE', external_receipt_id: null, provenance_reference: 'isolated-package-plan-qa',
      started_at: now, expires_at: null, created_at: now, updated_at: now,
    }).execute()
    const entitledPlan = await app.inject({method: 'POST', url: path, headers, payload})
    expect(entitledPlan.statusCode, entitledPlan.body).toBe(200)
    expect(entitledPlan.json().data.lockSha256).toBe(initialPlan.json().data.lockSha256)

    const changedLock = await app.inject({
      method: 'POST', url: `/v1/modules/${moduleId}/install`,
      headers: {...headers, 'idempotency-key': `changed-module-package-${suffix}`},
      payload: {...payload, approvedPermissions: [], packageLockSha256: '0'.repeat(64)},
    })
    expect(changedLock.statusCode, changedLock.body).toBe(409)
    const installed = await app.inject({
      method: 'POST', url: `/v1/modules/${moduleId}/install`,
      headers: {...headers, 'idempotency-key': `module-package-install-${suffix}`},
      payload: {...payload, approvedPermissions: [], packageLockSha256: entitledPlan.json().data.lockSha256},
    })
    expect(installed.statusCode, installed.body).toBe(202)
    expect(installed.json().data).toMatchObject({
      status: 'installing', distributionReady: true,
      installationDescriptor: {moduleId, currentRelease: {version: '1.0.0'}},
    })
    const replay = await app.inject({
      method: 'POST', url: `/v1/modules/${moduleId}/install`,
      headers: {...headers, 'idempotency-key': `module-package-install-${suffix}`},
      payload: {...payload, approvedPermissions: [], packageLockSha256: entitledPlan.json().data.lockSha256},
    })
    expect(replay.statusCode, replay.body).toBe(202)
    expect(replay.json().data.installationId).toBe(installed.json().data.installationId)

    const downloadRef = entitledPlan.json().data.lock.packages[0].artifact.download.pathOrUrl
    const download = await app.inject({method: 'GET', url: new URL(downloadRef, 'https://qa.invalid').pathname})
    expect(download.statusCode, download.body).toBe(200)
    expect(sha256(download.rawPayload)).toBe(sha256(packageBytes))
    const corrupted = Buffer.from(packageBytes)
    corrupted[0] = corrupted[0]! ^ 0xff
    await expect(db.insertInto('greenfield_release_asset_blobs').values({
      sha256: 'f'.repeat(64), media_type: 'application/gzip', byte_size: corrupted.length,
      bytes: corrupted, created_at: now,
    } as never).execute()).rejects.toThrow()
  }, 120_000)

  it('projects a signed external game through governed GUBIC discovery, entitlement and publisher isolation', async () => {
    const owner = await registerAccount(app, `gubic-owner-${suffix}@example.invalid`, `gubicowner${suffix}`, db)
    const intruder = await registerAccount(app, `gubic-intruder-${suffix}@example.invalid`, `gubicintruder${suffix}`, db)
    const admin = await registerAccount(app, `gubic-admin-${suffix}@example.invalid`, `gubicadmin${suffix}`, db)
    const publisherId = `indie-${suffix}`
    const namespace = `games.${suffix}`
    const gameId = `${namespace}.asteroid-run`
    const now = new Date()
    await db.insertInto('greenfield_publishers').values({
      publisher_id: publisherId, display_name: 'Independent Test Studio', website: 'https://example.invalid',
      status: 'verified', trust_level: 'verifiedPublisher', created_at: now, updated_at: now,
      verified_at: now, suspended_at: null, revoked_at: null,
    }).execute()
    await db.insertInto('greenfield_publisher_owners').values({
      publisher_owner_id: randomUUID(), publisher_id: publisherId, owner_type: 'ACCOUNT',
      account_id: owner.accountId, organisation_id: null, created_at: now,
    }).execute()
    await db.insertInto('greenfield_publisher_namespaces').values({
      namespace, publisher_id: publisherId, verification_method: 'operatorReview',
      verification_evidence: {test: 'gubic-external-publisher'}, verified_at: now, revoked_at: null, created_at: now,
    }).execute()

    const keys = generateKeyPairSync('ed25519')
    const keyId = `gubic-${suffix}`
    await new GreenfieldPublisherSigningKeyService(db).register(
      publisherId,
      {keyId, publicKeyPem: keys.publicKey.export({format: 'pem', type: 'spki'}).toString()},
      owner.accountId,
    )
    const html = Buffer.from('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; connect-src \'none\'">')
    const javascript = Buffer.from('document.title="Asteroid Run"')
    const inventory = Buffer.from(JSON.stringify({schema: 'modula.game-files.1', files: {'index.html': sha256(html), 'main.js': sha256(javascript)}}))
    const gameBytes = gzipSync(Buffer.concat([
      tarEntry('index.html', html), tarEntry('main.js', javascript), tarEntry('game.files.json', inventory), Buffer.alloc(1024),
    ]))
    const built = buildRelease(gameId, '1.0.0', {
      sign: {keyId, privateKey: keys.privateKey},
      legacy: {id: gameId, moduleVersion: '1.0.0', publisher: {id: publisherId}},
      manifestOverrides: {
        publisher: {publisherId, displayName: 'Independent Test Studio', website: 'https://example.invalid'},
        trust: {requestedLevel: 'verifiedPublisher'},
        license: {status: 'verified', spdx: 'MIT', evidenceIds: ['LICENSE']},
      },
      mutateProduct: (mps) => {
        mps.identity.kind = 'game'
        mps.publisher = {id: publisherId, displayName: 'Independent Test Studio'}
        mps.permissions = []
        mps.gameRuntime = {
          contractVersion: '1.0.0', type: 'web-mini-game', engine: 'phaser', engineVersion: '4.2.1',
          entryPath: 'index.html', artifact: {path: 'game/game.tgz', sha256: sha256(gameBytes), mediaType: 'application/vnd.modula.game-web+tgz'},
          compressedSizeLimitBytes: 50 * 1024 * 1024, minimumHostVersion: '>=1.1.0', offline: true,
          network: 'none', assetInventory: 'game.files.json', orientation: 'any', graphics: 'none', touchControls: 'pointer',
        }
        mps.distribution = {
          schema: 'modula.package.1', category: 'game-content',
          artifact: {path: 'game/game.tgz', sha256: sha256(gameBytes), mediaType: 'application/vnd.modula.game-web+tgz', compressedSizeBytes: gameBytes.length, installedSizeEstimateBytes: 4096},
          minimumHostVersion: '>=1.1.0', platforms: ['ios'], dependencies: [], requiredCapabilities: [],
          cachePolicy: 'retain-while-owned', sharing: 'public-immutable',
        }
      },
      mutateFiles: files => { files['game/game.tgz'] = gameBytes },
    })
    const synced = await new GreenfieldGithubReleaseSyncService(db, built.source).sync({
      repository: REPOSITORY, releaseTag: built.tag, publish: true, dryRun: false,
    })
    expect(synced).toMatchObject({signed: true, releaseState: 'published'})

    const headers = {authorization: `Bearer ${owner.token}`}
    const register = await app.inject({
      method: 'PUT', url: `/v1/developer/gubic/games/${gameId}`, headers,
      payload: {publisherId, origin: 'independent-publisher', genre: 'arcade', categories: ['arcade', 'action'], runtimeCategory: 'html5-javascript', ageClassification: {system: 'IARC', rating: '3+'}, availability: 'available'},
    })
    expect(register.statusCode, register.body).toBe(200)
    expect(register.json().data).toMatchObject({game_id: gameId, publication_status: 'draft'})

    const unauthorized = await app.inject({
      method: 'PUT', url: `/v1/developer/gubic/games/${gameId}`,
      headers: {authorization: `Bearer ${intruder.token}`},
      payload: {publisherId, origin: 'commercial-publisher', genre: 'arcade', categories: ['arcade'], runtimeCategory: 'html5-javascript', ageClassification: {}},
    })
    expect(unauthorized.statusCode, unauthorized.body).toBe(403)
    expect((await app.inject({method: 'GET', url: `/v1/gubic/games?q=${encodeURIComponent(gameId)}`})).json().data.items).toEqual([])
    const draftInstall = await app.inject({
      method: 'POST', url: `/v1/modules/${gameId}/install`, headers: {...headers, 'idempotency-key': `draft-${suffix}`},
      payload: {version: '1.0.0', approvedPermissions: [], platform: 'ios'},
    })
    expect(draftInstall.statusCode, draftInstall.body).toBe(403)

    const review = await app.inject({
      method: 'POST', url: `/v1/admin/gubic/games/${gameId}/review`,
      headers: {authorization: `Bearer ${admin.token}`},
      payload: {publicationStatus: 'published', availability: 'available', featured: true, featuredRank: 1, reason: 'Synthetic isolated QA acceptance'},
    })
    expect(review.statusCode, review.body).toBe(200)
    expect(review.json().data).toMatchObject({publication_status: 'published', featured: true})
    const games = await app.inject({method: 'GET', url: `/v1/gubic/games?q=${encodeURIComponent(gameId)}&genre=arcade&category=action`})
    expect(games.statusCode, games.body).toBe(200)
    expect(games.json().data.items[0]).toMatchObject({
      gameId, title: expect.any(String), origin: 'independent-publisher', genre: 'arcade',
      publisher: {publisherId, verified: true}, runtime: {category: 'html5-javascript'},
      sizes: {installedSizeEstimateBytes: 4096, nativeCacheBytes: null}, publicationStatus: 'published', featured: true,
    })
    expect((await app.inject({method: 'GET', url: '/v1/gubic/featured'})).json().data.items)
      .toEqual(expect.arrayContaining([expect.objectContaining({gameId})]))
    const categories = (await app.inject({method: 'GET', url: '/v1/gubic/categories'})).json().data.items
    expect(categories.find((item: {category: string}) => item.category === 'action')?.gameCount).toBeGreaterThanOrEqual(1)
    expect((await app.inject({method: 'GET', url: `/v1/gubic/publishers/${publisherId}`})).json().data).toMatchObject({publisherId, verified: true})

    const comingSoon = await app.inject({
      method: 'POST', url: `/v1/admin/gubic/games/${gameId}/review`,
      headers: {authorization: `Bearer ${admin.token}`},
      payload: {publicationStatus: 'published', availability: 'coming-soon', featured: false, reason: 'Availability isolation proof'},
    })
    expect(comingSoon.statusCode, comingSoon.body).toBe(200)
    expect((await app.inject({method: 'GET', url: `/v1/gubic/games?q=${encodeURIComponent(gameId)}`})).json().data.items[0])
      .toMatchObject({gameId, availability: 'coming-soon'})
    const unavailableEligibility = await app.inject({method: 'GET', url: `/v1/gubic/games/${gameId}/eligibility?hostVersion=1.1.0&platform=ios`, headers})
    expect(unavailableEligibility.json().data).toMatchObject({eligible: false, reasonCode: 'NOT_AVAILABLE'})
    const comingSoonInstall = await app.inject({
      method: 'POST', url: `/v1/modules/${gameId}/install`, headers: {...headers, 'idempotency-key': `coming-soon-${suffix}`},
      payload: {version: '1.0.0', approvedPermissions: [], platform: 'ios'},
    })
    expect(comingSoonInstall.statusCode, comingSoonInstall.body).toBe(403)
    const restoreAvailable = await app.inject({
      method: 'POST', url: `/v1/admin/gubic/games/${gameId}/review`,
      headers: {authorization: `Bearer ${admin.token}`},
      payload: {publicationStatus: 'published', availability: 'available', featured: true, featuredRank: 1, reason: 'Resume entitlement acceptance'},
    })
    expect(restoreAvailable.statusCode, restoreAvailable.body).toBe(200)

    const offerId = `offer:${gameId}`
    await db.insertInto('greenfield_offers').values({
      offer_id: offerId, product_id: gameId, kind: 'ONE_TIME', display_name: 'Owned game',
      capabilities: sql`${JSON.stringify([])}::jsonb`, commercial_terms: sql`${JSON.stringify({})}::jsonb`,
      trial_duration_seconds: null, state: 'ACTIVE', created_by_account_id: admin.accountId,
      created_at: now, updated_at: now,
    }).execute()
    const ineligible = await app.inject({method: 'GET', url: `/v1/gubic/games/${gameId}/eligibility?hostVersion=1.1.0&platform=ios`, headers})
    expect(ineligible.json().data).toMatchObject({eligible: false, reasonCode: 'ENTITLEMENT_REQUIRED', entitlement: {required: true, owned: false}})
    const unownedInstall = await app.inject({
      method: 'POST', url: `/v1/modules/${gameId}/install`, headers: {...headers, 'idempotency-key': `unowned-${suffix}`},
      payload: {version: '1.0.0', approvedPermissions: [], platform: 'ios'},
    })
    expect(unownedInstall.statusCode, unownedInstall.body).toBe(403)
    await db.insertInto('greenfield_entitlements').values({
      entitlement_id: `entitlement:${gameId}:${owner.accountId}`, owner_type: 'ACCOUNT', owner_account_id: owner.accountId,
      owner_organisation_id: null, product_id: gameId, offer_id: offerId, source: 'ADMIN', state: 'ACTIVE',
      external_receipt_id: null, provenance_reference: 'isolated-gubic-qa', started_at: now, expires_at: null,
      created_at: now, updated_at: now,
    }).execute()
    const eligible = await app.inject({method: 'GET', url: `/v1/gubic/games/${gameId}/eligibility?hostVersion=1.1.0&platform=ios`, headers})
    expect(eligible.statusCode, eligible.body).toBe(200)
    expect(eligible.json().data).toMatchObject({eligible: true, reasonCode: 'ELIGIBLE', entitlement: {required: true, owned: true}, packagePlan: {lock: {packages: [expect.objectContaining({packageId: gameId})]}}})
    const ownedBeforeInstall = await app.inject({method: 'GET', url: '/v1/gubic/my-games?hostVersion=1.1.0&platform=ios', headers})
    expect(ownedBeforeInstall.statusCode, ownedBeforeInstall.body).toBe(200)
    expect(ownedBeforeInstall.json().data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({gameId, installation: null, eligibility: expect.objectContaining({eligible: true}), entitlement: expect.objectContaining({owned: true})}),
    ]))
    const plan = await app.inject({
      method: 'POST', url: `/v1/gubic/games/${gameId}/install-plan`, headers,
      payload: {hostVersion: '1.1.0', platform: 'ios', cachedPublicDigests: []},
    })
    expect(plan.statusCode, plan.body).toBe(200)
    const install = await app.inject({
      method: 'POST', url: `/v1/modules/${gameId}/install`, headers: {...headers, 'idempotency-key': `owned-${suffix}`},
      payload: {version: '1.0.0', approvedPermissions: [], platform: 'ios', hostVersion: '1.1.0', packageLockSha256: plan.json().data.lockSha256},
    })
    expect(install.statusCode, install.body).toBe(202)
    const mine = await app.inject({method: 'GET', url: '/v1/gubic/my-games?hostVersion=1.1.0&platform=ios', headers})
    expect(mine.statusCode, mine.body).toBe(200)
    expect(mine.json().data.items).toEqual(expect.arrayContaining([expect.objectContaining({gameId, nativeCacheBytes: null, entitlement: expect.objectContaining({owned: true})})]))

    const reject = await app.inject({
      method: 'POST', url: `/v1/admin/gubic/games/${gameId}/review`, headers: {authorization: `Bearer ${admin.token}`},
      payload: {publicationStatus: 'rejected', availability: 'unavailable', featured: false, reason: 'Synthetic rejection proof'},
    })
    expect(reject.statusCode, reject.body).toBe(200)
    expect((await app.inject({method: 'GET', url: `/v1/gubic/games?q=${encodeURIComponent(gameId)}`})).json().data.items).toEqual([])
    const rejectedInstall = await app.inject({
      method: 'POST', url: `/v1/modules/${gameId}/install`, headers: {...headers, 'idempotency-key': `rejected-${suffix}`},
      payload: {version: '1.0.0', approvedPermissions: [], platform: 'ios'},
    })
    expect(rejectedInstall.statusCode, rejectedInstall.body).toBe(403)

    const republish = await app.inject({
      method: 'POST', url: `/v1/admin/gubic/games/${gameId}/review`, headers: {authorization: `Bearer ${admin.token}`},
      payload: {publicationStatus: 'published', availability: 'available', featured: false, reason: 'Signer revocation acceptance setup'},
    })
    expect(republish.statusCode, republish.body).toBe(200)
    await new GreenfieldPublisherSigningKeyService(db).revoke(publisherId, keyId, 'Synthetic revoked-game proof', admin.accountId)
    expect((await app.inject({method: 'GET', url: `/v1/gubic/games?q=${encodeURIComponent(gameId)}`})).json().data.items).toEqual([])
    const revokedInstall = await app.inject({
      method: 'POST', url: `/v1/modules/${gameId}/install`, headers: {...headers, 'idempotency-key': `revoked-${suffix}`},
      payload: {version: '1.0.0', approvedPermissions: [], platform: 'ios'},
    })
    expect(revokedInstall.statusCode, revokedInstall.body).toBeGreaterThanOrEqual(400)
    await expect(db.updateTable('greenfield_game_catalogue_events').set({publication_status: 'published'}).where('game_id', '=', gameId).execute())
      .rejects.toThrow(/append-only/)
  }, 120_000)

  it('performs a governed rollback to the advertised trusted release', async () => {
    const keys = generateKeyPairSync('ed25519')
    const keyId = `rollback-${suffix}`
    await new GreenfieldPublisherSigningKeyService(db).register('modula', {keyId, publicKeyPem: keys.publicKey.export({format: 'pem', type: 'spki'}).toString()}, null)
    const moduleId = nextId()
    const first = buildRelease(moduleId, '1.0.0', {sign: {keyId, privateKey: keys.privateKey}})
    const second = buildRelease(moduleId, '1.1.0', {sign: {keyId, privateKey: keys.privateKey}})
    const firstResult = await new GreenfieldGithubReleaseSyncService(db, first.source).sync({repository: REPOSITORY, releaseTag: first.tag, publish: true, dryRun: false})
    const secondResult = await new GreenfieldGithubReleaseSyncService(db, second.source).sync({repository: REPOSITORY, releaseTag: second.tag, publish: true, dryRun: false})
    const account = await registerAccount(app, `rollback-${suffix}@example.com`, `rollback${suffix}`, db)
    const headers = {authorization: `Bearer ${account.token}`}
    const install = await app.inject({
      method: 'POST', url: `/v1/modules/${moduleId}/install`,
      headers: {...headers, 'idempotency-key': `rollback-install-${suffix}`},
      payload: {version: '1.0.0', approvedPermissions: [], platform: 'ios'},
    })
    expect(install.statusCode, install.body).toBe(202)
    const installationId = install.json().data.installationId
    const workerDb = createWorkerDb(databaseUrl!)
    try {
      await handleModuleInstall(workerDb, loadWorkerConfig(), {
        planId: install.json().data.planId,
        installationId,
        releaseId: (firstResult as {releaseId: string}).releaseId,
        moduleId,
        accountId: account.accountId,
      })
      const update = await app.inject({
        method: 'POST', url: `/v1/modules/${moduleId}/update`,
        headers: {...headers, 'idempotency-key': `rollback-forward-${suffix}`},
        payload: {version: '1.1.0', approvedPermissions: [], platform: 'ios'},
      })
      expect(update.statusCode, update.body).toBe(202)
      await handleModuleUpdate(workerDb, loadWorkerConfig(), {
        planId: update.json().data.planId,
        installationId,
        targetReleaseId: (secondResult as {releaseId: string}).releaseId,
        previousStatus: 'installedDisabled',
        moduleId,
        accountId: account.accountId,
      })
      const plan = await app.inject({method: 'POST', url: `/v1/modules/${moduleId}/update-plan`, headers, payload: {platform: 'ios'}})
      expect(plan.statusCode, plan.body).toBe(200)
      expect(plan.json().data).toMatchObject({
        currentRelease: {version: '1.1.0'},
        rollbackCandidateReleaseId: (firstResult as {releaseId: string}).releaseId,
      })
      const rollback = await app.inject({
        method: 'POST', url: `/v1/modules/${moduleId}/rollback`,
        headers: {...headers, 'idempotency-key': `rollback-back-${suffix}`},
        payload: {version: '1.0.0', expectedDescriptorRevision: plan.json().data.expectedDescriptorRevision, platform: 'ios'},
      })
      expect(rollback.statusCode, rollback.body).toBe(202)
      await handleModuleUpdate(workerDb, loadWorkerConfig(), {
        planId: rollback.json().data.planId,
        installationId,
        targetReleaseId: (firstResult as {releaseId: string}).releaseId,
        previousStatus: 'installedDisabled',
        moduleId,
        accountId: account.accountId,
      })
      const current = await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/installation-descriptor`, headers})
      expect(current.json().data.currentRelease.version).toBe('1.0.0')
    } finally {
      await workerDb.destroy()
    }
  })

  it.each([
    ['a package that does not match its checksum', {mutateProvenance: (p: Record<string, unknown>) => { p.packageChecksum = sha256('other') }}, /digest|checksum/],
    ['a tag that resolves to a different commit', {mutateProvenance: (p: Record<string, unknown>) => { p.releaseCommit = 'f'.repeat(40) }}, /resolves to/],
    ['an altered modula.product.json', {mutateProvenance: (p: Record<string, unknown>) => { p.productManifestChecksum = sha256('other') }}, /modula\.product\.json checksum/],
    ['a conflicting modula.module.json adapter', {legacy: {id: 'digital.modula.someone-else', moduleVersion: '1.0.0', publisher: {id: 'modula'}}}, /adapters conflict/],
    ['a package without modula.product.json', {mutateFiles: (f: Record<string, Buffer>) => { delete f['modula.product.json'] }, mutateProvenance: (p: Record<string, unknown>) => { delete p.productManifestChecksum }}, /no modula\.product\.json/],
  ])('rejects %s and records the failure', async (_label, options, pattern) => {
    const built = buildRelease(nextId(), '1.0.0', options as any)
    await expect(new GreenfieldGithubReleaseSyncService(db, built.source).sync({repository: REPOSITORY, releaseTag: built.tag, publish: true, dryRun: false})).rejects.toThrow(pattern)
    expect(await new GreenfieldModuleReleaseService(db).getRelease(built.productId, '1.0.0')).toBeUndefined()
    const failures = await db.selectFrom('greenfield_module_sync_failures').select(['message']).where('repository', '=', REPOSITORY).orderBy('created_at', 'desc').limit(1).execute()
    expect(failures[0]?.message).toMatch(pattern)
  })

  it('requires an authenticated admin for the sync route', async () => {
    const anonymous = await app.inject({method: 'POST', url: '/v1/admin/registry/sync', payload: {repository: REPOSITORY, releaseTag: 'x'}})
    expect(anonymous.statusCode).toBe(401)
    const user = await registerAccount(app, `sync-${suffix}@example.com`, `sync${suffix}`, db)
    const forbidden = await app.inject({method: 'POST', url: '/v1/admin/registry/sync', headers: {authorization: `Bearer ${user.token}`}, payload: {repository: REPOSITORY, releaseTag: 'x'}})
    expect(forbidden.statusCode).toBe(403)
  })

  // Signed test.modula.* web-game fixtures under the seeded `modula` publisher
  // (which owns the test.modula namespace). Keys are generated per test, in memory.
  async function testModulaGamePublisher(label: string) {
    const owner = await registerAccount(app, `gubic-${label}-owner-${suffix}@example.invalid`, `gubic${label}owner${suffix}`, db)
    await db.insertInto('greenfield_publisher_owners').values({
      publisher_owner_id: randomUUID(), publisher_id: 'modula', owner_type: 'ACCOUNT',
      account_id: owner.accountId, organisation_id: null, created_at: new Date(),
    }).execute()
    const keys = generateKeyPairSync('ed25519')
    const keyId = `gubic-${label}-${suffix}`
    await new GreenfieldPublisherSigningKeyService(db).register('modula', {keyId, publicKeyPem: keys.publicKey.export({format: 'pem', type: 'spki'}).toString()}, null)
    const html = Buffer.from('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; connect-src \'none\'; object-src \'none\'">')
    const sync = async (gameId: string, version: string, publish = true) => {
      const javascript = Buffer.from(`document.title="${gameId} ${version}"`)
      const inventory = Buffer.from(JSON.stringify({schema: 'modula.game-files.1', files: {'index.html': sha256(html), 'main.js': sha256(javascript)}}))
      const gameBytes = gzipSync(Buffer.concat([tarEntry('index.html', html), tarEntry('main.js', javascript), tarEntry('game.files.json', inventory), Buffer.alloc(1024)]))
      const built = buildRelease(gameId, version, {
        sign: {keyId, privateKey: keys.privateKey},
        mutateProduct: (mps) => {
          mps.identity.kind = 'game'
          mps.permissions = []
          mps.gameRuntime = {
            contractVersion: '1.0.0', type: 'web-mini-game', engine: 'phaser', engineVersion: '4.2.1',
            entryPath: 'index.html', artifact: {path: 'game/game.tgz', sha256: sha256(gameBytes), mediaType: 'application/vnd.modula.game-web+tgz'},
            compressedSizeLimitBytes: 50 * 1024 * 1024, minimumHostVersion: '>=1.1.0', offline: true,
            network: 'none', assetInventory: 'game.files.json', orientation: 'any', graphics: 'none', touchControls: 'pointer',
          }
          mps.distribution = {
            schema: 'modula.package.1', category: 'game-content',
            artifact: {path: 'game/game.tgz', sha256: sha256(gameBytes), mediaType: 'application/vnd.modula.game-web+tgz', compressedSizeBytes: gameBytes.length, installedSizeEstimateBytes: 4096},
            minimumHostVersion: '>=1.1.0', platforms: ['ios'], dependencies: [], requiredCapabilities: [],
            cachePolicy: 'retain-while-owned', sharing: 'public-immutable',
          }
        },
        mutateFiles: files => { files['game/game.tgz'] = gameBytes },
      })
      return await new GreenfieldGithubReleaseSyncService(db, built.source).sync({repository: REPOSITORY, releaseTag: built.tag, publish, dryRun: false}) as {releaseId: string}
    }
    const headers = {authorization: `Bearer ${owner.token}`}
    const register = async (gameId: string) => {
      const response = await app.inject({
        method: 'PUT', url: `/v1/developer/gubic/games/${gameId}`, headers,
        payload: {publisherId: 'modula', origin: 'modula-developed', genre: 'arcade', categories: ['arcade'], runtimeCategory: 'phaser', ageClassification: {}, availability: 'available'},
      })
      expect(response.statusCode, response.body).toBe(200)
    }
    return {owner, headers, sync, register}
  }

  it('publishes a catalogue game by direct registry lookup, including test-only games past the first 100 products', async () => {
    const fixtures = await testModulaGamePublisher('review')
    const admin = await registerAccount(app, `gubic-review-admin-${suffix}@example.invalid`, `gubicreview${suffix}`, db)
    const adminHeaders = {authorization: `Bearer ${admin.token}`}
    const namespace = `test.modula.gubic-review-${suffix}`
    // 100 published game products that sort before the target, so the target is product #101.
    for (let index = 0; index < 100; index += 1) await fixtures.sync(`${namespace}.a${String(index).padStart(3, '0')}`, '1.0.0')
    const target = `${namespace}.zz-target`
    await fixtures.sync(target, '1.0.0')
    await fixtures.sync(target, '1.1.0')
    const publishedGames = await db.selectFrom('greenfield_module_releases as release')
      .innerJoin('greenfield_mps_ingestions as ingestion', 'ingestion.release_id', 'release.release_id')
      .select(['release.module_id']).distinct()
      .where('ingestion.registry_kind', '=', 'game').where('release.release_state', '=', 'published')
      .where('release.module_id', '<', target).where('release.module_id', 'like', `${namespace}.%`)
      .execute()
    expect(publishedGames).toHaveLength(100)
    await fixtures.register(target)
    const review = (gameId: string, publicationStatus: string, availability = 'available') => app.inject({
      method: 'POST', url: `/v1/admin/gubic/games/${gameId}/review`, headers: adminHeaders,
      payload: {publicationStatus, availability, featured: false, reason: 'GUBIC catalogue lookup QA'},
    })
    const published = await review(target, 'published')
    expect(published.statusCode, published.body).toBe(200)
    expect(published.json().data).toMatchObject({game_id: target, publication_status: 'published', availability: 'available'})
    const event = await db.selectFrom('greenfield_game_catalogue_events').select(['event_type', 'publication_status'])
      .where('game_id', '=', target).orderBy('occurred_at', 'desc').executeTakeFirstOrThrow()
    expect(event).toEqual({event_type: 'published', publication_status: 'published'})

    // Still fail closed: a catalogue entry whose game has no published release cannot be published.
    const draftOnly = `${namespace}.draft-only`
    await fixtures.sync(draftOnly, '1.0.0', false)
    await fixtures.register(draftOnly)
    const refused = await review(draftOnly, 'published')
    expect(refused.statusCode, refused.body).toBe(403)
    expect(refused.json().error).toMatchObject({code: 'FORBIDDEN', message: 'A trusted published registry release owned by this publisher is required'})

    // ... nor one whose newest published release is quarantined out of the published set.
    const quarantined = `${namespace}.quarantined`
    const quarantinedRelease = await fixtures.sync(quarantined, '1.0.0')
    await fixtures.register(quarantined)
    await db.updateTable('greenfield_module_releases').set({release_state: 'quarantined'} as never)
      .where('release_id', '=', quarantinedRelease.releaseId).execute()
    expect((await review(quarantined, 'published')).statusCode).toBe(403)
    // Retiring does not need a trusted release.
    expect((await review(quarantined, 'retired', 'unavailable')).statusCode).toBe(200)
  }, 180_000)
})
