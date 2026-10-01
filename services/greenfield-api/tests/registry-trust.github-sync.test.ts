import {generateKeyPairSync, randomUUID, sign} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {gzipSync} from 'node:zlib'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {readTarGz} from '../src/lib/tar-gz.js'
import {GreenfieldGithubReleaseSyncService, type GithubRelease, type GithubReleaseAsset, type GithubReleaseSource} from '../src/modules/github-release-sync-service.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldPublisherSigningKeyService, buildPublisherReleaseStatement, statementBytes} from '../src/modules/release-signing.js'
import {adapterManifest, configureRegistryTestEnv, fixtureProduct, fixtureRoot, registerAccount, sha256} from './helpers/registry-fixtures.js'

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
  legacy?: Record<string, unknown> | null
  sign?: {keyId: string; privateKey: ReturnType<typeof generateKeyPairSync>['privateKey']}
} = {}): Built {
  const tag = `${productId}-v${version}`
  const packageFile = `${productId}-${version}.tgz`
  const product = fixtureProduct(productId, version, mps => {
    mps.source = {...(mps.source ?? {}), provider: 'github', repository: REPOSITORY}
    mps.publisher = {...(mps.publisher ?? {}), id: 'modula'}
  })
  const manifest = adapterManifest(productId, version)
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
    expect(artifact.statusCode, artifact.body).toBe(200)
    expect(sha256(artifact.rawPayload)).toBe(sha256(built.packageBytes))

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
