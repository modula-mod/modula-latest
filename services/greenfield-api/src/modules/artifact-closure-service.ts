import {sql} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import {AuditRepository} from '../domains/audit/repository.js'
import type {GreenfieldModuleReleaseRecord} from './module-domain.js'
import {moduleError} from './module-errors.js'
import {GreenfieldModuleRegistryService} from './registry-service.js'
import {GreenfieldRegistryTrustService} from './registry-trust-service.js'

/**
 * GF-MOD-01: artifact and presentation closure for installable releases.
 *
 * Closure means every byte the registry advertises for a release is actually
 * stored and still hashes to the digest recorded at ingestion. Digests and
 * sizes are recomputed inside Postgres (sha256/octet_length) so the check never
 * streams package bytes into the API process. Everything here is read-only
 * apart from the integrity-failure audit row, which mirrors readArtifact.
 */
export type PackageArtifactState = 'present' | 'missing' | 'noReleaseDigest' | 'digestMismatch'

export type PackageArtifactClosure = {
  state: PackageArtifactState
  expectedSha256: string | null
  observedSha256: string | null
  declaredBytes: number | null
  observedBytes: number | null
  accessClass: 'public' | 'installation' | null
}

export type PresentationBlobClosure = {
  assetId: string
  role: string
  path: string
  mediaType: string
  sha256: string | null
  state: 'present' | 'noDigest' | 'missingBlob' | 'digestMismatch'
  bytes: number | null
}

export type ReleaseClosureEntry = {
  releaseId: string
  moduleId: string
  version: string
  releaseState: string
  releaseChannel: string
  digests: {releaseSha256: string | null; manifestSha256: string; productManifestSha256: string | null; frontendSha256: string | null}
  packageArtifact: PackageArtifactClosure
  presentation: {declared: number; present: number; missing: number; mismatched: number; noDigest: number; assets: PresentationBlobClosure[]}
  signature: {state: string; keyId: string | null; verifiedAt: string | null}
  trustVerified: boolean | null
  closed: boolean
  error: string | null
}

export type ArtifactClosureReport = {
  reportVersion: 'gf-mod-01.v1'
  mode: 'READ_ONLY'
  generatedAt: string
  releaseStates: string[]
  totals: {
    releases: number
    closed: number
    open: number
    packageMissing: number
    packageDigestMismatch: number
    packageNoReleaseDigest: number
    presentationDeclared: number
    presentationMissingBlobs: number
    presentationDigestMismatch: number
    presentationNoDigest: number
    unsigned: number
    signatureNotVerified: number
  }
  releases: ReleaseClosureEntry[]
}

/** Release states from which an account can install or keep running a release. */
export const INSTALLABLE_RELEASE_STATES = ['published', 'superseded'] as const

export class GreenfieldArtifactClosureService {
  constructor(private readonly db: ModulaDb) {}

  /** Recomputes the stored package artifact for one release without loading its bytes. */
  async packageArtifact(release: Pick<GreenfieldModuleReleaseRecord, 'releaseId' | 'releaseSha256'>): Promise<PackageArtifactClosure> {
    const expected = release.releaseSha256
    if (!expected) {
      return {state: 'noReleaseDigest', expectedSha256: null, observedSha256: null, declaredBytes: null, observedBytes: null, accessClass: null}
    }
    const row = await this.db.selectFrom('greenfield_release_artifacts as artifact')
      .innerJoin('greenfield_release_asset_blobs as blob', 'blob.sha256', 'artifact.sha256')
      .select([
        'artifact.access_class',
        'blob.byte_size',
        sql<string>`encode(sha256(blob.bytes), 'hex')`.as('observed_sha256'),
        sql<number>`octet_length(blob.bytes)`.as('observed_bytes'),
      ])
      .where('artifact.release_id', '=', release.releaseId)
      .where('artifact.kind', '=', 'module-package')
      .where('artifact.sha256', '=', expected)
      .executeTakeFirst()
    if (!row) {
      return {state: 'missing', expectedSha256: expected, observedSha256: null, declaredBytes: null, observedBytes: null, accessClass: null}
    }
    const observedBytes = Number(row.observed_bytes)
    const intact = row.observed_sha256 === expected && observedBytes === row.byte_size
    return {
      state: intact ? 'present' : 'digestMismatch',
      expectedSha256: expected,
      observedSha256: row.observed_sha256,
      declaredBytes: row.byte_size,
      observedBytes,
      accessClass: row.access_class,
    }
  }

  /**
   * Fail-closed gate for install preview/install. A corrupted package is never
   * installable. A missing package is refused unless the caller explicitly runs
   * the existing development-only untrusted-release allowance.
   */
  async assertPackageInstallable(release: GreenfieldModuleReleaseRecord, options: {allowMissingInDevelopment: boolean}): Promise<PackageArtifactClosure> {
    const closure = await this.packageArtifact(release)
    if (closure.state === 'present') return closure
    if (closure.state === 'digestMismatch') {
      await new AuditRepository(this.db).append('module.artifact.integrity-failed', {
        expectedDigest: closure.expectedSha256,
        observedDigest: closure.observedSha256,
        declaredBytes: closure.declaredBytes,
        observedBytes: closure.observedBytes,
        gate: 'install-preview',
      }, {type: 'moduleRelease', id: release.releaseId})
      throw moduleError('ARTIFACT_DIGEST_MISMATCH', `Stored package artifact for ${release.moduleId}@${release.version} failed integrity verification`)
    }
    if (options.allowMissingInDevelopment) return closure
    throw moduleError('UNTRUSTED_RELEASE', closure.state === 'noReleaseDigest'
      ? `Release ${release.moduleId}@${release.version} has no recorded package digest`
      : `Release ${release.moduleId}@${release.version} has no stored immutable package artifact`)
  }

  async presentationBlobs(releaseIds: readonly string[]): Promise<Map<string, PresentationBlobClosure[]>> {
    const result = new Map<string, PresentationBlobClosure[]>()
    if (!releaseIds.length) return result
    const rows = await this.db.selectFrom('greenfield_release_presentation_assets as asset')
      .leftJoin('greenfield_release_asset_blobs as blob', 'blob.sha256', 'asset.sha256')
      .select([
        'asset.asset_id', 'asset.release_id', 'asset.role', 'asset.artifact_path', 'asset.media_type', 'asset.sha256',
        'blob.byte_size',
        sql<string | null>`CASE WHEN blob.sha256 IS NULL THEN NULL ELSE encode(sha256(blob.bytes), 'hex') END`.as('observed_sha256'),
        sql<number | null>`CASE WHEN blob.sha256 IS NULL THEN NULL ELSE octet_length(blob.bytes) END`.as('observed_bytes'),
      ])
      .where('asset.release_id', 'in', [...releaseIds])
      .orderBy('asset.release_id').orderBy('asset.sort_order').orderBy('asset.asset_id')
      .execute()
    for (const row of rows) {
      const observedBytes = row.observed_bytes === null ? null : Number(row.observed_bytes)
      const state: PresentationBlobClosure['state'] = !row.sha256 ? 'noDigest'
        : row.observed_sha256 === null ? 'missingBlob'
          : row.observed_sha256 === row.sha256 && observedBytes === row.byte_size ? 'present' : 'digestMismatch'
      const list = result.get(row.release_id!) ?? []
      list.push({assetId: row.asset_id, role: row.role, path: row.artifact_path, mediaType: row.media_type, sha256: row.sha256, state, bytes: observedBytes})
      result.set(row.release_id!, list)
    }
    return result
  }

  /** Read-only closure report across every installable release. */
  async report(options: {releaseStates?: readonly string[]; moduleId?: string | null} = {}): Promise<ArtifactClosureReport> {
    const states = [...(options.releaseStates?.length ? options.releaseStates : INSTALLABLE_RELEASE_STATES)]
    let query = this.db.selectFrom('greenfield_module_releases')
      .select(['release_id', 'module_id', 'version', 'release_state', 'release_channel', 'release_sha256', 'manifest_sha256'])
      .where('release_state', 'in', states as any)
    if (options.moduleId) query = query.where('module_id', '=', options.moduleId)
    const rows = await query.orderBy('module_id').orderBy('version').orderBy('release_id').execute()
    const registry = new GreenfieldModuleRegistryService(this.db)
    const trust = new GreenfieldRegistryTrustService(this.db)
    const presentation = await this.presentationBlobs(rows.map(row => row.release_id))
    const releases: ReleaseClosureEntry[] = []
    for (const row of rows) {
      const packageArtifact = await this.packageArtifact({releaseId: row.release_id, releaseSha256: row.release_sha256})
      const assets = presentation.get(row.release_id) ?? []
      const counts = {
        declared: assets.length,
        present: assets.filter(asset => asset.state === 'present').length,
        missing: assets.filter(asset => asset.state === 'missingBlob').length,
        mismatched: assets.filter(asset => asset.state === 'digestMismatch').length,
        noDigest: assets.filter(asset => asset.state === 'noDigest').length,
      }
      let signature: ReleaseClosureEntry['signature'] = {state: 'unknown', keyId: null, verifiedAt: null}
      let digests: ReleaseClosureEntry['digests'] = {releaseSha256: row.release_sha256, manifestSha256: row.manifest_sha256, productManifestSha256: null, frontendSha256: null}
      let trustVerified: boolean | null = null
      let error: string | null = null
      try {
        const block = await trust.forRelease(await registry.getVersion(row.module_id, row.version))
        signature = {state: block.signature.state, keyId: block.signature.keyId, verifiedAt: block.signature.verifiedAt}
        digests = {releaseSha256: block.digests.releaseSha256, manifestSha256: block.digests.adapterManifestSha256,
          productManifestSha256: block.digests.productManifestSha256, frontendSha256: block.digests.frontendSha256}
        trustVerified = block.verified
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause)
      }
      releases.push({
        releaseId: row.release_id,
        moduleId: row.module_id,
        version: row.version,
        releaseState: row.release_state,
        releaseChannel: row.release_channel,
        digests,
        packageArtifact,
        presentation: {...counts, assets},
        signature,
        trustVerified,
        closed: packageArtifact.state === 'present' && counts.present === counts.declared && signature.state === 'verified',
        error,
      })
    }
    const sum = (pick: (entry: ReleaseClosureEntry) => number) => releases.reduce((total, entry) => total + pick(entry), 0)
    return {
      reportVersion: 'gf-mod-01.v1',
      mode: 'READ_ONLY',
      generatedAt: new Date().toISOString(),
      releaseStates: states,
      totals: {
        releases: releases.length,
        closed: releases.filter(entry => entry.closed).length,
        open: releases.filter(entry => !entry.closed).length,
        packageMissing: releases.filter(entry => entry.packageArtifact.state === 'missing').length,
        packageDigestMismatch: releases.filter(entry => entry.packageArtifact.state === 'digestMismatch').length,
        packageNoReleaseDigest: releases.filter(entry => entry.packageArtifact.state === 'noReleaseDigest').length,
        presentationDeclared: sum(entry => entry.presentation.declared),
        presentationMissingBlobs: sum(entry => entry.presentation.missing),
        presentationDigestMismatch: sum(entry => entry.presentation.mismatched),
        presentationNoDigest: sum(entry => entry.presentation.noDigest),
        unsigned: releases.filter(entry => entry.signature.state === 'unsigned').length,
        signatureNotVerified: releases.filter(entry => entry.signature.state !== 'verified').length,
      },
      releases,
    }
  }
}
