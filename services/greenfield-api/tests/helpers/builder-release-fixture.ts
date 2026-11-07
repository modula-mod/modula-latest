/**
 * BUILDER-01 isolated SENTINEL test fixture (tests only).
 *
 * Reserved identities: publisher `test.modula.builder-publisher`, module
 * `test.modula.builder-release`. Uses an in-memory fake GitHub release source
 * (no real GitHub release, no network), never touches
 * digital.modula.vault-notes, and its publication adapter records the call
 * instead of running the registry publish (no public catalogue write).
 */
import {generateKeyPairSync, randomInt, sign, type KeyObject} from 'node:crypto'
import {gzipSync} from 'node:zlib'
import type {GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import type {GithubRelease, GithubReleaseAsset, GithubReleaseListing, GithubReleaseSource} from '../../src/modules/github-release-sync-service.js'
import type {GreenfieldModuleReleaseRecord} from '../../src/modules/module-domain.js'
import {GreenfieldModuleReleaseService} from '../../src/modules/release-service.js'
import {moduleError} from '../../src/modules/module-errors.js'
import {buildPublisherReleaseStatement, statementBytes} from '../../src/modules/release-signing.js'
import type {ReleasePublisher} from '../../src/publisher/release-job-processor.js'
import {adapterManifest, fixtureProduct, sha256} from './registry-fixtures.js'

export const BUILDER_TEST_PUBLISHER_ID = 'test.modula.builder-publisher'
export const BUILDER_TEST_MODULE_ID = 'test.modula.builder-release'
export const BUILDER_TEST_NAMESPACE = 'test.modula'
export const BUILDER_TEST_REPOSITORY = 'modula-test/builder-release-fixture'
export const BUILDER_TEST_COMMIT = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'

if (BUILDER_TEST_MODULE_ID.includes('vault-notes')) throw new Error('fixture must not touch vault-notes')

/** Unique minor per test run so repeated runs against one disposable DB never collide on version. */
export const BUILDER_RUN_MINOR = randomInt(1, 1_000_000)

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

export type FixtureSigner = {keyId: string; privateKey: KeyObject}

export function newEd25519() {
  const keys = generateKeyPairSync('ed25519')
  return {privateKey: keys.privateKey, publicKeyPem: keys.publicKey.export({format: 'pem', type: 'spki'}).toString()}
}

type StoredRelease = {release: GithubRelease & {name: string | null; publishedAt: string | null}; bytes: Map<string, Buffer>}

/** In-memory GitHub: no network, no real tags. */
export class FixtureGithubSource implements GithubReleaseSource {
  readonly releases = new Map<string, StoredRelease>()
  downloads: string[] = []
  async getRelease(repository: string, tag: string): Promise<GithubRelease> {
    const stored = repository === BUILDER_TEST_REPOSITORY ? this.releases.get(tag) : undefined
    if (!stored) throw moduleError('NOT_FOUND', 'GitHub release or tag not found')
    return stored.release
  }
  async resolveTagCommit() { return BUILDER_TEST_COMMIT }
  async downloadAsset(asset: GithubReleaseAsset): Promise<Buffer> {
    this.downloads.push(asset.name)
    for (const stored of this.releases.values()) { const bytes = stored.bytes.get(asset.name); if (bytes) return bytes }
    throw new Error('asset not found')
  }
  async listReleases(repository: string): Promise<GithubReleaseListing[]> {
    if (repository !== BUILDER_TEST_REPOSITORY) return []
    return [...this.releases.values()].map(stored => stored.release)
  }
}

export type FixtureReleaseOptions = {
  /** Extra tag suffix: same version published under a second tag (concurrency tests). */
  tagSuffix?: string
  signer?: FixtureSigner | null
  /** Sign different facts than shipped (yields an invalid signature). */
  tamperSignedArtifact?: boolean
  permissions?: GreenfieldModuleManifest['permissions']
  manifestOverrides?: Partial<GreenfieldModuleManifest>
}

export function addFixtureRelease(source: FixtureGithubSource, patch: number, options: FixtureReleaseOptions = {}) {
  const version = `0.${BUILDER_RUN_MINOR}.${patch}`
  const tag = `${BUILDER_TEST_MODULE_ID}-v${version}${options.tagSuffix ?? ''}`
  const packageFile = `${BUILDER_TEST_MODULE_ID}-${version}${options.tagSuffix ?? ''}.tgz`
  const product = fixtureProduct(BUILDER_TEST_MODULE_ID, version, mps => {
    mps.source = {...(mps.source ?? {}), provider: 'github', repository: BUILDER_TEST_REPOSITORY}
    mps.publisher = {...(mps.publisher ?? {}), id: BUILDER_TEST_PUBLISHER_ID}
  })
  const base = adapterManifest(BUILDER_TEST_MODULE_ID, version)
  const manifest = adapterManifest(BUILDER_TEST_MODULE_ID, version, {
    publisher: {publisherId: BUILDER_TEST_PUBLISHER_ID, displayName: 'Builder Test Publisher'},
    source: {...base.source, repository: BUILDER_TEST_REPOSITORY, commit: BUILDER_TEST_COMMIT, releaseTag: tag, releaseAssetName: packageFile},
    license: {status: 'verified', evidenceIds: ['builder-release-fixture']},
    trust: {requestedLevel: 'verifiedPublisher'},
    permissions: options.permissions ?? [],
    ...options.manifestOverrides,
  } as Partial<GreenfieldModuleManifest>)
  const files: Record<string, Buffer> = {
    'modula.product.json': Buffer.from(product.mpsBytes),
    'module.manifest.json': Buffer.from(JSON.stringify(manifest, null, 2)),
    [product.frontend.path]: product.frontend.bytes,
  }
  for (const schema of product.schemas) files[schema.path] = schema.bytes
  for (const asset of product.assets) files[asset.path] = asset.bytes
  const packageBytes = tgz(files)
  const provenance: Record<string, unknown> = {
    productId: BUILDER_TEST_MODULE_ID, version, repository: BUILDER_TEST_REPOSITORY, releaseCommit: BUILDER_TEST_COMMIT, releaseTag: tag, packageFile,
    packageChecksum: sha256(packageBytes),
    productManifestChecksum: sha256(Buffer.from(product.mpsBytes)),
    greenfieldManifestChecksum: manifest.integrity.manifestSha256,
    frontendArtifact: product.frontend.path,
    frontendChecksum: sha256(product.frontend.bytes),
  }
  if (options.signer) {
    const statement = buildPublisherReleaseStatement({
      manifest, sourceSha: BUILDER_TEST_COMMIT,
      artifactSha256: options.tamperSignedArtifact ? 'f'.repeat(64) : sha256(packageBytes),
      productManifestSha256: sha256(Buffer.from(product.mpsBytes)), frontendSha256: sha256(product.frontend.bytes), signingKeyId: options.signer.keyId,
    })
    provenance.signature = {algorithm: 'Ed25519', keyId: options.signer.keyId, value: sign(null, statementBytes(statement), options.signer.privateKey).toString('base64url')}
  }
  const provenanceBytes = Buffer.from(JSON.stringify(provenance, null, 2))
  const assets: GithubReleaseAsset[] = [
    {name: packageFile, size: packageBytes.length, apiUrl: `https://api.github.com/assets/${packageFile}`, digest: `sha256:${sha256(packageBytes)}`},
    {name: `${tag}.provenance.json`, size: provenanceBytes.length, apiUrl: `https://api.github.com/assets/${tag}.provenance.json`, digest: `sha256:${sha256(provenanceBytes)}`},
  ]
  source.releases.set(tag, {
    release: {tagName: tag, draft: false, prerelease: false, assets, name: `Fixture ${version}`, publishedAt: new Date().toISOString()},
    bytes: new Map([[packageFile, packageBytes], [`${tag}.provenance.json`, provenanceBytes]]),
  })
  return {version, tag, packageSha256: sha256(packageBytes)}
}

/**
 * Publication adapter for the isolated fixture: records the call and reports
 * the registry release as published WITHOUT running publishRelease, so no
 * catalogue row is ever written by these tests.
 */
export function recordingPublisher(db: any): ReleasePublisher & {calls: Array<{moduleId: string; version: string}>} {
  const calls: Array<{moduleId: string; version: string}> = []
  const fn = (async (moduleId: string, version: string): Promise<GreenfieldModuleReleaseRecord> => {
    if (moduleId !== BUILDER_TEST_MODULE_ID) throw new Error('fixture publisher only accepts the reserved test module')
    calls.push({moduleId, version})
    const release = await new GreenfieldModuleReleaseService(db).getRelease(moduleId, version)
    return {...release!, releaseState: 'published', publishedAt: new Date()}
  }) as ReleasePublisher & {calls: typeof calls}
  fn.calls = calls
  return fn
}
