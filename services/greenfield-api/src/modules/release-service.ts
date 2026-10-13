import {
  classifyPermissionRisk,
  contributionCounts,
  CONTRIBUTION_GROUPS,
  backendModeForManifest,
  dependencyRequestsFromManifest,
  manifestChecksum,
  type GreenfieldModuleContributions,
  type GreenfieldModuleManifest,
  type ModulaExtensionProduct,
} from '@modula/greenfield-module-manifest'
import {GreenfieldPublisherSigningKeyService, buildPublisherReleaseStatement, normalizeSignatureInput, signingManifestDigest, statementSha256, type PublisherReleaseStatement, type ReleaseSignatureInput, type SignatureVerificationResult} from './release-signing.js'
import {sql} from 'kysely'
import type {GreenfieldModuleReleaseState} from '../database/types.js'
import type {ModulaDb} from '../database/client.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {OutboxRepository} from '../domains/outbox/repository.js'
import {GreenfieldEventBus} from '../events/index.js'
import {moduleError} from './module-errors.js'
import {GreenfieldModulePublisherService} from './publisher-service.js'
import type {VerifiedGithubRelease} from './github-release-sync-service.js'
import type {GreenfieldModuleReleaseRecord} from './module-domain.js'
import {isModuleIdentityAlias, moduleIdFamily, resolveCanonicalModuleId} from '@modula/greenfield-contracts'

const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

type ContributionType =
  | 'route'
  | 'profileTab'
  | 'boardSurface'
  | 'setting'
  | 'schema'
  | 'tool'
  | 'function'
  | 'interModuleAction'
  | 'widget'
  | 'plugin'
  | 'connector'
  | 'job'
  | 'event'

export type GreenfieldModuleReleaseEvidence = {
  repository: string
  releaseTag: string
  releaseCommit: string
  artifactSha256: string
  manifestSha256?: string
  /** sha256 of the exact modula.product.json bytes shipped in the release (bound by a publisher signature). */
  productManifestSha256?: string | null
  /** sha256 of the exact frontend artifact bytes (bound by a publisher signature). */
  frontendSha256?: string | null
  /** Publisher Ed25519 signature from the provenance sidecar: {algorithm: 'Ed25519', keyId, value}. */
  signature?: unknown
}

const CONTRIBUTION_TYPE_BY_GROUP: Record<keyof GreenfieldModuleContributions, ContributionType> = {
  routes: 'route',
  profileTabs: 'profileTab',
  boardSurfaces: 'boardSurface',
  settings: 'setting',
  schemas: 'schema',
  tools: 'tool',
  functions: 'function',
  interModuleActions: 'interModuleAction',
  widgets: 'widget',
  plugins: 'plugin',
  connectors: 'connector',
  jobs: 'job',
  events: 'event',
}

export class GreenfieldModuleReleaseService {
  constructor(private readonly db: ModulaDb) {}

  async importPendingReview(manifest: GreenfieldModuleManifest, evidence?: GreenfieldModuleReleaseEvidence): Promise<GreenfieldModuleReleaseRecord> {
    // Registry core never rewrites a publisher's manifest. A release declared
    // under a historical alias is refused; it must be published under the
    // canonical identity (aliases stay resolvable for lookups and installs).
    if (isModuleIdentityAlias(manifest.moduleId)) {
      throw moduleError('CONFLICT', `${manifest.moduleId} is an identity alias of ${resolveCanonicalModuleId(manifest.moduleId)}; publish the release under the canonical id`)
    }
    const publisher = new GreenfieldModulePublisherService(this.db)
    await publisher.ensurePublisherForManifest(manifest)

    const existing = await this.getRelease(manifest.moduleId, manifest.version)
    if (existing) throw moduleError('CONFLICT', `Release ${manifest.moduleId}@${manifest.version} already exists`)

    const extensionId = manifest.moduleId
    const extensionVersionId = `${manifest.moduleId}@${manifest.version}`
    const moduleVersionId = `module-version:${manifest.moduleId}:${manifest.version}`
    const releaseId = `module-release:${manifest.moduleId}:${manifest.version}`
    const now = new Date()
    const sourceVersion = Math.floor(now.getTime() / 1000)
    const computedManifestSha = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
    const extensionProduct = extensionProductForManifest(manifest)
    if (extensionProduct) validateReleaseEvidence(manifest, computedManifestSha, evidence)
    const releaseSha = evidence?.artifactSha256 ?? manifest.integrity.releaseSha256 ?? computedManifestSha
    const sourceCommit = evidence?.releaseCommit ?? manifest.source.commit
    const backend = manifest.backend ?? {mode: 'greenfield-managed' as const}
    const productKind = productKindForManifest(manifest)
    const signatureInput = releaseSignatureInput(manifest, evidence)
    const signing = new GreenfieldPublisherSigningKeyService(this.db)
    const signatureCheck = signatureInput
      ? await signing.verify(buildPublisherReleaseStatement({
          manifest,
          sourceSha: sourceCommit,
          artifactSha256: releaseSha,
          productManifestSha256: evidence?.productManifestSha256 ?? null,
          frontendSha256: evidence?.frontendSha256 ?? null,
          signingKeyId: signatureInput.keyId,
        }), signatureInput, now)
      : null
    if (signatureCheck && signatureCheck.state !== 'verified') {
      throw moduleError('VALIDATION_FAILED', `Release signature rejected (${signatureCheck.state}): ${signatureCheck.detail}`)
    }
    const dependencyRows = dependencyRequestsFromManifest(manifest)
      .filter(dependency => dependency.moduleId && (dependency.relation === 'requires' || dependency.relation === 'optional' || dependency.relation === 'recommended'))

    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_extensions')
        .values({
          extension_id: extensionId,
          slug: manifest.moduleId,
          publisher_account_id: null,
          status: 'pendingReview',
          created_at: now,
          updated_at: now,
        })
        .onConflict(oc => oc.column('extension_id').doUpdateSet({status: 'pendingReview', updated_at: now}))
        .execute()
      await trx
        .insertInto('greenfield_extension_versions')
        .values({
          extension_version_id: extensionVersionId,
          extension_id: extensionId,
          version: manifest.version,
          manifest,
          status: 'pendingReview',
          created_at: now,
        })
        .execute()
      await trx
        .insertInto('greenfield_module_versions')
        .values({
          module_version_id: moduleVersionId,
          extension_version_id: extensionVersionId,
          module_id: manifest.moduleId,
          version: manifest.version,
          publisher_id: manifest.publisher.publisherId,
          manifest,
          status: 'pendingReview',
          created_at: now,
          updated_at: now,
        })
        .execute()
      await trx
        .insertInto('greenfield_module_releases')
        .values({
          release_id: releaseId,
          module_version_id: moduleVersionId,
          extension_id: extensionId,
          extension_version_id: extensionVersionId,
          module_id: manifest.moduleId,
          version: manifest.version,
          publisher_id: manifest.publisher.publisherId,
          release_state: 'pendingReview',
          source_repository: manifest.source.repository,
          source_commit: sourceCommit,
          manifest_path: manifest.source.manifestPath,
          manifest_sha256: computedManifestSha,
          release_sha256: releaseSha,
          signature_key_id: signatureInput?.keyId ?? null,
          signature: signatureInput?.value ?? null,
          compatibility: manifest.compatibility,
          license_status: manifest.license.status,
          trust_level: manifest.trust.requestedLevel,
          product_kind: productKind,
          extension_product: jsonb(extensionProduct ?? {}),
          published_at: null,
          quarantined_at: null,
          revoked_at: null,
          superseded_at: null,
          created_at: now,
          updated_at: now,
        })
        .execute()
      if (extensionProduct) {
        if (extensionProduct.targets.length) {
          await trx.insertInto('greenfield_extension_targets').values(extensionProduct.targets.map((target, index) => ({
            target_id: `extension-target:${releaseId}:${index}`,
            release_id: releaseId,
            product_id: manifest.moduleId,
            product_kind: productKind,
            target_product_id: target.productId,
            version_range: target.versionRange,
            required_capabilities: jsonb(target.requiredCapabilities ?? []),
            required_extension_points: jsonb(target.requiredExtensionPoints ?? []),
            created_at: now,
          }))).execute()
        }
        if (extensionProduct.extensionPoints.length) {
          await trx.insertInto('greenfield_extension_points').values(extensionProduct.extensionPoints.map(point => ({
            extension_point_id: `extension-point:${releaseId}:${point.id}`,
            release_id: releaseId,
            product_id: manifest.moduleId,
            point_key: point.id,
            title: point.title,
            contribution_kinds: jsonb(point.contributionKinds),
            required_capability: point.requiredCapability ?? null,
            platforms: jsonb(point.platforms ?? []),
            max_contributions: point.maxContributions ?? 20,
            declaration: jsonb(point),
            created_at: now,
            updated_at: now,
          }))).execute()
        }
      }
      await trx
        .insertInto('greenfield_module_sources')
        .values({
          source_id: `module-source:${releaseId}`,
          release_id: releaseId,
          provider: 'github',
          repository: manifest.source.repository,
          repository_id: null,
          default_branch: null,
          commit: sourceCommit,
          manifest_path: manifest.source.manifestPath,
          release_tag: manifest.source.releaseTag ?? null,
          release_asset_name: manifest.source.releaseAssetName ?? null,
          fetched_at: now,
          etag: null,
        })
        .execute()
      if (dependencyRows.length) {
        await trx
          .insertInto('greenfield_module_dependencies')
          .values(
            dependencyRows.map((dependency, index) => ({
              dependency_id: `module-dependency:${releaseId}:${dependency.relation}:${dependency.moduleId}:${index}`,
              release_id: releaseId,
              module_id: manifest.moduleId,
              dependency_module_id: dependency.moduleId!,
              version_range: dependency.versionRange,
              optional: dependency.optional,
              reason: dependency.reason ? `${dependency.relation}: ${dependency.reason}` : dependency.relation,
              created_at: now,
            })),
          )
          .execute()
      }
      if (manifest.permissions.length) {
        await trx
          .insertInto('greenfield_module_permissions')
          .values(
            manifest.permissions.map(permission => ({
              permission_id: `module-permission:${releaseId}:${permission.permission}`,
              release_id: releaseId,
              permission: permission.permission,
              reason: permission.reason,
              risk: permission.risk ?? classifyPermissionRisk(permission.permission),
              requested_at: now,
            })),
          )
          .execute()
      }
      await this.insertContributions(trx, releaseId, manifest.moduleId, manifest.contributions, now)
      await trx
        .insertInto('greenfield_module_license_evidence')
        .values(
          manifest.license.evidenceIds.map(id => ({
            evidence_id: `module-license:${releaseId}:${id}`,
            release_id: releaseId,
            evidence_type: manifest.license.status === 'firstParty' ? 'firstPartyPolicy' : 'readmeDeclaration',
            summary: id.includes('first-party') ? 'Modula first-party ownership policy' : `Licence evidence ${id}`,
            source_path: id,
            checksum: null,
            created_at: now,
          })),
        )
        .execute()
      await trx
        .insertInto('greenfield_module_release_integrity')
        .values({
          integrity_id: `module-integrity:${releaseId}`,
          release_id: releaseId,
          manifest_sha256: computedManifestSha,
          release_sha256: releaseSha,
          schema_sha256: {},
          settings_schema_sha256: null,
          source_commit: sourceCommit,
          verified_at: null,
          mismatch_at: null,
        })
        .execute()
      await trx
        .insertInto('module_backend_definitions')
        .values({
          definition_id: `module-backend-definition:${releaseId}`,
          release_id: releaseId,
          module_id: manifest.moduleId,
          mode: backendModeForManifest(manifest),
          protocol_version: backend.protocolVersion ?? null,
          endpoint_strategy: backend.endpoints?.baseUrlStrategy ?? null,
          discovery_path: backend.endpoints?.discoveryPath ?? null,
          health_path: backend.endpoints?.healthPath ?? null,
          backend: jsonb(backend),
          trust: jsonb(backend.trust ?? {}),
          data: jsonb(backend.data ?? {}),
          deployment: jsonb(backend.deployment ?? {}),
          network_policy: jsonb(backend.network ?? {}),
          actions: jsonb(backend.actions ?? []),
          created_at: now,
          updated_at: now,
        })
        .execute()
      if (signatureInput && signatureCheck) {
        await trx
          .insertInto('greenfield_module_release_signatures')
          .values({
            signature_id: `module-signature:${releaseId}:${signatureInput.keyId}`,
            release_id: releaseId,
            signature_key_id: signatureInput.keyId,
            signature: signatureInput.value,
            algorithm: 'Ed25519',
            verified_at: now,
            revoked_at: null,
            statement: jsonb(signatureCheck.statement),
            statement_sha256: signatureCheck.statementSha256,
            verification_state: 'verified',
            verification_detail: signatureCheck.detail,
            public_key_fingerprint: signatureCheck.publicKeyFingerprint,
            observed_at: now,
          })
          .execute()
      }
      await new AuditRepository(trx).append('module.release.imported', {moduleId: manifest.moduleId, version: manifest.version}, {type: 'moduleRelease', id: releaseId})
      await new GreenfieldEventBus(trx).publish({
        eventType: 'module.release.imported',
        aggregateType: 'moduleRelease',
        aggregateId: releaseId,
        aggregateVersion: sourceVersion,
        visibility: 'internal',
        classification: 'internal',
        payload: {releaseId, moduleId: manifest.moduleId, version: manifest.version, releaseState: 'pendingReview'},
        metadata: {source: 'greenfield.modules'},
        occurredAt: now,
      })
      await new GreenfieldEventBus(trx).publish({
        eventType: 'module.discovered',
        aggregateType: 'module',
        aggregateId: manifest.moduleId,
        aggregateVersion: sourceVersion,
        visibility: 'internal',
        classification: 'internal',
        payload: {releaseId, moduleId: manifest.moduleId, version: manifest.version, releaseState: 'pendingReview'},
        metadata: {source: 'greenfield.modules'},
        occurredAt: now,
      })
      await new OutboxRepository(trx).enqueue(trx, {
        eventType: 'module.release.verify' as any,
        aggregateType: 'moduleRelease',
        aggregateId: releaseId,
        payload: {releaseId, moduleId: manifest.moduleId, version: manifest.version},
      })
    })

    return this.getRelease(manifest.moduleId, manifest.version).then(row => row!)
  }

  async getRelease(moduleId: string, version: string): Promise<GreenfieldModuleReleaseRecord | undefined> {
    const row = await this.db
      .selectFrom('greenfield_module_releases')
      .innerJoin('greenfield_module_versions', 'greenfield_module_versions.module_version_id', 'greenfield_module_releases.module_version_id')
      .select([
        'greenfield_module_releases.release_id',
        'greenfield_module_releases.extension_id',
        'greenfield_module_releases.extension_version_id',
        'greenfield_module_releases.module_id',
        'greenfield_module_releases.version',
        'greenfield_module_releases.publisher_id',
        'greenfield_module_releases.release_state',
        'greenfield_module_releases.release_channel',
        'greenfield_module_releases.manifest_sha256',
        'greenfield_module_releases.release_sha256',
        'greenfield_module_releases.signature_key_id',
        'greenfield_module_releases.signature',
        'greenfield_module_releases.source_repository',
        'greenfield_module_releases.source_commit',
        'greenfield_module_releases.manifest_path',
        'greenfield_module_releases.license_status',
        'greenfield_module_releases.trust_level',
        'greenfield_module_releases.published_at',
        'greenfield_module_versions.manifest',
      ])
      .where('greenfield_module_releases.module_id', 'in', [...moduleIdFamily(moduleId)])
      .where('greenfield_module_releases.version', '=', version)
      .executeTakeFirst()
    return row ? mapRelease(row as any) : undefined
  }

  async getReleaseById(releaseId: string): Promise<GreenfieldModuleReleaseRecord | undefined> {
    const row = await this.db
      .selectFrom('greenfield_module_releases')
      .innerJoin('greenfield_module_versions', 'greenfield_module_versions.module_version_id', 'greenfield_module_releases.module_version_id')
      .select([
        'greenfield_module_releases.release_id',
        'greenfield_module_releases.extension_id',
        'greenfield_module_releases.extension_version_id',
        'greenfield_module_releases.module_id',
        'greenfield_module_releases.version',
        'greenfield_module_releases.publisher_id',
        'greenfield_module_releases.release_state',
        'greenfield_module_releases.release_channel',
        'greenfield_module_releases.manifest_sha256',
        'greenfield_module_releases.release_sha256',
        'greenfield_module_releases.signature_key_id',
        'greenfield_module_releases.signature',
        'greenfield_module_releases.source_repository',
        'greenfield_module_releases.source_commit',
        'greenfield_module_releases.manifest_path',
        'greenfield_module_releases.license_status',
        'greenfield_module_releases.trust_level',
        'greenfield_module_releases.published_at',
        'greenfield_module_versions.manifest',
      ])
      .where('greenfield_module_releases.release_id', '=', releaseId)
      .executeTakeFirst()
    return row ? mapRelease(row as any) : undefined
  }

  /** Attach publisher evidence to an existing unsigned published release without rewriting its release facts. */
  async attachPublishedSignature(
    releaseId: string,
    input: {signature: unknown; statementSha256: string},
    verifiedArtifact: VerifiedGithubRelease,
    actorAccountId: string | null,
    requestId?: string,
  ) {
    const signature = normalizeSignatureInput(input.signature)
    if (!signature) throw moduleError('VALIDATION_FAILED', 'A publisher signature is required')
    if (!/^[0-9a-f]{64}$/.test(input.statementSha256)) throw moduleError('VALIDATION_FAILED', 'Statement SHA-256 is required')

    return this.db.transaction().execute(async trx => {
      const release = await trx.selectFrom('greenfield_module_releases as release')
        .innerJoin('greenfield_module_versions as version', 'version.module_version_id', 'release.module_version_id')
        .select([
          'release.release_id', 'release.module_id', 'release.version', 'release.publisher_id',
          'release.release_state', 'release.source_repository', 'release.source_commit',
          'release.manifest_sha256', 'release.release_sha256', 'release.signature_key_id', 'release.signature',
          'version.manifest',
        ])
        .where('release.release_id', '=', releaseId)
        .forUpdate('release')
        .executeTakeFirst()
      if (!release) throw moduleError('NOT_FOUND', 'Release not found')
      if (release.release_state !== 'published') throw moduleError('CONFLICT', 'Only published releases can receive retrospective signatures')
      const existing = await trx.selectFrom('greenfield_module_release_signatures')
        .select(['signature_id', 'signature_key_id', 'signature', 'statement_sha256', 'verification_state'])
        .where('release_id', '=', releaseId).executeTakeFirst()

      const manifest = release.manifest as GreenfieldModuleManifest
      const integrity = await trx.selectFrom('greenfield_module_release_integrity')
        .select(['manifest_sha256', 'release_sha256', 'source_commit', 'mismatch_at'])
        .where('release_id', '=', releaseId).executeTakeFirst()
      if (!release.release_sha256 || !/^[0-9a-f]{64}$/.test(release.release_sha256)
        || !/^[0-9a-f]{40}$/.test(release.source_commit)
        || !integrity || integrity.mismatch_at
        || integrity.manifest_sha256 !== release.manifest_sha256
        || integrity.release_sha256 !== release.release_sha256
        || integrity.source_commit !== release.source_commit
        || manifest.moduleId !== release.module_id || manifest.version !== release.version
        || manifest.publisher.publisherId !== release.publisher_id
        || manifest.source.repository !== release.source_repository
        || !manifest.source.releaseTag
        || verifiedArtifact.productId !== release.module_id
        || verifiedArtifact.version !== release.version
        || verifiedArtifact.repository !== release.source_repository
        || verifiedArtifact.releaseTag !== manifest.source.releaseTag
        || verifiedArtifact.releaseCommit !== release.source_commit
        || verifiedArtifact.packageSha256 !== release.release_sha256
        || signingManifestDigest(verifiedArtifact.manifest) !== release.manifest_sha256
        || signingManifestDigest(manifest) !== release.manifest_sha256) {
        throw moduleError('VALIDATION_FAILED', 'Release facts or integrity evidence do not match')
      }

      const [ingestion, frontend] = await Promise.all([
        trx.selectFrom('greenfield_mps_ingestions').select('manifest_sha256')
          .where('release_id', '=', releaseId).executeTakeFirst(),
        trx.selectFrom('greenfield_release_frontends').select('artifact_sha256')
          .where('release_id', '=', releaseId).executeTakeFirst(),
      ])
      const statement = buildPublisherReleaseStatement({
        manifest,
        sourceSha: release.source_commit,
        artifactSha256: release.release_sha256,
        productManifestSha256: ingestion?.manifest_sha256 ?? null,
        frontendSha256: frontend?.artifact_sha256 ?? null,
        signingKeyId: signature.keyId,
      })
      if ((ingestion && verifiedArtifact.evidence.productManifestSha256 !== ingestion.manifest_sha256)
        || (frontend && verifiedArtifact.evidence.frontendSha256 !== frontend.artifact_sha256)) {
        throw moduleError('VALIDATION_FAILED', 'Projected release digests do not match verified package bytes')
      }
      if (statementSha256(statement) !== input.statementSha256) {
        throw moduleError('VALIDATION_FAILED', 'Signed statement does not match registry release facts')
      }
      const now = new Date()
      // Hold the key against concurrent revocation until the signature row commits.
      const verified = await new GreenfieldPublisherSigningKeyService(trx).verify(statement, signature, now, true)
      if (verified.state !== 'verified') {
        throw moduleError('VALIDATION_FAILED', `Release signature rejected (${verified.state}): ${verified.detail}`)
      }
      if (existing || release.signature_key_id || release.signature) {
        if (existing?.signature_key_id === signature.keyId && existing.signature === signature.value
          && existing.statement_sha256 === verified.statementSha256 && existing.verification_state === 'verified'
          && release.signature_key_id === signature.keyId && release.signature === signature.value) {
          return {
            releaseId,
            keyId: signature.keyId,
            verificationState: verified.state,
            statementSha256: verified.statementSha256,
            publicKeyFingerprint: verified.publicKeyFingerprint,
            alreadyAttached: true,
          }
        }
        throw moduleError('CONFLICT', 'Release already has different signature evidence')
      }
      await trx.insertInto('greenfield_module_release_signatures').values({
        signature_id: `module-signature:${releaseId}:${signature.keyId}`,
        release_id: releaseId,
        signature_key_id: signature.keyId,
        signature: signature.value,
        algorithm: 'Ed25519',
        verified_at: now,
        revoked_at: null,
        statement: jsonb(statement),
        statement_sha256: verified.statementSha256,
        verification_state: 'verified',
        verification_detail: verified.detail,
        public_key_fingerprint: verified.publicKeyFingerprint,
        observed_at: now,
      }).execute()
      await trx.updateTable('greenfield_module_releases')
        .set({signature_key_id: signature.keyId, signature: signature.value, updated_at: now})
        .where('release_id', '=', releaseId).execute()
      await new AuditRepository(trx).append('module.release.signature_attached', {
        keyId: signature.keyId,
        statementSha256: verified.statementSha256,
        publicKeyFingerprint: verified.publicKeyFingerprint,
      }, {type: 'moduleRelease', id: releaseId}, {accountId: actorAccountId, requestId})
      return {
        releaseId,
        keyId: signature.keyId,
        verificationState: verified.state,
        statementSha256: verified.statementSha256,
        publicKeyFingerprint: verified.publicKeyFingerprint,
      }
    })
  }

  async verifyRelease(moduleId: string, version: string): Promise<GreenfieldModuleReleaseRecord> {
    const release = await this.requireRelease(moduleId, version)
    const declaredManifestSha = release.manifest.integrity.manifestSha256
    const computedManifestSha = manifestChecksum({...release.manifest, integrity: {...release.manifest.integrity, manifestSha256: ''}})
    if (!declaredManifestSha || declaredManifestSha !== release.manifestSha256 || computedManifestSha !== release.manifestSha256) {
      await this.quarantineRelease(release.releaseId, 'checksum mismatch', 'block')
      throw moduleError('VALIDATION_FAILED', 'Manifest checksum mismatch quarantined release')
    }
    await this.verifyReleaseSignatures(release)
    await this.setReleaseState(release.releaseId, 'verified')
    return this.requireRelease(moduleId, version)
  }

  /**
   * Re-verifies every recorded publisher signature against a statement rebuilt
   * from the registry's own facts. Unsigned releases pass (and surface as
   * "unsigned" in the trust block); a failing signature quarantines the release.
   */
  async verifyReleaseSignatures(release: GreenfieldModuleReleaseRecord): Promise<SignatureVerificationResult[]> {
    const rows = await this.db.selectFrom('greenfield_module_release_signatures').selectAll().where('release_id', '=', release.releaseId).execute()
    if (!rows.length) return []
    const ingestion = await this.db.selectFrom('greenfield_mps_ingestions').select(['manifest_sha256']).where('release_id', '=', release.releaseId).executeTakeFirst()
    const frontend = await this.db.selectFrom('greenfield_release_frontends').select(['artifact_sha256']).where('release_id', '=', release.releaseId).executeTakeFirst()
    const signing = new GreenfieldPublisherSigningKeyService(this.db)
    const results: SignatureVerificationResult[] = []
    for (const row of rows) {
      const signed = (row.statement ?? {}) as Partial<PublisherReleaseStatement>
      const statement = buildPublisherReleaseStatement({
        manifest: release.manifest,
        sourceSha: release.sourceCommit,
        artifactSha256: release.releaseSha256 ?? '',
        productManifestSha256: ingestion?.manifest_sha256 ?? signed.productManifestSha256 ?? null,
        frontendSha256: frontend?.artifact_sha256 ?? signed.frontendSha256 ?? null,
        signingKeyId: row.signature_key_id,
      })
      const result = await signing.verify(statement, {algorithm: row.algorithm, keyId: row.signature_key_id, value: row.signature}, row.observed_at ?? new Date())
      results.push(result)
      const now = new Date()
      await this.db.updateTable('greenfield_module_release_signatures').set({
        verification_state: result.state,
        verification_detail: result.detail,
        public_key_fingerprint: result.publicKeyFingerprint,
        statement_sha256: result.statementSha256,
        verified_at: result.state === 'verified' ? now : null,
        revoked_at: result.state === 'revokedKey' ? (row.revoked_at ?? now) : row.revoked_at,
        statement: row.statement ?? jsonb(statement),
        observed_at: row.observed_at ?? now,
      }).where('signature_id', '=', row.signature_id).execute()
      if (result.state !== 'verified') {
        await this.quarantineRelease(release.releaseId, `signature ${result.state}`, 'block')
        throw moduleError('VALIDATION_FAILED', `Release signature ${result.state}: ${result.detail}; release quarantined`)
      }
    }
    return results
  }

  async verifyReleaseFromId(releaseId: string): Promise<GreenfieldModuleReleaseRecord> {
    const release = await this.getReleaseById(releaseId)
    if (!release) throw moduleError('NOT_FOUND', 'Release not found')
    return this.verifyRelease(release.moduleId, release.version)
  }

  async publishRelease(moduleId: string, version: string): Promise<GreenfieldModuleReleaseRecord> {
    let release = await this.requireRelease(moduleId, version)
    if (release.releaseState === 'pendingReview') release = await this.verifyRelease(moduleId, version)
    if (release.releaseState !== 'verified') {
      throw moduleError('VALIDATION_FAILED', `Release ${moduleId}@${version} cannot be published from ${release.releaseState}`)
    }
    const now = new Date()
    const sourceVersion = Math.floor(now.getTime() / 1000)
    const productKind = productKindForManifest(release.manifest)
    await this.db.transaction().execute(async trx => {
      await trx
        .updateTable('greenfield_module_releases')
        .set({release_state: 'published', published_at: now, updated_at: now})
        .where('release_id', '=', release.releaseId)
        .execute()
      await trx.updateTable('greenfield_module_versions').set({status: 'published', updated_at: now}).where('module_version_id', '=', `module-version:${moduleId}:${version}`).execute()
      await trx.updateTable('greenfield_extension_versions').set({status: 'published'}).where('extension_version_id', '=', release.extensionVersionId).execute()
      await trx.updateTable('greenfield_extensions').set({status: 'published', updated_at: now}).where('extension_id', '=', release.extensionId).execute()
      await trx
        .insertInto('greenfield_extension_catalogue')
        .values({
          extension_id: release.moduleId,
          slug: release.moduleId,
          kind: productKind,
          name: release.manifest.name,
          description: release.manifest.description,
          version: release.version,
          publisher: release.manifest.publisher.displayName,
          trust: release.trustLevel,
          permissions: jsonb(release.manifest.permissions),
          compatibility: jsonb(release.manifest.compatibility),
          manifest: jsonb(release.manifest),
          catalogue_status: 'active',
          executable: release.manifest.lifecycle?.executionMode !== 'declarative' && release.trustLevel === 'firstParty',
          distribution_model: 'free',
          entitlement_id: null,
          created_at: now,
          updated_at: now,
        })
        .onConflict(oc =>
          oc.column('slug').doUpdateSet({
            name: release.manifest.name,
            description: release.manifest.description,
            version: release.version,
            publisher: release.manifest.publisher.displayName,
            trust: release.trustLevel,
            permissions: jsonb(release.manifest.permissions),
            compatibility: jsonb(release.manifest.compatibility),
            manifest: jsonb(release.manifest),
            catalogue_status: 'active',
            executable: release.manifest.lifecycle?.executionMode !== 'declarative' && release.trustLevel === 'firstParty',
            distribution_model: 'free',
            entitlement_id: null,
            kind: productKindForManifest(release.manifest),
            updated_at: now,
          }),
        )
        .execute()
      await new AuditRepository(trx).append('module.release.published', {moduleId, version}, {type: 'moduleRelease', id: release.releaseId})
      await new GreenfieldEventBus(trx).publish({
        eventType: 'module.release.published',
        aggregateType: 'moduleRelease',
        aggregateId: release.releaseId,
        aggregateVersion: sourceVersion,
        visibility: 'internal',
        classification: 'internal',
        payload: {releaseId: release.releaseId, moduleId, version, releaseState: 'published'},
        metadata: {source: 'greenfield.modules'},
        occurredAt: now,
      })
      await new GreenfieldEventBus(trx).publish({
        eventType: 'module.updated',
        aggregateType: 'module',
        aggregateId: moduleId,
        aggregateVersion: sourceVersion,
        visibility: 'internal',
        classification: 'internal',
        payload: {releaseId: release.releaseId, moduleId, version, releaseState: 'published'},
        metadata: {source: 'greenfield.modules'},
        occurredAt: now,
      })
      await new OutboxRepository(trx).enqueue(trx, {
        eventType: 'module.release.publish' as any,
        aggregateType: 'moduleRelease',
        aggregateId: release.releaseId,
        payload: {releaseId: release.releaseId, moduleId, version},
      })
    })
    return this.requireRelease(moduleId, version)
  }

  async quarantineRelease(releaseId: string, reason: string, policyAction: 'warn' | 'disableExecutableContributions' | 'block' = 'block') {
    const now = new Date()
    const sourceVersion = Math.floor(now.getTime() / 1000)
    const release = await this.db
      .selectFrom('greenfield_module_releases')
      .select(['module_id', 'version'])
      .where('release_id', '=', releaseId)
      .executeTakeFirst()
    if (!release) throw moduleError('NOT_FOUND', 'Release not found')
    await this.db.transaction().execute(async trx => {
      await trx
        .updateTable('greenfield_module_releases')
        .set({release_state: 'quarantined', quarantined_at: now, updated_at: now})
        .where('release_id', '=', releaseId)
        .execute()
      await trx
        .insertInto('greenfield_module_quarantines')
        .values({
          quarantine_id: `module-quarantine:${releaseId}:${now.getTime()}`,
          release_id: releaseId,
          reason,
          policy_action: policyAction,
          created_by: null,
          created_at: now,
          lifted_at: null,
        })
        .execute()
      await trx
        .updateTable('greenfield_module_contributions')
        .set({registration_status: policyAction === 'warn' ? 'registered' : 'quarantined', updated_at: now})
        .where('release_id', '=', releaseId)
        .where('execution_required', '=', true)
        .execute()
      await new GreenfieldEventBus(trx).publish({
        eventType: 'module.release.quarantined',
        aggregateType: 'moduleRelease',
        aggregateId: releaseId,
        aggregateVersion: sourceVersion,
        visibility: 'internal',
        classification: 'sensitive',
        payload: {releaseId, moduleId: release.module_id, version: release.version, releaseState: 'quarantined'},
        metadata: {source: 'greenfield.modules', reasonCode: 'administrative'},
        occurredAt: now,
      })
      await new GreenfieldEventBus(trx).publish({
        eventType: 'module.quarantined',
        aggregateType: 'module',
        aggregateId: release.module_id,
        aggregateVersion: sourceVersion,
        visibility: 'internal',
        classification: 'sensitive',
        payload: {releaseId, moduleId: release.module_id, version: release.version, releaseState: 'quarantined'},
        metadata: {source: 'greenfield.modules', reasonCode: 'administrative'},
        occurredAt: now,
      })
    })
  }

  async revokeRelease(releaseId: string, reason = 'administrative revocation') {
    const now = new Date()
    const sourceVersion = Math.floor(now.getTime() / 1000)
    const release = await this.db
      .selectFrom('greenfield_module_releases')
      .select(['module_id', 'version'])
      .where('release_id', '=', releaseId)
      .executeTakeFirst()
    if (!release) throw moduleError('NOT_FOUND', 'Release not found')
    await this.db.transaction().execute(async trx => {
      await trx.updateTable('greenfield_module_releases').set({release_state: 'revoked', revoked_at: now, updated_at: now}).where('release_id', '=', releaseId).execute()
      await trx
        .insertInto('greenfield_module_revocations')
        .values({revocation_id: `module-revocation:${releaseId}`, scope: 'release', target_id: releaseId, reason, created_by: null, created_at: now})
        .onConflict(oc => oc.columns(['scope', 'target_id']).doUpdateSet({reason, created_at: now}))
        .execute()
      await new GreenfieldEventBus(trx).publish({
        eventType: 'module.release.revoked',
        aggregateType: 'moduleRelease',
        aggregateId: releaseId,
        aggregateVersion: sourceVersion,
        visibility: 'internal',
        classification: 'sensitive',
        payload: {releaseId, moduleId: release.module_id, version: release.version, releaseState: 'revoked'},
        metadata: {source: 'greenfield.modules', reasonCode: 'administrative'},
        occurredAt: now,
      })
      await new GreenfieldEventBus(trx).publish({
        eventType: 'module.quarantined',
        aggregateType: 'module',
        aggregateId: release.module_id,
        aggregateVersion: sourceVersion,
        visibility: 'internal',
        classification: 'sensitive',
        payload: {releaseId, moduleId: release.module_id, version: release.version, releaseState: 'revoked'},
        metadata: {source: 'greenfield.modules', reasonCode: 'administrative'},
        occurredAt: now,
      })
    })
  }

  async setReleaseState(releaseId: string, state: GreenfieldModuleReleaseState): Promise<void> {
    await this.db
      .updateTable('greenfield_module_releases')
      .set({release_state: state, updated_at: new Date()})
      .where('release_id', '=', releaseId)
      .execute()
  }

  private async requireRelease(moduleId: string, version: string): Promise<GreenfieldModuleReleaseRecord> {
    const release = await this.getRelease(moduleId, version)
    if (!release) throw moduleError('NOT_FOUND', `Release ${moduleId}@${version} not found`)
    return release
  }

  private async insertContributions(
    trx: any,
    releaseId: string,
    moduleId: string,
    contributions: GreenfieldModuleContributions,
    now: Date,
  ): Promise<void> {
    const rows: Array<{
      contribution_id: string
      release_id: string
      module_id: string
      contribution_type: ContributionType
      contribution_key: string
      manifest: unknown
      execution_required: boolean
      registration_status: 'declared'
      created_at: Date
      updated_at: Date
    }> = []
    for (const group of CONTRIBUTION_GROUPS) {
      const contributionType = CONTRIBUTION_TYPE_BY_GROUP[group]
      if (!contributionType) continue
      for (const contribution of contributions[group] ?? []) {
        const anyContribution = contribution as any
        rows.push({
          contribution_id: `module-contribution:${releaseId}:${anyContribution.id}`,
          release_id: releaseId,
          module_id: moduleId,
          contribution_type: contributionType,
          contribution_key: anyContribution.id,
          manifest: contribution,
          execution_required: Boolean(anyContribution.executionRequired),
          registration_status: 'declared',
          created_at: now,
          updated_at: now,
        })
      }
    }
    if (rows.length) await trx.insertInto('greenfield_module_contributions').values(rows).execute()
  }
}

function extensionProductForManifest(manifest: GreenfieldModuleManifest): ModulaExtensionProduct | null {
  const value = (manifest as any).extensionProduct
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ModulaExtensionProduct : null
}

function productKindForManifest(manifest: GreenfieldModuleManifest) {
  return extensionProductForManifest(manifest)?.kind ?? 'module'
}

function validateReleaseEvidence(
  manifest: GreenfieldModuleManifest,
  computedManifestSha: string,
  evidence?: GreenfieldModuleReleaseEvidence,
) {
  if (!evidence) throw moduleError('VALIDATION_FAILED', 'Standard 2.1 extension products require immutable release evidence')
  if (evidence.repository !== manifest.source.repository) throw moduleError('VALIDATION_FAILED', 'Release evidence repository does not match manifest source')
  if (!manifest.source.releaseTag || evidence.releaseTag !== manifest.source.releaseTag) throw moduleError('VALIDATION_FAILED', 'Release evidence tag does not match manifest source')
  if (!/^[0-9a-f]{40}$/.test(evidence.releaseCommit)) throw moduleError('VALIDATION_FAILED', 'Release evidence requires an exact 40-character commit')
  if (!/^[0-9a-f]{64}$/.test(evidence.artifactSha256) || /^0+$/.test(evidence.artifactSha256)) throw moduleError('VALIDATION_FAILED', 'Release evidence requires a non-zero artifact SHA-256')
  if (evidence.manifestSha256 && evidence.manifestSha256 !== computedManifestSha) throw moduleError('VALIDATION_FAILED', 'Release evidence manifest checksum does not match the imported manifest')
  const signatureKeyId = manifest.integrity.signatureKeyId
  const signature = manifest.integrity.signature
  if (Boolean(signatureKeyId) !== Boolean(signature)) throw moduleError('VALIDATION_FAILED', 'Release signature and key ID must be declared together')
  if (signatureKeyId && !/^[A-Za-z0-9._:-]{3,160}$/.test(signatureKeyId)) throw moduleError('VALIDATION_FAILED', 'Release signature key ID is malformed')
  if (signature && !/^[A-Za-z0-9_-]{86}$/.test(signature)) throw moduleError('VALIDATION_FAILED', 'Release signature is not a canonical Ed25519 base64url value')
}

function releaseSignatureInput(manifest: GreenfieldModuleManifest, evidence?: GreenfieldModuleReleaseEvidence): ReleaseSignatureInput | null {
  const fromEvidence = normalizeSignatureInput(evidence?.signature)
  const keyId = manifest.integrity.signatureKeyId
  const value = manifest.integrity.signature
  if (Boolean(keyId) !== Boolean(value)) throw moduleError('VALIDATION_FAILED', 'Release signature and key ID must be declared together')
  const fromManifest = keyId && value ? normalizeSignatureInput({algorithm: 'Ed25519', keyId, value}) : null
  if (fromEvidence && fromManifest && (fromEvidence.keyId !== fromManifest.keyId || fromEvidence.value !== fromManifest.value)) {
    throw moduleError('VALIDATION_FAILED', 'Manifest integrity signature conflicts with the provenance signature')
  }
  return fromEvidence ?? fromManifest
}

function mapRelease(row: any): GreenfieldModuleReleaseRecord {
  return {
    releaseId: row.release_id,
    extensionId: row.extension_id,
    extensionVersionId: row.extension_version_id,
    moduleId: resolveCanonicalModuleId(row.module_id),
    version: row.version,
    publisherId: row.publisher_id,
    releaseState: row.release_state,
    releaseChannel: row.release_channel ?? 'stable',
    manifest: row.manifest,
    manifestSha256: row.manifest_sha256,
    releaseSha256: row.release_sha256,
    signatureKeyId: row.signature_key_id,
    signature: row.signature,
    sourceRepository: row.source_repository,
    sourceCommit: row.source_commit,
    manifestPath: row.manifest_path,
    licenseStatus: row.license_status,
    trustLevel: row.trust_level,
    publishedAt: row.published_at ?? null,
  }
}
