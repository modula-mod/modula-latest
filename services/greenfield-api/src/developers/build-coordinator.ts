import {createHash, createPublicKey, verify} from 'node:crypto'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {sql} from 'kysely'

type ClaimInput = {requestId?: unknown; maxBuilds?: unknown; leaseSeconds?: unknown}
type ResultInput = {
  requestId?: unknown
  buildId?: unknown
  productId?: unknown
  sourceRepository?: unknown
  sourceSha?: unknown
  builderIdentity?: unknown
  buildProfile?: unknown
  state?: unknown
  artifact?: unknown
  failureCode?: unknown
  failureSummary?: unknown
}

export class DeveloperBuildCoordinator {
  constructor(private readonly db: ModulaDb) {}

  async authenticate(serviceId: string, signature: string, payload: unknown) {
    if (!serviceId || !signature) forbidden('Build service identity and signature are required')
    const service = await this.db.selectFrom('greenfield_build_service_registrations').selectAll()
      .where('service_id', '=', serviceId).where('state', '=', 'ACTIVE').executeTakeFirst()
    if (!service) forbidden('Build service identity is not active')
    let valid = false
    try {
      valid = verify(null, Buffer.from(canonicalJsonStringify(payload)), createPublicKey(service.public_key_pem), Buffer.from(signature, 'base64url'))
    } catch {}
    if (!valid) forbidden('Build service signature is invalid')
    await this.db.updateTable('greenfield_build_service_registrations').set({last_health_at: new Date(), updated_at: new Date()}).where('service_id', '=', serviceId).execute()
    return service
  }

  async claim(serviceId: string, input: ClaimInput) {
    const requestId = requiredText(input.requestId, 160, 'Request ID is required')
    const maxBuilds = boundedInteger(input.maxBuilds, 1, 10, 1)
    const leaseSeconds = boundedInteger(input.leaseSeconds, 30, 900, 300)
    const payloadHash = sha256(canonicalJsonStringify(input))
    const now = new Date()
    const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1_000)
    return this.db.transaction().execute(async trx => {
      const accepted = await trx.insertInto('greenfield_build_claim_requests').values({service_id: serviceId, request_id: requestId, payload_sha256: payloadHash, response: sql<unknown>`'[]'::jsonb`, claimed_at: now}).onConflict(oc => oc.columns(['service_id', 'request_id']).doNothing()).returning('request_id').executeTakeFirst()
      if (!accepted) {
        const replay = await trx.selectFrom('greenfield_build_claim_requests').select(['payload_sha256', 'response']).where('service_id', '=', serviceId).where('request_id', '=', requestId).executeTakeFirstOrThrow()
        if (replay.payload_sha256 !== payloadHash) conflict('Build claim request ID was reused with a different payload')
        return replay.response as Array<{buildId: string; productId: string; sourceRepository: string; sourceSha: string; builderIdentity: string; profile: 'modula-product-v1'; requestId: string}>
      }
      const rows = await trx.selectFrom('greenfield_developer_builds as b')
        .innerJoin('greenfield_developer_source_connections as s', 's.source_connection_id', 'b.source_connection_id')
        .select(['b.build_id', 'b.product_id', 'b.source_sha', 'b.builder_identity', 'b.request_id', 'b.attempt_count', 'b.maximum_attempts', 's.repository'])
        .where('b.state', '=', 'QUEUED').where('s.state', '=', 'ACTIVE').where(({eb, ref}) => eb('b.attempt_count', '<', ref('b.maximum_attempts')))
        .orderBy('b.created_at', 'asc').limit(maxBuilds).forUpdate().skipLocked().execute()
      for (const row of rows) {
        await trx.updateTable('greenfield_developer_builds').set({state: 'RUNNING', lease_owner: serviceId, lease_expires_at: leaseExpiresAt, started_at: now, attempt_count: row.attempt_count + 1})
          .where('build_id', '=', row.build_id).execute()
      }
      const response = rows.map(row => ({buildId: row.build_id, productId: row.product_id, sourceRepository: row.repository, sourceSha: row.source_sha, builderIdentity: row.builder_identity, profile: 'modula-product-v1' as const, requestId: row.request_id}))
      await trx.updateTable('greenfield_build_claim_requests').set({response: sql<unknown>`${JSON.stringify(response)}::jsonb`}).where('service_id', '=', serviceId).where('request_id', '=', requestId).execute()
      await new AuditRepository(trx).append('developer.build.claimed', {requestId, serviceId, buildIds: rows.map(row => row.build_id)}, {type: 'buildService', id: serviceId})
      return response
    })
  }

  async recordResult(serviceId: string, input: ResultInput) {
    const buildId = requiredText(input.buildId, 160, 'Build ID is required')
    const requestId = requiredText(input.requestId, 160, 'Request ID is required')
    const state = String(input.state)
    if (!['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(state)) invalid('Invalid build result state')
    const build = await this.db.selectFrom('greenfield_developer_builds as b')
      .innerJoin('greenfield_developer_source_connections as s', 's.source_connection_id', 'b.source_connection_id')
      .select(['b.build_id', 'b.product_id', 'b.source_sha', 'b.builder_identity', 'b.state', 'b.lease_owner', 's.repository'])
      .where('b.build_id', '=', buildId).executeTakeFirst()
    if (!build) notFound('Build not found')
    if (build.state !== 'RUNNING' || build.lease_owner !== serviceId) conflict('Build is not leased to this service')

    let acceptedState: 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'QUARANTINED' = state as any
    let failureCode = safeCode(input.failureCode)
    const failureSummary = optionalText(input.failureSummary, 500) || null
    const artifact = objectValue(input.artifact)
    const identityMatches = input.productId === build.product_id && input.sourceRepository === build.repository && input.sourceSha === build.source_sha && input.builderIdentity === build.builder_identity && input.buildProfile === 'modula-product-v1'
    let provenance: ReturnType<typeof parseArtifact> | null = null
    if (state === 'SUCCEEDED') {
      try { provenance = parseArtifact(artifact) } catch { provenance = null }
      if (!identityMatches || !provenance || !(await this.verifyProvenance(serviceId, build, provenance))) {
        acceptedState = 'QUARANTINED'
        failureCode = 'PROVENANCE_INVALID'
      }
    }
    const payloadHash = sha256(canonicalJsonStringify(input))
    const now = new Date()
    return this.db.transaction().execute(async trx => {
      await trx.insertInto('greenfield_build_result_receipts').values({receipt_id: uuidv7(), build_id: buildId, service_id: serviceId, payload_sha256: payloadHash, service_signature_verified: true, result_state: acceptedState, failure_code: failureCode, received_at: now}).execute()
      if (acceptedState === 'SUCCEEDED' && provenance) {
        await trx.insertInto('greenfield_build_provenance').values({build_id: buildId, service_id: serviceId, signing_key_id: provenance.signingKeyId, source_repository: build.repository, source_sha: build.source_sha, builder_identity: build.builder_identity, build_profile: 'modula-product-v1', artifact_sha256: provenance.artifactSha256, manifest_sha256: provenance.manifestSha256, sbom_sha256: provenance.sbomSha256, licence_inventory_sha256: provenance.licenceInventorySha256, signature: provenance.provenanceSignature, signature_verified: true, verified_at: now, created_at: now}).execute()
      }
      await trx.updateTable('greenfield_developer_builds').set({state: acceptedState, artifact_ref: provenance?.artifactReference ?? null, artifact_sha256: provenance?.artifactSha256 ?? null, manifest_sha256: provenance?.manifestSha256 ?? null, sbom_ref: provenance?.sbomReference ?? null, sbom_sha256: provenance?.sbomSha256 ?? null, licence_inventory_ref: provenance?.licenceInventoryReference ?? null, provenance_ref: provenance?.provenanceReference ?? null, provenance_signature: provenance?.provenanceSignature ?? null, failure_code: failureCode, failure_summary: failureSummary, lease_owner: null, lease_expires_at: null, finished_at: now}).where('build_id', '=', buildId).execute()
      await new AuditRepository(trx).append('developer.build.result.recorded', {requestId, serviceId, state: acceptedState, failureCode, payloadHash}, {type: 'developerBuild', id: buildId})
      return {buildId, state: acceptedState, provenanceVerified: acceptedState === 'SUCCEEDED'}
    })
  }

  private async verifyProvenance(serviceId: string, build: {build_id: string; product_id: string; source_sha: string; builder_identity: string; repository: string}, artifact: ReturnType<typeof parseArtifact>) {
    const service = await this.db.selectFrom('greenfield_build_service_registrations').selectAll().where('service_id', '=', serviceId).where('state', '=', 'ACTIVE').executeTakeFirst()
    if (!service || artifact.signingKeyId !== service.signing_key_id) return false
    const statement = {schemaVersion: '1.0.0', buildId: build.build_id, productId: build.product_id, sourceRepository: build.repository, sourceSha: build.source_sha, builderIdentity: build.builder_identity, buildProfile: 'modula-product-v1', artifactSha256: artifact.artifactSha256, manifestSha256: artifact.manifestSha256, sbomSha256: artifact.sbomSha256, licenceInventorySha256: artifact.licenceInventorySha256, signingKeyId: artifact.signingKeyId}
    try { return verify(null, Buffer.from(canonicalJsonStringify(statement)), createPublicKey(service.public_key_pem), Buffer.from(artifact.provenanceSignature, 'base64url')) } catch { return false }
  }
}

function parseArtifact(value: Record<string, unknown>) {
  return {
    artifactReference: requiredText(value.artifactReference, 1_000, 'Artifact reference is required'),
    artifactSha256: sha(value.artifactSha256), manifestSha256: sha(value.manifestSha256),
    sbomReference: requiredText(value.sbomReference, 1_000, 'SBOM reference is required'), sbomSha256: sha(value.sbomSha256),
    licenceInventoryReference: requiredText(value.licenceInventoryReference, 1_000, 'Licence inventory reference is required'),
    licenceInventorySha256: sha(value.licenceInventorySha256),
    provenanceReference: requiredText(value.provenanceReference, 1_000, 'Provenance reference is required'),
    provenanceSignature: requiredText(value.provenanceSignature, 2_000, 'Provenance signature is required'),
    signingKeyId: requiredText(value.signingKeyId, 200, 'Signing key ID is required'),
  }
}
function sha(value: unknown) { const text = String(value ?? ''); if (!/^[0-9a-f]{64}$/.test(text)) invalid('Invalid SHA-256 digest'); return text }
function sha256(value: string) { return createHash('sha256').update(value).digest('hex') }
function requiredText(value: unknown, max: number, message: string) { const text = typeof value === 'string' ? value.trim() : ''; if (!text || text.length > max) invalid(message); return text }
function optionalText(value: unknown, max: number) { const text = typeof value === 'string' ? value.trim() : ''; return text.length <= max ? text : '' }
function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function boundedInteger(value: unknown, min: number, max: number, fallback: number) { const number = Number(value ?? fallback); if (!Number.isInteger(number) || number < min || number > max) invalid('Invalid bounded integer'); return number }
function safeCode(value: unknown) { const text = typeof value === 'string' ? value.trim() : ''; return /^[A-Z][A-Z0-9_]{1,80}$/.test(text) ? text : null }
function invalid(message: string): never { throw Object.assign(new Error(message), {code: 'VALIDATION_FAILED'}) }
function forbidden(message: string): never { throw Object.assign(new Error(message), {code: 'FORBIDDEN'}) }
function conflict(message: string): never { throw Object.assign(new Error(message), {code: 'CONFLICT'}) }
function notFound(message: string): never { throw Object.assign(new Error(message), {code: 'NOT_FOUND'}) }
