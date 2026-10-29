import {compareSemver, isSemver, satisfiesSemverRange} from '@modula/greenfield-module-manifest'
import type {ModulaDb} from '../database/client.js'
import type {GreenfieldModuleReleaseRecord} from './module-domain.js'
import {moduleError} from './module-errors.js'

/**
 * Registry-owned trust facts for one immutable release.
 *
 * Nothing here is read from a client-supplied manifest at request time: every
 * value comes from what the registry verified and recorded at ingestion,
 * verification, publication, revocation or quarantine.
 */
export type RegistrySignatureState = 'verified' | 'unsigned' | 'unverified' | 'invalid' | 'unknownKey' | 'revokedKey'

export type RegistryTrustWarning = {code: string; message: string}

export type RegistryCompatibilityResult = {
  evaluated: boolean
  hostVersion: string | null
  platform: string | null
  compatible: boolean | null
  reasons: Array<{code: string; message: string}>
  requirements: {
    host: string | null
    frontendHostRuntime: string | null
    minimumModulaHostVersion: string | null
    maximumModulaHostVersion: string | null
    platforms: string[]
    requiredCapabilities: unknown[]
  }
}

export type RegistryTrustBlock = {
  registryReleaseId: string
  moduleId: string
  version: string
  releaseState: string
  publishedAt: string | null
  verified: boolean
  publisher: {publisherId: string; displayName: string | null; status: string; trustLevel: string | null; verified: boolean; verifiedAt: string | null}
  signature: {state: RegistrySignatureState; algorithm: string | null; keyId: string | null; publicKeyFingerprint: string | null; verifiedAt: string | null; detail: string | null}
  digests: {
    releaseSha256: string | null
    adapterManifestSha256: string
    productManifestSha256: string | null
    frontendSha256: string | null
  }
  integrity: {verifiedAt: string | null; mismatchAt: string | null}
  provenance: {provider: 'github'; repository: string; commit: string; releaseTag: string | null; releaseAssetName: string | null; ingestedAt: string | null}
  compatibility: RegistryCompatibilityResult
  revocation: {revoked: boolean; revokedAt: string | null; scope: string | null; reason: string | null}
  quarantine: {quarantined: boolean; since: string | null; reason: string | null; policyAction: string | null}
  update: {latestPublishedVersion: string | null; updateAvailable: boolean}
  warnings: RegistryTrustWarning[]
}

export type RegistryTrustOptions = {hostVersion?: string | null; platform?: string | null}

export function parseTrustOptions(query: unknown): RegistryTrustOptions {
  const record = query && typeof query === 'object' ? query as Record<string, unknown> : {}
  const hostVersion = typeof record.hostVersion === 'string' && record.hostVersion.trim() ? record.hostVersion.trim() : null
  if (hostVersion && !isSemver(hostVersion)) throw moduleError('VALIDATION_FAILED', 'hostVersion must be a semantic version')
  const platform = typeof record.platform === 'string' && ['ios', 'android', 'web', 'desktop', 'server'].includes(record.platform) ? record.platform : null
  return {hostVersion, platform}
}

export class GreenfieldRegistryTrustService {
  constructor(private readonly db: ModulaDb) {}

  async forRelease(release: GreenfieldModuleReleaseRecord, options: RegistryTrustOptions = {}, latestPublishedVersion: string | null = null): Promise<RegistryTrustBlock> {
    const [publisher, signatures, ingestion, frontend, integrity, source, revocations, quarantine, developmentAssets] = await Promise.all([
      this.db.selectFrom('greenfield_publishers').selectAll().where('publisher_id', '=', release.publisherId).executeTakeFirst(),
      this.db.selectFrom('greenfield_module_release_signatures as signature')
        .leftJoin('greenfield_publisher_signing_keys as signing_key', 'signing_key.key_id', 'signature.signature_key_id')
        .selectAll('signature')
        .select([
          'signing_key.publisher_id as signing_key_publisher_id',
          'signing_key.state as signing_key_state',
          'signing_key.revoked_at as signing_key_revoked_at',
        ])
        .where('signature.release_id', '=', release.releaseId).execute(),
      this.db.selectFrom('greenfield_mps_ingestions').select(['manifest_sha256', 'manifest', 'ingested_at']).where('release_id', '=', release.releaseId).executeTakeFirst(),
      this.db.selectFrom('greenfield_release_frontends').select(['artifact_sha256', 'compatibility', 'required_capabilities']).where('release_id', '=', release.releaseId).executeTakeFirst(),
      this.db.selectFrom('greenfield_module_release_integrity').select(['verified_at', 'mismatch_at']).where('release_id', '=', release.releaseId).executeTakeFirst(),
      this.db.selectFrom('greenfield_module_sources').select(['release_tag', 'release_asset_name']).where('release_id', '=', release.releaseId).executeTakeFirst(),
      this.db.selectFrom('greenfield_module_revocations').selectAll()
        .where(eb => eb.or([
          eb.and([eb('scope', '=', 'release'), eb('target_id', '=', release.releaseId)]),
          eb.and([eb('scope', '=', 'module'), eb('target_id', '=', release.moduleId)]),
          eb.and([eb('scope', '=', 'publisher'), eb('target_id', '=', release.publisherId)]),
        ]))
        .orderBy('created_at', 'desc').executeTakeFirst(),
      this.db.selectFrom('greenfield_module_quarantines').selectAll().where('release_id', '=', release.releaseId).where('lifted_at', 'is', null).orderBy('created_at', 'desc').executeTakeFirst(),
      this.db.selectFrom('greenfield_release_presentation_assets').select('asset_id').where('release_id', '=', release.releaseId).where('development_asset', '=', true).executeTakeFirst(),
    ])

    const signature = signatureState(signatures, release, ingestion?.manifest_sha256 ?? null, frontend?.artifact_sha256 ?? null)
    const mps = record(ingestion?.manifest)
    const mpsCompatibility = record(mps?.compatibility)
    const frontendCompatibility = record(frontend?.compatibility)
    const compatibility = evaluateCompatibility(release, options, {
      host: stringOrNull(mpsCompatibility?.host),
      frontendHostRuntime: stringOrNull(frontendCompatibility?.versionRange) ?? stringOrNull(frontendCompatibility?.range),
      platforms: Array.isArray(mpsCompatibility?.platforms) ? (mpsCompatibility!.platforms as unknown[]).map(String) : release.manifest.compatibility?.platforms ?? [],
      requiredCapabilities: Array.isArray(frontend?.required_capabilities) ? frontend!.required_capabilities as unknown[] : [],
    })
    const publisherVerified = publisher?.status === 'verified'
    const revoked = release.releaseState === 'revoked' || Boolean(revocations)
    const quarantined = release.releaseState === 'quarantined' || Boolean(quarantine)
    // Missing integrity evidence is unknown trust, not a successful check.
    const integrityOk = Boolean(integrity && !integrity.mismatch_at)
    const update = {
      latestPublishedVersion,
      updateAvailable: Boolean(latestPublishedVersion && latestPublishedVersion !== release.version && versionIsNewer(latestPublishedVersion, release.version)),
    }

    const warnings: RegistryTrustWarning[] = []
    if (signature.state === 'unsigned') warnings.push({code: 'RELEASE_UNSIGNED', message: 'The publisher did not sign this release; integrity rests on registry-verified digests and provenance only.'})
    if (signature.state === 'unverified') warnings.push({code: 'SIGNATURE_UNVERIFIED', message: 'A signature is recorded but has not been verified against a registered publisher key.'})
    if (['invalid', 'unknownKey', 'revokedKey'].includes(signature.state)) warnings.push({code: 'SIGNATURE_REJECTED', message: `The release signature is ${signature.state}.`})
    if (!publisherVerified) warnings.push({code: 'PUBLISHER_NOT_VERIFIED', message: `Publisher status is ${publisher?.status ?? 'unknown'}.`})
    if (developmentAssets) warnings.push({code: 'DEVELOPMENT_ASSETS', message: 'Presentation media is marked as development placeholder artwork.'})
    if (!ingestion) warnings.push({code: 'NO_PRODUCT_PROJECTION', message: 'No verified modula.product.json projection is bound to this release.'})
    if (release.releaseState === 'superseded') warnings.push({code: 'RELEASE_SUPERSEDED', message: 'A newer release supersedes this version.'})
    if (quarantined) warnings.push({code: 'RELEASE_QUARANTINED', message: quarantine?.reason ?? 'Release is quarantined.'})
    if (revoked) warnings.push({code: 'RELEASE_REVOKED', message: revocations?.reason ?? 'Release is revoked.'})
    if (!integrity) warnings.push({code: 'NO_INTEGRITY_EVIDENCE', message: 'No release integrity evidence is recorded.'})
    else if (!integrityOk) warnings.push({code: 'INTEGRITY_MISMATCH', message: 'Release integrity verification recorded a mismatch.'})
    if (compatibility.evaluated && compatibility.compatible === false) warnings.push({code: 'HOST_INCOMPATIBLE', message: compatibility.reasons.map(reason => reason.message).join(' ')})

    return {
      registryReleaseId: release.releaseId,
      moduleId: release.moduleId,
      version: release.version,
      releaseState: release.releaseState,
      publishedAt: release.publishedAt ? new Date(release.publishedAt).toISOString() : null,
      verified: ['published', 'superseded'].includes(release.releaseState)
        && Boolean(release.releaseSha256 && release.manifestSha256)
        && integrityOk
        && publisherVerified
        && signature.state === 'verified'
        && !revoked
        && !quarantined,
      publisher: {
        publisherId: release.publisherId,
        displayName: publisher?.display_name ?? null,
        status: publisher?.status ?? 'unknown',
        trustLevel: publisher?.trust_level ?? null,
        verified: publisherVerified,
        verifiedAt: publisher?.verified_at ? publisher.verified_at.toISOString() : null,
      },
      signature,
      digests: {
        releaseSha256: release.releaseSha256,
        adapterManifestSha256: release.manifestSha256,
        productManifestSha256: ingestion?.manifest_sha256 ?? null,
        frontendSha256: frontend?.artifact_sha256 ?? null,
      },
      integrity: {
        verifiedAt: integrity?.verified_at ? integrity.verified_at.toISOString() : null,
        mismatchAt: integrity?.mismatch_at ? integrity.mismatch_at.toISOString() : null,
      },
      provenance: {
        provider: 'github',
        repository: release.sourceRepository,
        commit: release.sourceCommit,
        releaseTag: source?.release_tag ?? null,
        releaseAssetName: source?.release_asset_name ?? null,
        ingestedAt: ingestion?.ingested_at ? ingestion.ingested_at.toISOString() : null,
      },
      compatibility,
      revocation: {
        revoked,
        revokedAt: revocations?.created_at ? revocations.created_at.toISOString() : null,
        scope: revocations?.scope ?? (release.releaseState === 'revoked' ? 'release' : null),
        reason: revocations?.reason ?? null,
      },
      quarantine: {
        quarantined,
        since: quarantine?.created_at ? quarantine.created_at.toISOString() : null,
        reason: quarantine?.reason ?? null,
        policyAction: quarantine?.policy_action ?? null,
      },
      update,
      warnings,
    }
  }
}

/**
 * Verified projection of the canonical author declaration (modula.product.json).
 * Sections are passed through as verified at ingestion; nothing is synthesised.
 */
export function productProjection(ingestion: {manifest: unknown; manifest_sha256: string; product_standard: string} | undefined | null) {
  const manifest = record(ingestion?.manifest)
  if (!manifest || !ingestion) return null
  const pick = (key: string) => manifest[key] ?? null
  const release = record(manifest.release)
  return {
    productStandard: ingestion.product_standard,
    manifestSha256: ingestion.manifest_sha256,
    identity: pick('identity'),
    publisher: pick('publisher'),
    licence: pick('licence'),
    marketplace: pick('marketplace'),
    privacy: pick('privacy'),
    permissions: pick('permissions'),
    capabilities: pick('capabilities'),
    compatibility: pick('compatibility'),
    platforms: pick('platforms'),
    support: pick('support'),
    accessibility: pick('accessibility'),
    localization: pick('localization'),
    gameRuntime: pick('gameRuntime'),
    distribution: pick('distribution'),
    frontend: record(manifest.frontend) ? {mode: record(manifest.frontend)!.mode ?? null, artifact: record(manifest.frontend)!.artifact ?? null} : null,
    release: release ? {channel: release.channel ?? null, notes: release.notes ?? null} : null,
  }
}

export function signatureState(rows: Array<{
  signature_key_id: string; algorithm: string; verified_at: Date | null; revoked_at: Date | null;
  verification_state?: string | null; public_key_fingerprint?: string | null; verification_detail?: string | null;
  statement?: unknown; signing_key_publisher_id?: string | null; signing_key_state?: string | null; signing_key_revoked_at?: Date | null;
}>, release: GreenfieldModuleReleaseRecord, productManifestSha256: string | null, frontendSha256: string | null): RegistryTrustBlock['signature'] {
  if (!rows.length) return {state: 'unsigned', algorithm: null, keyId: null, publicKeyFingerprint: null, verifiedAt: null, detail: null}
  const effective = rows.map(row => {
    const statement = record(row.statement)
    if (row.revoked_at || row.signing_key_state === 'REVOKED' || row.signing_key_revoked_at) {
      return {row, state: 'revokedKey' as const, detail: 'Publisher signing key has been revoked'}
    }
    if (!['ACTIVE', 'ROTATED'].includes(row.signing_key_state ?? '') || row.signing_key_publisher_id !== release.publisherId) {
      return {row, state: 'unknownKey' as const, detail: 'Publisher signing key is missing or belongs to another publisher'}
    }
    if (row.verification_state !== 'verified' || !row.verified_at) {
      return {row, state: (row.verification_state && row.verification_state !== 'pending' ? row.verification_state : 'unverified') as RegistrySignatureState, detail: row.verification_detail ?? null}
    }
    if (!statement || statement.schemaVersion !== '1.0.0'
      || statement.statementType !== 'modula.publisher-release.v1'
      || statement.productId !== release.moduleId || statement.version !== release.version
      || statement.publisherId !== release.publisherId
      || statement.sourceRepository !== release.sourceRepository || statement.sourceSha !== release.sourceCommit
      || statement.releaseTag !== (release.manifest.source.releaseTag ?? null)
      || statement.artifactSha256 !== release.releaseSha256 || statement.manifestSha256 !== release.manifestSha256
      || statement.signingKeyId !== row.signature_key_id
      || (statement.productManifestSha256 ?? null) !== productManifestSha256
      || (statement.frontendSha256 ?? null) !== frontendSha256) {
      return {row, state: 'invalid' as const, detail: 'Signed statement does not match current release or projection facts'}
    }
    return {row, state: 'verified' as const, detail: row.verification_detail ?? null}
  })
  const selected = effective.find(item => item.state === 'verified') ?? effective[0]!
  const best = selected.row
  return {
    state: selected.state,
    algorithm: best.algorithm,
    keyId: best.signature_key_id,
    publicKeyFingerprint: best.public_key_fingerprint ?? null,
    verifiedAt: best.verified_at ? best.verified_at.toISOString() : null,
    detail: selected.detail,
  }
}

export function evaluateCompatibility(
  release: GreenfieldModuleReleaseRecord,
  options: RegistryTrustOptions,
  declared: {host: string | null; frontendHostRuntime: string | null; platforms: string[]; requiredCapabilities: unknown[]},
): RegistryCompatibilityResult {
  const requirements = {
    host: declared.host,
    frontendHostRuntime: declared.frontendHostRuntime,
    minimumModulaHostVersion: release.manifest.compatibility?.minimumModulaHostVersion ?? null,
    maximumModulaHostVersion: release.manifest.compatibility?.maximumModulaHostVersion ?? null,
    platforms: declared.platforms,
    requiredCapabilities: declared.requiredCapabilities,
  }
  const hostVersion = options.hostVersion ?? null
  const platform = options.platform ?? null
  if (!hostVersion && !platform) {
    return {evaluated: false, hostVersion: null, platform: null, compatible: null, reasons: [], requirements}
  }
  const reasons: RegistryCompatibilityResult['reasons'] = []
  if (hostVersion) {
    if (requirements.host && !satisfiesSemverRange(hostVersion, requirements.host)) reasons.push({code: 'HOST_RANGE_UNSATISFIED', message: `Host ${hostVersion} does not satisfy ${requirements.host}.`})
    if (requirements.frontendHostRuntime && !satisfiesSemverRange(hostVersion, requirements.frontendHostRuntime)) reasons.push({code: 'FRONTEND_HOST_RUNTIME_UNSATISFIED', message: `Host ${hostVersion} does not satisfy the frontend host runtime ${requirements.frontendHostRuntime}.`})
    if (requirements.minimumModulaHostVersion && !satisfiesSemverRange(hostVersion, `>=${requirements.minimumModulaHostVersion}`)) reasons.push({code: 'HOST_VERSION_TOO_OLD', message: `Host ${hostVersion} is older than ${requirements.minimumModulaHostVersion}.`})
    if (requirements.maximumModulaHostVersion && !satisfiesSemverRange(hostVersion, `<=${requirements.maximumModulaHostVersion}`)) reasons.push({code: 'HOST_VERSION_TOO_NEW', message: `Host ${hostVersion} is newer than ${requirements.maximumModulaHostVersion}.`})
  }
  if (platform && requirements.platforms.length && !requirements.platforms.includes(platform)) reasons.push({code: 'PLATFORM_UNSUPPORTED', message: `Platform ${platform} is not declared.`})
  return {evaluated: true, hostVersion, platform, compatible: reasons.length === 0, reasons, requirements}
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function versionIsNewer(candidate: string, current: string): boolean {
  try {
    return compareSemver(candidate, current) > 0
  } catch {
    return false
  }
}
