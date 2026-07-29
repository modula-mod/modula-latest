import {
  classifyPermissionRisk,
  contributionCounts,
  CONTRIBUTION_GROUPS,
  backendModeForManifest,
  manifestChecksum,
  type GreenfieldModuleContributions,
  type GreenfieldModuleManifestV1,
} from '@modula/greenfield-module-manifest'
import {sql} from 'kysely'
import type {GreenfieldModuleReleaseState} from '../database/types.js'
import type {ModulaDb} from '../database/client.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {OutboxRepository} from '../domains/outbox/repository.js'
import {GreenfieldEventBus} from '../events/index.js'
import {moduleError} from './module-errors.js'
import {GreenfieldModulePublisherService} from './publisher-service.js'
import type {GreenfieldModuleReleaseRecord} from './module-domain.js'

const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

type ContributionType =
  | 'route'
  | 'profileTab'
  | 'boardSurface'
  | 'setting'
  | 'schema'
  | 'tool'
  | 'function'
  | 'widget'
  | 'plugin'
  | 'connector'
  | 'job'
  | 'event'

const CONTRIBUTION_TYPE_BY_GROUP: Record<keyof GreenfieldModuleContributions, ContributionType> = {
  routes: 'route',
  profileTabs: 'profileTab',
  boardSurfaces: 'boardSurface',
  settings: 'setting',
  schemas: 'schema',
  tools: 'tool',
  functions: 'function',
  widgets: 'widget',
  plugins: 'plugin',
  connectors: 'connector',
  jobs: 'job',
  events: 'event',
}

export class GreenfieldModuleReleaseService {
  constructor(private readonly db: ModulaDb) {}

  async importPendingReview(manifest: GreenfieldModuleManifestV1): Promise<GreenfieldModuleReleaseRecord> {
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
    const releaseSha = manifest.integrity.releaseSha256 ?? computedManifestSha
    const backend = manifest.backend ?? {mode: 'greenfield-managed' as const}

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
          source_commit: manifest.source.commit,
          manifest_path: manifest.source.manifestPath,
          manifest_sha256: computedManifestSha,
          release_sha256: releaseSha,
          signature_key_id: manifest.integrity.signatureKeyId ?? null,
          signature: manifest.integrity.signature ?? null,
          compatibility: manifest.compatibility,
          license_status: manifest.license.status,
          trust_level: manifest.trust.requestedLevel,
          published_at: null,
          quarantined_at: null,
          revoked_at: null,
          superseded_at: null,
          created_at: now,
          updated_at: now,
        })
        .execute()
      await trx
        .insertInto('greenfield_module_sources')
        .values({
          source_id: `module-source:${releaseId}`,
          release_id: releaseId,
          provider: 'github',
          repository: manifest.source.repository,
          repository_id: null,
          default_branch: null,
          commit: manifest.source.commit,
          manifest_path: manifest.source.manifestPath,
          release_tag: manifest.source.releaseTag ?? null,
          release_asset_name: manifest.source.releaseAssetName ?? null,
          fetched_at: now,
          etag: null,
        })
        .execute()
      if (manifest.dependencies?.length) {
        await trx
          .insertInto('greenfield_module_dependencies')
          .values(
            manifest.dependencies.map(dependency => ({
              dependency_id: `module-dependency:${releaseId}:${dependency.moduleId}`,
              release_id: releaseId,
              module_id: manifest.moduleId,
              dependency_module_id: dependency.moduleId,
              version_range: dependency.versionRange,
              optional: dependency.optional,
              reason: dependency.reason ?? null,
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
          source_commit: manifest.source.commit,
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
      if (manifest.integrity.signatureKeyId && manifest.integrity.signature) {
        await trx
          .insertInto('greenfield_module_release_signatures')
          .values({
            signature_id: `module-signature:${releaseId}:${manifest.integrity.signatureKeyId}`,
            release_id: releaseId,
            signature_key_id: manifest.integrity.signatureKeyId,
            signature: manifest.integrity.signature,
            algorithm: 'Ed25519',
            verified_at: null,
            revoked_at: null,
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
        'greenfield_module_releases.manifest_sha256',
        'greenfield_module_releases.release_sha256',
        'greenfield_module_releases.signature_key_id',
        'greenfield_module_releases.signature',
        'greenfield_module_releases.source_repository',
        'greenfield_module_releases.source_commit',
        'greenfield_module_releases.manifest_path',
        'greenfield_module_releases.license_status',
        'greenfield_module_releases.trust_level',
        'greenfield_module_versions.manifest',
      ])
      .where('greenfield_module_releases.module_id', '=', moduleId)
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
        'greenfield_module_releases.manifest_sha256',
        'greenfield_module_releases.release_sha256',
        'greenfield_module_releases.signature_key_id',
        'greenfield_module_releases.signature',
        'greenfield_module_releases.source_repository',
        'greenfield_module_releases.source_commit',
        'greenfield_module_releases.manifest_path',
        'greenfield_module_releases.license_status',
        'greenfield_module_releases.trust_level',
        'greenfield_module_versions.manifest',
      ])
      .where('greenfield_module_releases.release_id', '=', releaseId)
      .executeTakeFirst()
    return row ? mapRelease(row as any) : undefined
  }

  async verifyRelease(moduleId: string, version: string): Promise<GreenfieldModuleReleaseRecord> {
    const release = await this.requireRelease(moduleId, version)
    const declaredManifestSha = release.manifest.integrity.manifestSha256
    if (declaredManifestSha && declaredManifestSha !== release.manifestSha256) {
      await this.quarantineRelease(release.releaseId, 'checksum mismatch', 'block')
      throw moduleError('VALIDATION_FAILED', 'Manifest checksum mismatch quarantined release')
    }
    await this.setReleaseState(release.releaseId, 'verified')
    return this.requireRelease(moduleId, version)
  }

  async verifyReleaseFromId(releaseId: string): Promise<GreenfieldModuleReleaseRecord> {
    const release = await this.getReleaseById(releaseId)
    if (!release) throw moduleError('NOT_FOUND', 'Release not found')
    return this.verifyRelease(release.moduleId, release.version)
  }

  async publishRelease(moduleId: string, version: string): Promise<GreenfieldModuleReleaseRecord> {
    const release = await this.requireRelease(moduleId, version)
    if (release.releaseState !== 'verified' && release.releaseState !== 'pendingReview') {
      throw moduleError('VALIDATION_FAILED', `Release ${moduleId}@${version} cannot be published from ${release.releaseState}`)
    }
    const now = new Date()
    const sourceVersion = Math.floor(now.getTime() / 1000)
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
          kind: 'module',
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

function mapRelease(row: any): GreenfieldModuleReleaseRecord {
  return {
    releaseId: row.release_id,
    extensionId: row.extension_id,
    extensionVersionId: row.extension_version_id,
    moduleId: row.module_id,
    version: row.version,
    publisherId: row.publisher_id,
    releaseState: row.release_state,
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
  }
}
