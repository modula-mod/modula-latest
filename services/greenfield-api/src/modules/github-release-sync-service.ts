import {createHash, randomUUID} from 'node:crypto'
import {ingestProductManifest} from '@modula/greenfield-product-standard'
import {manifestChecksum, type GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import type {ModulaDb} from '../database/client.js'
import {readTarGz, TarGzError, type TarEntries} from '../lib/tar-gz.js'
import {GreenfieldMpsIngestService, verifyPresentationAssetBytes} from '../product-standard/ingest-service.js'
import type {GreenfieldModuleReleaseRecord} from './module-domain.js'
import {moduleError} from './module-errors.js'
import {GreenfieldModuleManifestService} from './manifest-service.js'
import {GreenfieldModuleReleaseService, type GreenfieldModuleReleaseEvidence} from './release-service.js'

/**
 * Automated GitHub release ingestion. Given a repository and an immutable
 * release tag, the registry itself fetches the release package and its
 * provenance sidecar, verifies every digest and identity server-side, and only
 * then imports, verifies, (optionally) publishes and ingests the release.
 * Replaces the manual-checkout publish-mps-products.ts flow.
 */
export type GithubReleaseAsset = {name: string; size: number; apiUrl: string; digest: string | null}
export type GithubRelease = {tagName: string; draft: boolean; prerelease: boolean; assets: GithubReleaseAsset[]}

export interface GithubReleaseSource {
  getRelease(repository: string, tag: string): Promise<GithubRelease>
  resolveTagCommit(repository: string, tag: string): Promise<string>
  downloadAsset(asset: GithubReleaseAsset, maxBytes: number): Promise<Buffer>
}

export const GITHUB_SYNC_LIMITS = {
  maxPackageBytes: 50 * 1024 * 1024,
  maxUncompressedBytes: 200 * 1024 * 1024,
  maxProvenanceBytes: 256 * 1024,
  /** Every accepted package must be retained for immutable distribution. */
  maxStoredPackageBytes: 50 * 1024 * 1024,
}

const DOWNLOAD_HOSTS = new Set(['api.github.com', 'github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com', 'github-releases.githubusercontent.com'])

export class HttpGithubReleaseSource implements GithubReleaseSource {
  private readonly token: string | null
  private readonly fetchImpl: typeof fetch
  constructor(options: {token?: string | null; fetchImpl?: typeof fetch} = {}) {
    this.token = options.token?.trim() || null
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async getRelease(repository: string, tag: string): Promise<GithubRelease> {
    const body = await this.api(`/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`) as any
    return {
      tagName: String(body.tag_name ?? ''),
      draft: Boolean(body.draft),
      prerelease: Boolean(body.prerelease),
      assets: (Array.isArray(body.assets) ? body.assets : []).map((asset: any) => ({
        name: String(asset.name ?? ''),
        size: Number(asset.size ?? 0),
        apiUrl: String(asset.url ?? ''),
        digest: typeof asset.digest === 'string' ? asset.digest : null,
      })),
    }
  }

  async resolveTagCommit(repository: string, tag: string): Promise<string> {
    let object = ((await this.api(`/repos/${repository}/git/ref/tags/${encodeURIComponent(tag)}`)) as any).object
    for (let depth = 0; depth < 5 && object?.type === 'tag'; depth += 1) {
      object = ((await this.api(`/repos/${repository}/git/tags/${object.sha}`)) as any).object
    }
    if (object?.type !== 'commit' || typeof object.sha !== 'string') throw moduleError('VALIDATION_FAILED', `Tag ${tag} does not resolve to a commit`)
    return object.sha
  }

  async downloadAsset(asset: GithubReleaseAsset, maxBytes: number): Promise<Buffer> {
    if (asset.size > maxBytes) throw moduleError('VALIDATION_FAILED', `Release asset ${asset.name} exceeds ${maxBytes} bytes`)
    let url = asset.apiUrl
    for (let hop = 0; hop < 5; hop += 1) {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' || !DOWNLOAD_HOSTS.has(parsed.hostname)) throw moduleError('VALIDATION_FAILED', `Refusing to download release asset from ${parsed.hostname}`)
      const headers: Record<string, string> = {accept: 'application/octet-stream', 'user-agent': 'modula-registry-sync'}
      // Credentials go to the GitHub API only, never to redirected CDN hosts.
      if (this.token && parsed.hostname === 'api.github.com') headers.authorization = `Bearer ${this.token}`
      const response = await this.fetchImpl(url, {headers, redirect: 'manual'})
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) throw moduleError('VALIDATION_FAILED', 'Release asset redirect has no location')
        url = new URL(location, url).toString()
        continue
      }
      if (!response.ok) throw moduleError('NOT_FOUND', `Release asset ${asset.name} download failed (${response.status})`)
      const declared = Number(response.headers.get('content-length') ?? 0)
      if (declared > maxBytes) throw moduleError('VALIDATION_FAILED', `Release asset ${asset.name} exceeds ${maxBytes} bytes`)
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length > maxBytes) throw moduleError('VALIDATION_FAILED', `Release asset ${asset.name} exceeds ${maxBytes} bytes`)
      return bytes
    }
    throw moduleError('VALIDATION_FAILED', 'Too many redirects downloading release asset')
  }

  private async api(path: string): Promise<unknown> {
    const headers: Record<string, string> = {accept: 'application/vnd.github+json', 'user-agent': 'modula-registry-sync', 'x-github-api-version': '2022-11-28'}
    if (this.token) headers.authorization = `Bearer ${this.token}`
    const response = await this.fetchImpl(`https://api.github.com${path}`, {headers})
    if (response.status === 404) throw moduleError('NOT_FOUND', 'GitHub release or tag not found')
    if (!response.ok) throw moduleError('VALIDATION_FAILED', `GitHub API request failed (${response.status})`)
    return response.json()
  }
}

export type GithubSyncRequest = {repository: string; releaseTag: string; publish?: boolean; dryRun?: boolean}

export type VerifiedGithubRelease = {
  productId: string
  version: string
  repository: string
  releaseTag: string
  releaseCommit: string
  packageFile: string
  packageSha256: string
  packageBytes: Buffer
  mpsBytes: Buffer
  manifest: GreenfieldModuleManifest
  frontend: {path: string; bytes: Buffer} | null
  schemas: Array<{path: string; bytes: Buffer}>
  assets: Array<{path: string; bytes: Buffer}>
  evidence: GreenfieldModuleReleaseEvidence
  checks: string[]
}

export class GreenfieldGithubReleaseSyncService {
  constructor(private readonly db: ModulaDb, private readonly source: GithubReleaseSource) {}

  /** Fetches and verifies a release without touching the database. */
  async fetchVerified(input: GithubSyncRequest): Promise<VerifiedGithubRelease> {
    const repository = normalizeRepository(input.repository)
    const releaseTag = normalizeTag(input.releaseTag)
    const checks: string[] = []
    const release = await this.source.getRelease(repository, releaseTag)
    if (release.tagName !== releaseTag) throw moduleError('VALIDATION_FAILED', 'GitHub returned a different release tag')
    if (release.draft) throw moduleError('VALIDATION_FAILED', 'Draft releases cannot be ingested')
    const provenanceAsset = release.assets.find(asset => asset.name === `${releaseTag}.provenance.json`)
    if (!provenanceAsset) throw moduleError('VALIDATION_FAILED', `Release is missing ${releaseTag}.provenance.json`)
    const provenanceBytes = await this.source.downloadAsset(provenanceAsset, GITHUB_SYNC_LIMITS.maxProvenanceBytes)
    assertAssetDigest(provenanceAsset, provenanceBytes)
    const provenance = parseProvenance(provenanceBytes)
    if (provenance.repository.toLowerCase() !== repository.toLowerCase()) throw moduleError('VALIDATION_FAILED', 'Provenance repository does not match the requested repository')
    if (provenance.releaseTag !== releaseTag) throw moduleError('VALIDATION_FAILED', 'Provenance release tag does not match the requested tag')
    checks.push('provenance.identity')

    const tagCommit = await this.source.resolveTagCommit(repository, releaseTag)
    if (tagCommit !== provenance.releaseCommit) throw moduleError('VALIDATION_FAILED', `Tag ${releaseTag} resolves to ${tagCommit}, provenance claims ${provenance.releaseCommit}`)
    checks.push('tag.commit')

    const packageAsset = release.assets.find(asset => asset.name === provenance.packageFile)
    if (!packageAsset) throw moduleError('VALIDATION_FAILED', `Release is missing package ${provenance.packageFile}`)
    if (packageAsset.digest && packageAsset.digest !== `sha256:${provenance.packageChecksum}`) throw moduleError('VALIDATION_FAILED', 'GitHub asset digest does not match the provenance package checksum')
    const packageBytes = await this.source.downloadAsset(packageAsset, GITHUB_SYNC_LIMITS.maxPackageBytes)
    const packageSha256 = sha256(packageBytes)
    if (packageSha256 !== provenance.packageChecksum) throw moduleError('VALIDATION_FAILED', 'Release package checksum does not match provenance')
    checks.push('package.sha256')

    let entries: TarEntries
    try {
      entries = readTarGz(packageBytes, {maxUncompressedBytes: GITHUB_SYNC_LIMITS.maxUncompressedBytes})
    } catch (error) {
      if (error instanceof TarGzError) throw moduleError('VALIDATION_FAILED', error.message)
      throw error
    }
    const file = (path: string) => entries.get(`package/${path}`) ?? null
    const mpsBytes = file('modula.product.json')
    if (!mpsBytes) throw moduleError('VALIDATION_FAILED', 'Release package has no modula.product.json (MPS is canonical)')
    const manifestBytes = file('module.manifest.json')
    if (!manifestBytes) throw moduleError('VALIDATION_FAILED', 'Release package has no module.manifest.json adapter')
    if (provenance.productManifestChecksum && sha256(mpsBytes) !== provenance.productManifestChecksum) throw moduleError('VALIDATION_FAILED', 'modula.product.json checksum does not match provenance')
    checks.push('productManifest.sha256')

    const parsedProduct = ingestProductManifest({filename: 'modula.product.json', bytes: mpsBytes})
    if (!parsedProduct.ok || !parsedProduct.product) {
      throw moduleError('VALIDATION_FAILED', parsedProduct.diagnostics.map(item => `${item.code}: ${item.message}`).join('; ') || 'Invalid modula.product.json')
    }
    const product = parsedProduct.product
    const mps = JSON.parse(mpsBytes.toString('utf8')) as Record<string, any>

    let manifest: GreenfieldModuleManifest
    try {
      manifest = new GreenfieldModuleManifestService().parse(JSON.parse(manifestBytes.toString('utf8')))
    } catch (error) {
      throw moduleError('VALIDATION_FAILED', `module.manifest.json is invalid: ${(error as Error).message}`)
    }
    const computedManifestSha = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
    if (manifest.integrity.manifestSha256 !== computedManifestSha || (provenance.greenfieldManifestChecksum && provenance.greenfieldManifestChecksum !== computedManifestSha)) {
      throw moduleError('VALIDATION_FAILED', 'Greenfield adapter manifest checksum does not match provenance')
    }
    checks.push('adapterManifest.sha256')

    const legacyBytes = file('modula.module.json')
    if (legacyBytes && provenance.standardManifestChecksum && sha256(legacyBytes) !== provenance.standardManifestChecksum) throw moduleError('VALIDATION_FAILED', 'modula.module.json checksum does not match provenance')
    assertAdapterConsistency({mps, product, manifest, legacy: legacyBytes ? parseJson(legacyBytes, 'modula.module.json') as Record<string, any> : null, provenance, repository, releaseTag})
    checks.push('identity.consistent')

    const frontendPath = product.frontendArtifact?.path ?? null
    if (provenance.frontendArtifact && frontendPath && provenance.frontendArtifact !== frontendPath) throw moduleError('VALIDATION_FAILED', 'Provenance frontend artifact path does not match modula.product.json')
    const frontendBytes = frontendPath ? file(frontendPath) : null
    if (frontendPath && !frontendBytes) throw moduleError('VALIDATION_FAILED', `Release package is missing frontend artifact ${frontendPath}`)
    if (frontendBytes && provenance.frontendChecksum && sha256(frontendBytes) !== provenance.frontendChecksum) throw moduleError('VALIDATION_FAILED', 'Frontend artifact checksum does not match provenance')
    if (frontendBytes) checks.push('frontend.sha256')

    const schemaPaths = [...new Set(((mps.backend?.records ?? []) as Array<{schemaPath?: unknown}>).map(record => record.schemaPath).filter((path): path is string => typeof path === 'string'))]
    const schemas = schemaPaths.map(path => {
      const bytes = file(path)
      if (!bytes) throw moduleError('VALIDATION_FAILED', `Release package is missing schema ${path}`)
      return {path, bytes}
    })
    const assets = product.presentationAssets.flatMap(asset => {
      const bytes = file(asset.path)
      return bytes ? [{path: asset.path, bytes}] : []
    })
    verifyPresentationAssetBytes(product.presentationAssets, assets)
    if (assets.length) checks.push('presentation.assets')

    const evidence: GreenfieldModuleReleaseEvidence = {
      repository: manifest.source.repository,
      releaseTag,
      releaseCommit: provenance.releaseCommit,
      artifactSha256: packageSha256,
      manifestSha256: computedManifestSha,
      productManifestSha256: sha256(mpsBytes),
      frontendSha256: frontendBytes ? sha256(frontendBytes) : null,
      signature: provenance.signature ?? undefined,
    }
    return {
      productId: product.productId,
      version: product.version,
      repository,
      releaseTag,
      releaseCommit: provenance.releaseCommit,
      packageFile: provenance.packageFile,
      packageSha256,
      packageBytes,
      mpsBytes,
      manifest,
      frontend: frontendPath && frontendBytes ? {path: frontendPath, bytes: frontendBytes} : null,
      schemas,
      assets,
      evidence,
      checks,
    }
  }

  async sync(input: GithubSyncRequest) {
    const runId = randomUUID()
    const startedAt = new Date()
    const dryRun = input.dryRun !== false
    if (!dryRun) await this.db.insertInto('greenfield_module_sync_runs').values({sync_run_id: runId, sync_source_id: null, status: 'running', started_at: startedAt, completed_at: null, summary: JSON.stringify({repository: input.repository, releaseTag: input.releaseTag, publish: Boolean(input.publish)}), created_at: startedAt}).execute()
    try {
      const verified = await this.fetchVerified(input)
      const releases = new GreenfieldModuleReleaseService(this.db)
      const existing = await releases.getRelease(verified.productId, verified.version)
      if (existing) assertStoredProvenance(verified, existing)
      const action = existing
        ? existing.releaseState === 'published' || existing.releaseState === 'superseded' ? 'backfill' : `continue-from-${existing.releaseState}`
        : 'import'
      const base = {
        productId: verified.productId,
        version: verified.version,
        repository: verified.repository,
        releaseTag: verified.releaseTag,
        releaseCommit: verified.releaseCommit,
        packageSha256: verified.packageSha256,
        signed: Boolean(verified.evidence.signature),
        checks: verified.checks,
        action,
      }
      if (dryRun) return {mode: 'DRY_RUN' as const, ...base}

      let release = existing ?? await releases.importPendingReview(verified.manifest, verified.evidence)
      if (release.releaseState === 'quarantined' || release.releaseState === 'revoked') throw moduleError('FORBIDDEN', `Release is ${release.releaseState}; sync will not change it`)
      if (release.releaseState === 'pendingReview') release = await releases.verifyRelease(verified.productId, verified.version)
      await this.storePackageBlob(release.releaseId, verified)
      const ingested = await new GreenfieldMpsIngestService(this.db).ingest({
        filename: 'modula.product.json',
        bytes: verified.mpsBytes,
        releaseId: release.releaseId,
        frontend: verified.frontend,
        schemas: verified.schemas,
        assets: verified.assets,
        distributionVerified: true,
      })
      if (!ingested || ingested.productId !== verified.productId || ingested.version !== verified.version) throw moduleError('VALIDATION_FAILED', 'MPS ingest did not persist the release')
      const channel = releaseChannelFromMps(verified.mpsBytes)
      if (release.releaseState === 'published' || release.releaseState === 'superseded') {
        if (release.releaseChannel !== channel) throw moduleError('CONFLICT', 'Published release channel is immutable')
      } else {
        await this.db.updateTable('greenfield_module_releases').set({release_channel: channel}).where('release_id', '=', release.releaseId).execute()
      }
      if (input.publish && release.releaseState === 'verified') release = await releases.publishRelease(verified.productId, verified.version)
      const summary = {...base, releaseId: release.releaseId, releaseState: release.releaseState, releaseChannel: channel, packageStored: true, assetsStored: verified.assets.length}
      await this.db.updateTable('greenfield_module_sync_runs').set({status: 'completed', completed_at: new Date(), summary: JSON.stringify(summary)}).where('sync_run_id', '=', runId).execute()
      return {mode: 'APPLIED' as const, syncRunId: runId, ...summary}
    } catch (error) {
      if (!dryRun) {
        const message = error instanceof Error ? error.message.slice(0, 2000) : 'sync failed'
        const code = typeof (error as {code?: unknown})?.code === 'string' ? (error as {code: string}).code : 'SYNC_FAILED'
        await this.db.updateTable('greenfield_module_sync_runs').set({status: 'failed', completed_at: new Date()}).where('sync_run_id', '=', runId).execute()
        await this.db.insertInto('greenfield_module_sync_failures').values({sync_failure_id: randomUUID(), sync_run_id: runId, repository: input.repository ?? null, code, message, retryable: code === 'NOT_FOUND', created_at: new Date()}).execute()
      }
      throw error
    }
  }

  private async storePackageBlob(releaseId: string, verified: VerifiedGithubRelease) {
    if (verified.packageBytes.length > GITHUB_SYNC_LIMITS.maxStoredPackageBytes) {
      throw moduleError('VALIDATION_FAILED', 'Verified package exceeds the immutable distribution store limit')
    }
    await this.db.transaction().execute(async trx => {
      await trx.insertInto('greenfield_release_asset_blobs').values({
        sha256: verified.packageSha256,
        media_type: 'application/gzip',
        byte_size: verified.packageBytes.length,
        bytes: verified.packageBytes,
        created_at: new Date(),
      } as never).onConflict(oc => oc.column('sha256').doNothing()).execute()
      await trx.insertInto('greenfield_release_artifacts').values({
        artifact_id: `release:${releaseId}:module-package`,
        release_id: releaseId,
        kind: 'module-package',
        sha256: verified.packageSha256,
        filename: safeArtifactFilename(verified.packageFile),
        access_class: 'installation',
        required_for_offline_launch: true,
        created_at: new Date(),
      }).onConflict(oc => oc.column('artifact_id').doNothing()).execute()
    })
  }
}

function releaseChannelFromMps(bytes: Buffer): 'stable' | 'beta' | 'rc' | 'dev' {
  const raw = parseJson(bytes, 'modula.product.json') as Record<string, any>
  const channel = raw.release?.channel
  return channel === 'beta' || channel === 'rc' || channel === 'dev' ? channel : 'stable'
}

function safeArtifactFilename(value: string): string {
  const filename = value.replace(/^.*[/\\]/, '').replace(/[^A-Za-z0-9._-]/g, '-')
  return filename && filename !== '.' && filename !== '..' ? filename : 'module-package.tar.gz'
}

type Provenance = {
  productId: string
  version: string
  repository: string
  releaseTag: string
  releaseCommit: string
  packageFile: string
  packageChecksum: string
  productManifestChecksum: string | null
  greenfieldManifestChecksum: string | null
  standardManifestChecksum: string | null
  frontendArtifact: string | null
  frontendChecksum: string | null
  signature: unknown
}

function parseProvenance(bytes: Buffer): Provenance {
  const raw = parseJson(bytes, 'provenance') as Record<string, unknown>
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
  const digest = (value: unknown, label: string) => {
    const result = text(value)
    if (result !== null && !/^[0-9a-f]{64}$/.test(result)) throw moduleError('VALIDATION_FAILED', `Provenance ${label} is not a SHA-256`)
    return result
  }
  const provenance: Provenance = {
    productId: text(raw.productId) ?? text(raw.moduleId) ?? '',
    version: text(raw.version) ?? text(raw.moduleVersion) ?? '',
    repository: text(raw.repository) ?? '',
    releaseTag: text(raw.releaseTag) ?? '',
    releaseCommit: text(raw.releaseCommit) ?? '',
    packageFile: text(raw.packageFile) ?? text(raw.releaseAssetName) ?? '',
    packageChecksum: digest(raw.packageChecksum, 'packageChecksum') ?? '',
    productManifestChecksum: digest(raw.productManifestChecksum, 'productManifestChecksum'),
    greenfieldManifestChecksum: digest(raw.greenfieldManifestChecksum, 'greenfieldManifestChecksum'),
    standardManifestChecksum: digest(raw.standardManifestChecksum, 'standardManifestChecksum'),
    frontendArtifact: text(raw.frontendArtifact),
    frontendChecksum: digest(raw.frontendChecksum, 'frontendChecksum'),
    signature: raw.signature ?? null,
  }
  if (!provenance.productId || !provenance.version || !provenance.repository || !provenance.releaseTag || !provenance.packageFile || !provenance.packageChecksum) {
    throw moduleError('VALIDATION_FAILED', 'Provenance is missing product identity, repository, tag, package file or package checksum')
  }
  if (!/^[0-9a-f]{40}$/.test(provenance.releaseCommit)) throw moduleError('VALIDATION_FAILED', 'Provenance requires an exact 40-character release commit')
  if (!/^[A-Za-z0-9._-]+\.tgz$/.test(provenance.packageFile)) throw moduleError('VALIDATION_FAILED', 'Provenance package file name is invalid')
  return provenance
}

/**
 * modula.product.json is canonical; module.manifest.json and the optional
 * legacy modula.module.json are generated adapters. Any disagreement on
 * identity, version, publisher or source repository rejects the release.
 */
function assertAdapterConsistency(input: {mps: Record<string, any>; product: {productId: string; version: string}; manifest: GreenfieldModuleManifest; legacy: Record<string, any> | null; provenance: Provenance; repository: string; releaseTag: string}) {
  const {mps, product, manifest, legacy, provenance} = input
  const conflicts: string[] = []
  const expect = (label: string, actual: unknown, expected: unknown) => {
    if (actual !== expected) conflicts.push(`${label}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`)
  }
  expect('module.manifest.json moduleId', manifest.moduleId, product.productId)
  expect('module.manifest.json version', manifest.version, product.version)
  expect('provenance productId', provenance.productId, product.productId)
  expect('provenance version', provenance.version, product.version)
  const publisherId = typeof mps.publisher?.id === 'string' ? mps.publisher.id : null
  if (publisherId) expect('module.manifest.json publisher', manifest.publisher.publisherId, publisherId)
  const mpsRepository = typeof mps.source?.repository === 'string' ? mps.source.repository : null
  if (mpsRepository) expect('module.manifest.json source.repository', manifest.source.repository, mpsRepository)
  if (manifest.source.repository.toLowerCase() !== input.repository.toLowerCase()) conflicts.push(`module.manifest.json source.repository ${manifest.source.repository} != ${input.repository}`)
  if (manifest.source.releaseTag && manifest.source.releaseTag !== input.releaseTag) conflicts.push(`module.manifest.json source.releaseTag ${manifest.source.releaseTag} != ${input.releaseTag}`)
  if (manifest.source.releaseAssetName && manifest.source.releaseAssetName !== provenance.packageFile) conflicts.push(`module.manifest.json source.releaseAssetName ${manifest.source.releaseAssetName} != ${provenance.packageFile}`)
  if (legacy) {
    expect('modula.module.json id', legacy.id ?? legacy.moduleId, product.productId)
    expect('modula.module.json version', legacy.moduleVersion ?? legacy.version, product.version)
    const legacyPublisher = legacy.publisher?.id ?? legacy.publisher?.publisherId
    if (publisherId && legacyPublisher !== undefined) expect('modula.module.json publisher', legacyPublisher, publisherId)
  }
  if (conflicts.length) throw moduleError('VALIDATION_FAILED', `Release adapters conflict with modula.product.json: ${conflicts.join('; ')}`)
}

function assertStoredProvenance(verified: VerifiedGithubRelease, release: GreenfieldModuleReleaseRecord) {
  if (release.sourceRepository.toLowerCase() !== verified.manifest.source.repository.toLowerCase()
    || release.sourceCommit !== verified.releaseCommit
    || release.manifestSha256 !== verified.evidence.manifestSha256
    || release.releaseSha256 !== verified.packageSha256) {
    throw moduleError('CONFLICT', `Stored release ${verified.productId}@${verified.version} does not match the GitHub release; immutable releases are never overwritten`)
  }
}

function assertAssetDigest(asset: GithubReleaseAsset, bytes: Buffer) {
  if (asset.digest && asset.digest !== `sha256:${sha256(bytes)}`) throw moduleError('VALIDATION_FAILED', `GitHub digest mismatch for ${asset.name}`)
}

function normalizeRepository(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(value.trim())) throw moduleError('VALIDATION_FAILED', 'repository must be owner/name')
  return value.trim()
}

function normalizeTag(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._\/-]{0,199}$/.test(value.trim()) || value.includes('..')) throw moduleError('VALIDATION_FAILED', 'releaseTag is invalid')
  return value.trim()
}

function parseJson(bytes: Buffer, label: string): unknown {
  try { return JSON.parse(bytes.toString('utf8')) } catch { throw moduleError('VALIDATION_FAILED', `${label} is not valid JSON`) }
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}
