import {generateKeyPairSync, randomUUID, sign} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {gzipSync} from 'node:zlib'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {readTarGz} from '../src/lib/tar-gz.js'
import {GreenfieldGithubReleaseSyncService, verifyWebGameArchive, type GithubRelease, type GithubReleaseAsset, type GithubReleaseSource} from '../src/modules/github-release-sync-service.js'
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
})
