import type {WorkerConfig} from '../config.js'
import type {ModulaWorkerDb} from '../database.js'
import {permanentModuleJob} from './module-job-errors.js'

type ReleaseTrustFacts = {
  release_id: string
  module_id: string
  publisher_id: string
  release_state: string
  manifest_sha256: string
  release_sha256: string | null
}

/**
 * Last-line worker gate for executable release transitions. The API performs
 * the full cryptographic policy evaluation before enqueueing; this guard stops
 * stale or forged jobs from bypassing that decision at execution time.
 */
export async function assertTrustedModuleRelease(db: ModulaWorkerDb, config: WorkerConfig, release: ReleaseTrustFacts): Promise<void> {
  if (config.environment === 'development' && config.moduleAllowUntrustedDevelopmentReleases) return
  const [publisher, signature, integrity, revocation, quarantine] = await Promise.all([
    db.selectFrom('greenfield_publishers').select('status').where('publisher_id', '=', release.publisher_id).executeTakeFirst(),
    db.selectFrom('greenfield_module_release_signatures')
      .select(['signature_id', 'signature_key_id'])
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
  ])
  const signingKey = signature ? await db.selectFrom('greenfield_publisher_signing_keys')
    .select(['publisher_id', 'state', 'revoked_at'])
    .where('key_id', '=', signature.signature_key_id)
    .executeTakeFirst() : undefined
  if (!['published', 'superseded'].includes(release.release_state) || !release.release_sha256 || !release.manifest_sha256
    || publisher?.status !== 'verified' || !signature || !signingKey || signingKey.publisher_id !== release.publisher_id
    || signingKey.state === 'REVOKED' || signingKey.revoked_at || !integrity || integrity.mismatch_at || revocation || quarantine) {
    throw permanentModuleJob('UNTRUSTED_RELEASE', 'Module release is not production-trusted')
  }
}
