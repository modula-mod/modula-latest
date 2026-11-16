import {createPublicKey, randomUUID, verify} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {sql} from 'kysely'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {
  approvalFactsSha256,
  buildPublisherReleaseApprovalFacts,
  statementBytes,
  statementSha256,
  type PublisherReleaseStatement,
} from '../src/modules/release-signing.js'
import {enqueueReleaseJobWork, RELEASE_JOB_PUBLISH, RELEASE_JOB_SIGN} from '../src/publisher/release-job-core.js'
import {RestrictedPublisherPublicationAuthority} from '../src/publisher/restricted-publication-authority.js'
import {RestrictedPublisherSigningRunner} from '../src/publisher/restricted-signing-runner.js'
import {RestrictedPublisherTrustVerifier} from '../src/publisher/restricted-trust-verifier.js'
import {DisposableEd25519SigningProvider} from '../src/publisher/signing-provider.js'
import {adapterManifest} from './helpers/registry-fixtures.js'

const adminUrl = process.env.MODULA_TEST_DATABASE_URL
const runnerUrl = process.env.MODULA_SIGNING_RUNNER_DATABASE_URL
const approverUrl = process.env.MODULA_RELEASE_APPROVER_DATABASE_URL
const verifierUrl = process.env.MODULA_TRUST_VERIFIER_DATABASE_URL
const publicationUrl = process.env.MODULA_PUBLICATION_AUTHORITY_DATABASE_URL
const describeDb = adminUrl && runnerUrl && approverUrl && verifierUrl && publicationUrl ? describe : describe.skip

describe('migration 092 static security boundary', () => {
  it('contains no backend, statistics, or session-variable authorization', async () => {
    const migration = await readFile(new URL('../migrations/092_publisher_release_runner_boundary.sql', import.meta.url), 'utf8')
    expect(migration).not.toMatch(/pg_stat_activity|pg_backend_pid|backend_start|set_config\s*\(|current_setting\s*\(/i)
    expect(migration).toContain('pg_current_xact_id()')
    expect(migration).toContain('signing claim must be completed or failed in the transaction that created it')
  })

  it('grants the runner fixed operations and no table DML', async () => {
    const grants = await readFile(new URL('../../../ops/security/publisher-release-runner-grants.sql', import.meta.url), 'utf8')
    expect(grants).toContain('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"runner_role"')
    expect(grants).toContain('greenfield_signing_runner_claim')
    expect(grants).toContain('greenfield_signing_runner_submit_signature')
    expect(grants).not.toMatch(/GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|ALL)[^;]*\b(?:background_jobs|greenfield_module_releases|greenfield_publishers|greenfield_publisher_signing_audit_events)\b/i)
  })
})

describeDb('migration 092 canonical-role PostgreSQL boundary', () => {
  let admin: ModulaDb
  let runner: ModulaDb
  let runnerPeer: ModulaDb
  let approver: ModulaDb
  let verifierDb: ModulaDb
  let publication: ModulaDb
  const provider = new DisposableEd25519SigningProvider({allowInsecureTestProvider: true})
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
  const builderId = `r2-builder-${suffix}`
  const namespace = `r2${suffix}.modula`
  const publisherId = `${namespace}.publisher`
  const moduleId = `${namespace}.release`
  const version = `1.0.${Number.parseInt(suffix.slice(0, 4), 16)}`
  const repository = `r2-boundary/release-${suffix}`
  const releaseTag = `release-${version}`
  const sourceCommit = '1'.repeat(40)
  const artifactSha256 = '2'.repeat(64)
  const keyId = `r2-key-${suffix}`
  const providerKeyRef = `test/${suffix}`
  const identityId = `psi_${randomUUID()}`
  const authorizationId = `psa_${randomUUID()}`
  const jobId = `prj_${randomUUID()}`
  const signingRequestId = `psr_${randomUUID()}`
  let releaseId: string
  let queueJobId: string
  let approvalSha256: string

  const denied = async (operation: () => Promise<unknown>) => {
    await expect(operation()).rejects.toMatchObject({code: '42501'})
  }

  beforeAll(async () => {
    admin = createDb(adminUrl!, undefined, {applicationName: 'r2-boundary-admin'})
    runner = createDb(runnerUrl!, undefined, {max: 1, applicationName: 'r2-boundary-runner-one-slot'})
    runnerPeer = createDb(runnerUrl!, undefined, {max: 1, applicationName: 'r2-boundary-runner-peer'})
    approver = createDb(approverUrl!, undefined, {max: 1, applicationName: 'r2-boundary-approver'})
    verifierDb = createDb(verifierUrl!, undefined, {max: 1, applicationName: 'r2-boundary-verifier'})
    publication = createDb(publicationUrl!, undefined, {max: 1, applicationName: 'r2-boundary-publication'})
    const now = new Date()
    await admin.insertInto('greenfield_accounts').values({account_id: builderId, primary_handle: `r2${suffix}`, status: 'active', created_at: now, updated_at: now}).execute()
    await admin.insertInto('greenfield_publishers').values({
      publisher_id: publisherId, display_name: 'R2 boundary publisher', website: null,
      status: 'verified', trust_level: 'verifiedPublisher', created_at: now, updated_at: now,
      verified_at: now, suspended_at: null, revoked_at: null,
    }).execute()
    await admin.insertInto('greenfield_publisher_namespaces').values({
      namespace, publisher_id: publisherId, verification_method: 'disposable-test',
      verification_evidence: {fixture: 'GF-SIGNER-08A-R2'}, verified_at: now,
      revoked_at: null, created_at: now,
    }).execute()
    const manifest = adapterManifest(moduleId, version, {
      publisher: {publisherId, displayName: 'R2 boundary publisher'},
      source: {provider: 'github', repository, commit: sourceCommit, manifestPath: 'module.manifest.json', releaseTag, releaseAssetName: `${moduleId}-${version}.tgz`},
      license: {status: 'verified', evidenceIds: ['r2-boundary']},
      trust: {requestedLevel: 'verifiedPublisher'},
    })
    const release = await new GreenfieldModuleReleaseService(admin).importPendingReview(manifest, {
      repository, releaseTag, releaseCommit: sourceCommit, artifactSha256,
    })
    releaseId = release.releaseId
    await admin.insertInto('greenfield_developer_products').values({
      product_id: moduleId, publisher_id: publisherId, owner_account_id: builderId,
      owner_organisation_id: null, extension_id: moduleId, kind: 'module', display_name: moduleId,
      description: 'R2 boundary fixture', visibility: 'PRIVATE', state: 'ACTIVE', created_at: now, updated_at: now,
    }).execute()
    const publicKey = provider.createIdentity({providerKeyRef})
    await admin.insertInto('greenfield_publisher_signing_keys').values({
      key_id: keyId, publisher_id: publisherId, algorithm: 'Ed25519', public_key_pem: publicKey.publicKeyPem,
      fingerprint: publicKey.fingerprint, state: 'ACTIVE', valid_from: new Date(now.getTime() - 60_000),
      valid_until: new Date(now.getTime() + 3_600_000), revoked_at: null, revocation_reason: null,
      created_at: now, updated_at: now,
    } as never).execute()
    await admin.insertInto('greenfield_publisher_online_signing_identities').values({
      identity_id: identityId, publisher_id: publisherId, signing_key_id: keyId, provider: 'DISPOSABLE_TEST',
      provider_key_ref: providerKeyRef, purpose: 'PUBLISHER', state: 'ACTIVE', first_party_authorized: false,
      valid_from: new Date(now.getTime() - 60_000), valid_until: new Date(now.getTime() + 3_600_000),
      suspended_at: null, suspension_reason: null, revoked_at: null, revocation_reason: null,
      created_by_account_id: builderId, created_at: now, updated_at: now,
    }).execute()
    await admin.insertInto('greenfield_publisher_signing_authorizations').values({
      authorization_id: authorizationId, publisher_id: publisherId, product_id: moduleId, account_id: builderId,
      state: 'ACTIVE', first_party_authorized: false, valid_from: new Date(now.getTime() - 60_000),
      valid_until: new Date(now.getTime() + 3_600_000), granted_by_account_id: builderId,
      suspended_at: null, revoked_at: null, reason: 'disposable boundary test', created_at: now, updated_at: now,
    }).execute()
    const approvalFacts = buildPublisherReleaseApprovalFacts({manifest, sourceSha: sourceCommit, artifactSha256})
    approvalSha256 = approvalFactsSha256(approvalFacts)
    await admin.insertInto('greenfield_publisher_release_jobs').values({
      job_id: jobId, module_id: moduleId, publisher_id: publisherId, created_by_account_id: builderId,
      source_repository: repository, release_tag: releaseTag, source_commit: sourceCommit, version, channel: 'stable',
      artifact_sha256: artifactSha256, release_id: releaseId, state: 'awaiting_approval', cancelled_from_state: null,
      preview: {}, signature: {state: 'pending'}, validation: {passed: true, checks: []}, permission_delta: null,
      permission_change_acknowledged: false, approval_candidate_facts: approvalFacts,
      approval_candidate_sha256: approvalSha256, approval_candidate_at: now, approved_facts: null,
      approval_sha256: null, approved_at: null, approved_by_account_id: null, approval_invalidated_at: null,
      approval_invalidated_by_account_id: null, approval_invalidation_reason: null, signing_request_id: null,
      signing_idempotency_key: null, sign_requested_by_account_id: null, signing_identity_id: null,
      signing_started_at: null, signed_at: null, signing_receipt: null, error: null, idempotency_key: null,
      publish_requested_by_account_id: null, publish_started_at: null, publication_authorized_by_account_id: null,
      publication_authorized_at: null, revision: 1, created_at: now, updated_at: now, published_at: null, cancelled_at: null,
    } as never).execute()
    const approved = await sql<{greenfield_release_approver_record: string}>`
      SELECT greenfield_release_approver_record(${jobId}, ${approvalSha256})
    `.execute(approver)
    expect(approved.rows[0]?.greenfield_release_approver_record).toBe(approvalSha256)
    await admin.updateTable('greenfield_publisher_release_jobs').set({
      state: 'signing', signing_request_id: signingRequestId, sign_requested_by_account_id: builderId,
    } as never).where('job_id', '=', jobId).execute()
    queueJobId = await enqueueReleaseJobWork(admin, {jobId, workType: RELEASE_JOB_SIGN, accountId: builderId, moduleId})
  }, 60_000)

  afterAll(async () => {
    await Promise.all([admin, runner, runnerPeer, approver, verifierDb, publication].filter(Boolean).map(db => db.destroy()))
  })

  it('denies arbitrary runner SQL across queue, governance, registry, and audit tables', async () => {
    const privileges = await sql<{queue_insert: boolean; job_update: boolean; publisher_update: boolean; audit_insert: boolean}>`
      SELECT
        has_table_privilege(current_user, 'background_jobs', 'INSERT') AS queue_insert,
        has_table_privilege(current_user, 'greenfield_publisher_release_jobs', 'UPDATE') AS job_update,
        has_table_privilege(current_user, 'greenfield_publishers', 'UPDATE') AS publisher_update,
        has_table_privilege(current_user, 'greenfield_publisher_signing_audit_events', 'INSERT') AS audit_insert
    `.execute(runner)
    expect(privileges.rows[0]).toEqual({queue_insert: false, job_update: false, publisher_update: false, audit_insert: false})
    await denied(() => sql`INSERT INTO background_jobs (id, job_type, payload, status, action, trace_id) VALUES (${`forged-${suffix}`}, 'mail.send', '{}'::jsonb, 'QUEUED', 'mail.send', 'forged')`.execute(runner))
    await denied(() => sql`UPDATE greenfield_publisher_release_jobs SET approved_facts = '{}'::jsonb, approval_sha256 = ${'9'.repeat(64)} WHERE job_id = ${jobId}`.execute(runner))
    await denied(() => sql`UPDATE greenfield_publisher_release_jobs SET state = 'published', publish_requested_by_account_id = ${builderId}, release_id = 'forged' WHERE job_id = ${jobId}`.execute(runner))
    await denied(() => sql`UPDATE greenfield_publisher_release_jobs SET created_by_account_id = 'forged', source_commit = ${'8'.repeat(40)} WHERE job_id = ${jobId}`.execute(runner))
    await denied(() => sql`UPDATE greenfield_publishers SET trust_level = 'firstParty' WHERE publisher_id = ${publisherId}`.execute(runner))
    await denied(() => sql`UPDATE greenfield_publishers SET trust_level = 'firstParty' WHERE publisher_id = 'modula'`.execute(runner))
    await denied(() => sql`UPDATE greenfield_module_releases SET source_commit = ${'7'.repeat(40)}, release_sha256 = ${'6'.repeat(64)}, trust_level = 'firstParty' WHERE release_id = ${releaseId}`.execute(runner))
    await denied(() => sql`UPDATE greenfield_module_releases SET release_state = 'published', published_at = NOW() WHERE release_id = ${releaseId}`.execute(runner))
    await denied(() => sql`UPDATE greenfield_extension_catalogue SET trust = 'firstParty', publisher = 'modula' WHERE extension_id = ${moduleId}`.execute(runner))
    await denied(() => sql`UPDATE greenfield_developer_products SET state = 'ACTIVE', owner_account_id = ${builderId} WHERE product_id = ${moduleId}`.execute(runner))
    await denied(() => sql`UPDATE greenfield_module_release_signatures SET verification_state = 'verified', verified_at = NOW() WHERE release_id = ${releaseId}`.execute(runner))
    await denied(() => sql`INSERT INTO greenfield_publisher_signing_audit_events (
      event_id, event_type, job_id, publisher_id, actor_account_id, receipt, details, created_at
    ) VALUES (
      ${`psae_${randomUUID()}`}, 'publication_authorized', ${jobId}, ${publisherId}, ${builderId},
      '{"forged":true}'::jsonb, '{"authorization":"forged"}'::jsonb, '2000-01-01'
    )`.execute(runner))
    await denied(() => sql`UPDATE greenfield_publisher_signing_audit_events SET event_type = 'publication_authorized' WHERE job_id = ${jobId}`.execute(runner))
    await denied(() => sql`DELETE FROM greenfield_publisher_signing_audit_events WHERE job_id = ${jobId}`.execute(runner))
  })

  it('owns fixed functions with a non-superuser, fixed search path, and no PUBLIC execute', async () => {
    const functions = await sql<{
      proname: string; owner: string; owner_super: boolean; security_definer: boolean;
      search_path: string[] | null; public_execute: boolean;
    }>`
      SELECT proc.proname,
        owner.rolname AS owner,
        owner.rolsuper AS owner_super,
        proc.prosecdef AS security_definer,
        proc.proconfig AS search_path,
        has_function_privilege('public', proc.oid, 'EXECUTE') AS public_execute
      FROM pg_proc AS proc
      JOIN pg_roles AS owner ON owner.oid = proc.proowner
      WHERE proc.pronamespace = 'public'::regnamespace
        AND proc.proname IN (
          'greenfield_signing_runner_claim',
          'greenfield_signing_runner_submit_signature',
          'greenfield_signing_runner_fail',
          'greenfield_trust_verifier_claim',
          'greenfield_trust_verifier_record',
          'greenfield_publication_authority_publish',
          'greenfield_publication_authority_publish_next'
        )
      ORDER BY proc.proname
    `.execute(admin)
    expect(functions.rows).toHaveLength(7)
    for (const fn of functions.rows) expect(fn).toMatchObject({
      owner: 'modula_migrator', owner_super: false, security_definer: true,
      search_path: ['search_path=pg_catalog'], public_execute: false,
    })
    const stats = await sql<{stats_member: boolean}>`
      SELECT pg_has_role(current_user, 'pg_read_all_stats', 'MEMBER') AS stats_member
    `.execute(runner)
    expect(stats.rows[0]).toEqual({stats_member: false})
  })

  it('reproduces the rejected SECURITY DEFINER pg_stat_activity visibility defect without granting statistics access', async () => {
    await sql.raw(`
      CREATE FUNCTION r2_rejected_stats_visibility_probe(requested_pid INTEGER)
      RETURNS BOOLEAN
      LANGUAGE SQL
      SECURITY DEFINER
      SET search_path = pg_catalog
      AS $$
        SELECT COALESCE((
          SELECT backend_start IS NOT NULL
          FROM pg_catalog.pg_stat_activity
          WHERE pid = requested_pid
        ), FALSE)
      $$
    `).execute(admin)
    try {
      await sql.raw('REVOKE ALL ON FUNCTION r2_rejected_stats_visibility_probe(INTEGER) FROM PUBLIC').execute(admin)
      await sql.raw('GRANT EXECUTE ON FUNCTION r2_rejected_stats_visibility_probe(INTEGER) TO r2_signing_runner').execute(admin)
      const result = await sql<{stats_visible: boolean}>`
        SELECT r2_rejected_stats_visibility_probe(pg_backend_pid()) AS stats_visible
      `.execute(runner)
      expect(result.rows[0]).toEqual({stats_visible: false})
      const membership = await sql<{stats_member: boolean}>`
        SELECT pg_has_role(current_user, 'pg_read_all_stats', 'MEMBER') AS stats_member
      `.execute(runner)
      expect(membership.rows[0]).toEqual({stats_member: false})
    } finally {
      await sql.raw('DROP FUNCTION r2_rejected_stats_visibility_probe(INTEGER)').execute(admin)
    }
  })

  it('does not retain or transfer a claim across commit, rollback, reborrow, or another connection', async () => {
    await expect(sql`SELECT * FROM greenfield_signing_runner_claim('r2-autocommit', 600000)`.execute(runner)).rejects.toThrow(/must be completed or failed/i)
    await sql`SET application_name = 'attacker-selected-context'`.execute(runner)
    await expect(sql`SELECT greenfield_signing_runner_submit_signature(${queueJobId}, ${'A'.repeat(86)}, ${'3'.repeat(64)}, NULL)`.execute(runner)).rejects.toMatchObject({code: 'P0002'})

    class RollbackProbe extends Error {}
    await expect(runner.transaction().execute(async trx => {
      const claim = await sql<{release_job_id: string}>`SELECT release_job_id FROM greenfield_signing_runner_claim('r2-connection-a', 600000)`.execute(trx)
      expect(claim.rows).toEqual([{release_job_id: jobId}])
      const competing = await sql`SELECT * FROM greenfield_signing_runner_claim('r2-connection-b', 600000)`.execute(runnerPeer)
      expect(competing.rows).toEqual([])
      await expect(sql`SELECT greenfield_signing_runner_submit_signature(${queueJobId}, ${'A'.repeat(86)}, ${'3'.repeat(64)}, NULL)`.execute(runnerPeer)).rejects.toMatchObject({code: 'P0002'})
      throw new RollbackProbe()
    })).rejects.toBeInstanceOf(RollbackProbe)
    const state = await admin.selectFrom('background_jobs').select(['status', 'attempt_count']).where('id', '=', queueJobId).executeTakeFirstOrThrow()
    expect(state).toEqual({status: 'QUEUED', attempt_count: 0})
  })

  it('requires distinct database authorities even when a caller owns the tables', async () => {
    await expect(sql`UPDATE greenfield_publisher_release_jobs SET approval_sha256 = ${'4'.repeat(64)} WHERE job_id = ${jobId}`.execute(admin))
      .rejects.toMatchObject({code: '42501'})
    await expect(sql`UPDATE greenfield_publisher_release_jobs SET state = 'published' WHERE job_id = ${jobId}`.execute(admin))
      .rejects.toMatchObject({code: '42501'})
  })

  it('rolls an expired claim back without settling or transferring its authority', async () => {
    await expect(runner.transaction().execute(async trx => {
      await sql`SELECT * FROM greenfield_signing_runner_claim('r2-expiry-probe', 1000)`.execute(trx)
      await new Promise(resolve => setTimeout(resolve, 1_050))
      await sql`SELECT greenfield_signing_runner_submit_signature(
        ${queueJobId}, ${'A'.repeat(86)}, ${'3'.repeat(64)}, NULL
      )`.execute(trx)
    })).rejects.toMatchObject({code: '42501'})
    const state = await admin.selectFrom('background_jobs').select(['status', 'attempt_count']).where('id', '=', queueJobId).executeTakeFirstOrThrow()
    expect(state).toEqual({status: 'QUEUED', attempt_count: 0})
  })

  it('blocks revocation before signing, then completes the legitimate separated lifecycle', async () => {
    const revocationId = `r2-revocation-${suffix}`
    await admin.insertInto('greenfield_module_revocations').values({
      revocation_id: revocationId, scope: 'release', target_id: releaseId,
      reason: 'R2 negative test', created_by: 'test', created_at: new Date(),
    }).execute()
    const signingRunner = new RestrictedPublisherSigningRunner(runner, provider, {workerId: 'r2-positive-runner'})
    expect(await signingRunner.runOnce()).toBe(false)
    await admin.deleteFrom('greenfield_module_revocations').where('revocation_id', '=', revocationId).execute()

    expect(await signingRunner.runOnce()).toBe(true)
    const pending = await sql<{
      job_id: string; signature_id: string; statement: PublisherReleaseStatement; statement_sha256: string;
      signature: string; public_key_pem: string; public_key_fingerprint: string;
    }>`SELECT * FROM greenfield_trust_verifier_claim(${jobId})`.execute(verifierDb)
    expect(pending.rows).toHaveLength(1)
    const evidence = pending.rows[0]!
    expect(statementSha256(evidence.statement)).toBe(evidence.statement_sha256)
    expect(verify(null, statementBytes(evidence.statement), createPublicKey(evidence.public_key_pem), Buffer.from(evidence.signature, 'base64url'))).toBe(true)
    await expect(sql`UPDATE greenfield_module_release_signatures SET verification_state = 'verified', verified_at = NOW() WHERE signature_id = ${evidence.signature_id}`.execute(admin))
      .rejects.toMatchObject({code: '42501'})
    expect(await new RestrictedPublisherTrustVerifier(verifierDb).runOnce(jobId)).toBe(true)
    const verified = await admin.selectFrom('greenfield_module_release_signatures').select(['verification_state'])
      .where('signature_id', '=', evidence.signature_id).executeTakeFirstOrThrow()
    expect(verified.verification_state).toBe('verified')
    await denied(() => sql`UPDATE greenfield_module_release_signatures SET verification_state = 'verified' WHERE signature_id = ${evidence.signature_id}`.execute(runner))

    await admin.updateTable('greenfield_publisher_release_jobs').set({
      state: 'publishing', publish_requested_by_account_id: builderId, publish_started_at: new Date(),
    } as never).where('job_id', '=', jobId).execute()
    const publicationQueueId = await enqueueReleaseJobWork(admin, {jobId, workType: RELEASE_JOB_PUBLISH, accountId: builderId, moduleId})
    const publicationRunner = new RestrictedPublisherPublicationAuthority(publication)
    await admin.insertInto('greenfield_module_revocations').values({
      revocation_id: revocationId, scope: 'release', target_id: releaseId,
      reason: 'R2 publication negative test', created_by: 'test', created_at: new Date(),
    }).execute()
    await expect(publicationRunner.runOnce()).rejects.toMatchObject({code: '42501'})
    await admin.deleteFrom('greenfield_module_revocations').where('revocation_id', '=', revocationId).execute()
    expect(await publicationRunner.runOnce()).toBe(true)
    const finalJob = await admin.selectFrom('greenfield_publisher_release_jobs').select(['state', 'publication_authorized_by_account_id']).where('job_id', '=', jobId).executeTakeFirstOrThrow()
    expect(finalJob).toEqual({state: 'published', publication_authorized_by_account_id: 'r2-publication-account'})
    const publicationQueue = await admin.selectFrom('background_jobs').select(['status']).where('id', '=', publicationQueueId).executeTakeFirstOrThrow()
    expect(publicationQueue.status).toBe('SUCCEEDED')
    const fabricated = await admin.selectFrom('greenfield_publisher_signing_audit_events').select(({fn}) => fn.countAll().as('count'))
      .where('job_id', '=', jobId).where('event_type', '=', 'publication_authorized').executeTakeFirstOrThrow()
    expect(Number(fabricated.count)).toBe(1)
  }, 60_000)
})
