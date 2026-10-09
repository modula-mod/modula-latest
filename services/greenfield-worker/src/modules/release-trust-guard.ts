import type {WorkerConfig} from '../config.js'
import type {ModulaWorkerDb} from '../database.js'
import {permanentModuleJob} from './module-job-errors.js'

type ReleaseTrustFacts = {
  release_id: string
  module_id: string
  version: string
  publisher_id: string
  release_state: string
  manifest_sha256: string
  release_sha256: string | null
  source_repository: string
  source_commit: string
}

/**
 * Last-line worker gate for executable release transitions. The API performs
 * the full cryptographic policy evaluation before enqueueing; this guard stops
 * stale or forged jobs from bypassing that decision at execution time.
 */
export async function assertTrustedModuleRelease(db: ModulaWorkerDb, config: WorkerConfig, release: ReleaseTrustFacts): Promise<void> {
  if (config.environment === 'development' && config.moduleAllowUntrustedDevelopmentReleases) return
  const [publisher, signature, integrity, revocation, quarantine, ingestion, frontend, source] = await Promise.all([
    db.selectFrom('greenfield_publishers').select('status').where('publisher_id', '=', release.publisher_id).executeTakeFirst(),
    db.selectFrom('greenfield_module_release_signatures')
      .select(['signature_id', 'signature_key_id', 'statement'])
      .where('release_id', '=', release.release_id)
      .where('verification_state', '=', 'verified')
      .where('verified_at', 'is not', null)
      .where('revoked_at', 'is', null)
      .executeTakeFirst(),
    db.selectFrom('greenfield_module_release_integrity').select('mismatch_at').where('release_id', '=', release.release_id).executeTakeFirst(),
    db.selectFrom('greenfield_module_revocations').select('revocation_id')
      .where(eb => eb.or([
        eb.and([eb('scope', '=', 'release'), eb('target_id', '=', release.release_id)]),
        eb.and([eb('scope', '=', 'module'), eb('target_id', '=', release.module_id)]),
        eb.and([eb('scope', '=', 'publisher'), eb('target_id', '=', release.publisher_id)]),
      ]))
      .executeTakeFirst(),
    db.selectFrom('greenfield_module_quarantines').select('quarantine_id')
      .where('release_id', '=', release.release_id)
      .where('lifted_at', 'is', null)
      .executeTakeFirst(),
    db.selectFrom('greenfield_mps_ingestions').select('manifest_sha256')
      .where('release_id', '=', release.release_id).executeTakeFirst(),
    db.selectFrom('greenfield_release_frontends').select('artifact_sha256')
      .where('release_id', '=', release.release_id).executeTakeFirst(),
    db.selectFrom('greenfield_module_sources').select('release_tag')
      .where('release_id', '=', release.release_id).executeTakeFirst(),
  ])
  const signingKey = signature ? await db.selectFrom('greenfield_publisher_signing_keys')
    .select(['publisher_id', 'state', 'revoked_at'])
    .where('key_id', '=', signature.signature_key_id)
    .executeTakeFirst() : undefined
  const statement = signature?.statement && typeof signature.statement === 'object' && !Array.isArray(signature.statement)
    ? signature.statement as Record<string, unknown>
    : null
  if (!['published', 'superseded'].includes(release.release_state) || !release.release_sha256 || !release.manifest_sha256
    || publisher?.status !== 'verified' || !signature || !signingKey || signingKey.publisher_id !== release.publisher_id
    || !['ACTIVE', 'ROTATED'].includes(signingKey.state) || signingKey.revoked_at || !integrity || integrity.mismatch_at || revocation || quarantine
    || !statement || !source || statement.schemaVersion !== '1.0.0'
    || statement.statementType !== 'modula.publisher-release.v1'
    || statement.productId !== release.module_id || statement.version !== release.version
    || statement.publisherId !== release.publisher_id || statement.sourceRepository !== release.source_repository
    || statement.sourceSha !== release.source_commit || statement.releaseTag !== source.release_tag
    || statement.artifactSha256 !== release.release_sha256 || statement.manifestSha256 !== release.manifest_sha256
    || statement.signingKeyId !== signature.signature_key_id
    || (statement.productManifestSha256 ?? null) !== (ingestion?.manifest_sha256 ?? null)
    || (statement.frontendSha256 ?? null) !== (frontend?.artifact_sha256 ?? null)) {
    throw permanentModuleJob('UNTRUSTED_RELEASE', 'Module release is not production-trusted')
  }
}
