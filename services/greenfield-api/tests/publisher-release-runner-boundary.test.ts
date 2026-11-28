import {createPublicKey, randomUUID, verify} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {sql} from 'kysely'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateDown} from '../src/database/migrate.js'
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
const superuserUrl = process.env.MODULA_TEST_DATABASE_ADMIN_URL
const runnerUrl = process.env.MODULA_SIGNING_RUNNER_DATABASE_URL
const approverUrl = process.env.MODULA_RELEASE_APPROVER_DATABASE_URL
const verifierUrl = process.env.MODULA_TRUST_VERIFIER_DATABASE_URL
const publicationUrl = process.env.MODULA_PUBLICATION_AUTHORITY_DATABASE_URL
const publisherTrustUrl = process.env.MODULA_PUBLISHER_TRUST_AUTHORITY_DATABASE_URL
const signingIdentityUrl = process.env.MODULA_SIGNING_IDENTITY_AUTHORITY_DATABASE_URL
const quarantineAuthorityUrl = process.env.MODULA_QUARANTINE_AUTHORITY_DATABASE_URL
const revocationAuthorityUrl = process.env.MODULA_REVOCATION_AUTHORITY_DATABASE_URL
const apiUrl = process.env.MODULA_API_DATABASE_URL
const workerUrl = process.env.MODULA_WORKER_DATABASE_URL
const describeDb = adminUrl && superuserUrl && runnerUrl && approverUrl && verifierUrl && publicationUrl && publisherTrustUrl
  && signingIdentityUrl && quarantineAuthorityUrl && revocationAuthorityUrl && apiUrl && workerUrl ? describe : describe.skip

describe('publisher signing governance static security boundary', () => {
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
    expect(grants).toContain('greenfield_publisher_trust_authority_set')
    expect(grants).toContain('greenfield_signing_identity_authority_register')
    expect(grants).toContain('greenfield_signing_identity_authority_rotate')
    expect(grants).toContain('greenfield_signing_identity_authority_revoke')
    expect(grants).toContain('greenfield_quarantine_authority_record')
    expect(grants).toContain('greenfield_quarantine_authority_lift')
    expect(grants).toContain('greenfield_revocation_authority_record')
    expect(grants).toContain('greenfield_assert_publisher_authority_role_isolation')
    expect(grants).not.toMatch(/GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|ALL)[^;]*\b(?:background_jobs|greenfield_module_releases|greenfield_publishers|greenfield_publisher_signing_audit_events)\b/i)
  })

  it('makes 093 a forward-only database-boundary correction', async () => {
    const migration = await readFile(new URL('../migrations/093_publisher_release_governance_integrity.sql', import.meta.url), 'utf8')
    expect(migration).toContain('greenfield_publisher_identity_registration_transitions')
    expect(migration).toContain('greenfield_module_revocation_history_guard')
    expect(migration).toContain('greenfield_module_quarantine_history_guard')
    expect(migration).toContain('catalogue publication requires one exact authoritative release')
    expect(migration).not.toMatch(/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE)[^;]*TO\s+(?:modula_api|modula_worker)/i)
  })

  it('makes 093 through 095 automated downgrades fail closed', async () => {
    const migration = await readFile(new URL('../migrations/094_publisher_signing_governance_hardening.sql', import.meta.url), 'utf8')
    const completion = await readFile(new URL('../migrations/095_publisher_signing_integration_completion.sql', import.meta.url), 'utf8')
    const down093 = await readFile(new URL('../migrations/093_publisher_release_governance_integrity.down.sql', import.meta.url), 'utf8')
    const down094 = await readFile(new URL('../migrations/094_publisher_signing_governance_hardening.down.sql', import.meta.url), 'utf8')
    const down095 = await readFile(new URL('../migrations/095_publisher_signing_integration_completion.down.sql', import.meta.url), 'utf8')
    expect(migration).toContain('greenfield_signing_key_integrity_guard')
    expect(migration).toContain('greenfield_revocation_authority_record')
    expect(migration).toContain('greenfield_quarantine_authority_record')
    expect(migration).toContain('greenfield_assert_publisher_authority_role_isolation')
    expect(completion).toContain('pg_advisory_xact_lock')
    expect(down093).toMatch(/unsafe automated downgrade of 093 is prohibited/i)
    expect(down094).toMatch(/unsafe automated downgrade of 094 is prohibited/i)
    expect(down095).toMatch(/unsafe automated downgrade of 095 is prohibited/i)
    expect(down093).not.toMatch(/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE)/i)
    expect(down094).not.toMatch(/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE)/i)
    expect(down095).not.toMatch(/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE)/i)
  })
})

describeDb('publisher signing governance canonical-role PostgreSQL boundary through 100', () => {
  let admin: ModulaDb
  let superuser: ModulaDb
  let runner: ModulaDb
  let runnerPeer: ModulaDb
  let approver: ModulaDb
  let verifierDb: ModulaDb
  let publication: ModulaDb
  let publisherTrust: ModulaDb
  let signingIdentity: ModulaDb
  let quarantineAuthority: ModulaDb
  let revocationAuthority: ModulaDb
  let revocationAuthorityPeer: ModulaDb
  let api: ModulaDb
  let worker: ModulaDb
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
  let identityId: string
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
    superuser = createDb(superuserUrl!, undefined, {applicationName: 'r3a3-boundary-superuser'})
    runner = createDb(runnerUrl!, undefined, {max: 1, applicationName: 'r2-boundary-runner-one-slot'})
    runnerPeer = createDb(runnerUrl!, undefined, {max: 1, applicationName: 'r2-boundary-runner-peer'})
    approver = createDb(approverUrl!, undefined, {max: 1, applicationName: 'r2-boundary-approver'})
    verifierDb = createDb(verifierUrl!, undefined, {max: 1, applicationName: 'r2-boundary-verifier'})
    publication = createDb(publicationUrl!, undefined, {max: 1, applicationName: 'r2-boundary-publication'})
    publisherTrust = createDb(publisherTrustUrl!, undefined, {max: 1, applicationName: 'r3a-publisher-trust'})
    signingIdentity = createDb(signingIdentityUrl!, undefined, {max: 1, applicationName: 'r3a2-signing-identity'})
    quarantineAuthority = createDb(quarantineAuthorityUrl!, undefined, {max: 1, applicationName: 'r3a2-quarantine-authority'})
    revocationAuthority = createDb(revocationAuthorityUrl!, undefined, {max: 1, applicationName: 'r3a3-revocation-authority'})
    revocationAuthorityPeer = createDb(revocationAuthorityUrl!, undefined, {max: 1, applicationName: 'r4a3-revocation-authority-peer'})
    api = createDb(apiUrl!, undefined, {max: 1, applicationName: 'r3a-api-role'})
    worker = createDb(workerUrl!, undefined, {max: 1, applicationName: 'r3a-worker-role'})
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
    const registration = await sql<{identity_id: string}>`
      SELECT greenfield_signing_identity_authority_register(
        ${publisherId}, ${keyId}, ${publicKey.publicKeyPem}, ${publicKey.fingerprint},
        'DISPOSABLE_TEST', ${providerKeyRef}, 'PUBLISHER', FALSE,
        ${new Date(now.getTime() - 60_000)}, ${new Date(now.getTime() + 3_600_000)}, NULL
      ) AS identity_id
    `.execute(signingIdentity)
    identityId = registration.rows[0]!.identity_id
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
      SELECT greenfield_release_approver_record(
        ${jobId}, ${approvalSha256}, 'automated-test-policy',
        ${`test/canonical-boundary/${suffix}`}, 'AUTOMATED_TEST_POLICY'
      )
    `.execute(approver)
    expect(approved.rows[0]?.greenfield_release_approver_record).toBe(approvalSha256)
    const approvalDecision = await sql<{
      policy_id: string
      decision_source: string
      independent_human_approval_attested: boolean
    }>`SELECT policy_id, decision_source, independent_human_approval_attested
       FROM greenfield_release_approval_decisions WHERE job_id = ${jobId}`.execute(admin)
    expect(approvalDecision.rows[0]).toMatchObject({
      policy_id: 'automated-test-policy',
      decision_source: 'AUTOMATED_TEST_POLICY',
      independent_human_approval_attested: false,
    })
    await admin.updateTable('greenfield_publisher_release_jobs').set({
      state: 'signing', signing_request_id: signingRequestId, sign_requested_by_account_id: builderId,
    } as never).where('job_id', '=', jobId).execute()
    queueJobId = await enqueueReleaseJobWork(admin, {jobId, workType: RELEASE_JOB_SIGN, accountId: builderId, moduleId})
  }, 60_000)

  afterAll(async () => {
    await Promise.all([
      admin, runner, runnerPeer, approver, verifierDb, publication, publisherTrust,
      signingIdentity, quarantineAuthority, revocationAuthority, revocationAuthorityPeer, api, worker, superuser,
    ].filter(Boolean).map(db => db.destroy()))
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
    await denied(() => sql`UPDATE greenfield_publisher_release_jobs SET approved_by_account_id = ${builderId}, state = 'ready_for_signing' WHERE job_id = ${jobId}`.execute(runner))
    await denied(() => sql`UPDATE greenfield_publisher_release_jobs SET state = 'published', publish_requested_by_account_id = ${builderId}, release_id = 'forged' WHERE job_id = ${jobId}`.execute(runner))
    await denied(() => sql`UPDATE greenfield_publisher_release_jobs SET sign_requested_by_account_id = 'forged-requester', release_id = 'forged-release' WHERE job_id = ${jobId}`.execute(runner))
    await denied(() => sql`UPDATE greenfield_publisher_release_jobs SET created_by_account_id = 'forged', source_commit = ${'8'.repeat(40)} WHERE job_id = ${jobId}`.execute(runner))
    await denied(() => sql`UPDATE greenfield_publisher_release_jobs SET signing_receipt = '{"state":"verified","forged":true}'::jsonb WHERE job_id = ${jobId}`.execute(runner))
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
    await denied(() => sql`INSERT INTO greenfield_publisher_signing_audit_events (
      event_id, event_type, job_id, publisher_id, actor_account_id, receipt, details, created_at
    ) VALUES (
      ${`psae_${randomUUID()}`}, 'signature_verified', ${jobId}, ${publisherId}, ${builderId},
      '{"verified":true,"forged":true}'::jsonb, '{"approvalActor":"impersonated"}'::jsonb, '2000-01-01'
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
          'greenfield_publication_authority_publish_next',
          'greenfield_publisher_trust_authority_set',
          'greenfield_signing_identity_authority_register',
          'greenfield_signing_identity_authority_rotate',
          'greenfield_signing_identity_authority_revoke',
          'greenfield_quarantine_authority_record',
          'greenfield_quarantine_authority_lift',
          'greenfield_revocation_authority_record'
        )
      ORDER BY proc.proname
    `.execute(admin)
    expect(functions.rows).toHaveLength(14)
    for (const fn of functions.rows) expect(fn).toMatchObject({
      owner: 'modula_migrator', owner_super: false, security_definer: true,
      search_path: ['search_path=pg_catalog'], public_execute: false,
    })
    const stats = await sql<{stats_member: boolean}>`
      SELECT pg_has_role(current_user, 'pg_read_all_stats', 'MEMBER') AS stats_member
    `.execute(runner)
    expect(stats.rows[0]).toEqual({stats_member: false})
  })

  it('removes legacy worker governance DML and blocks authority transitions through the API role', async () => {
    const workerPrivileges = await sql<{
      publisher_update: boolean; release_update: boolean; signature_update: boolean;
      audit_insert: boolean; catalogue_update: boolean; revocation_delete: boolean;
      key_update: boolean; key_event_insert: boolean; quarantine_insert: boolean;
    }>`
      SELECT
        has_table_privilege(current_user, 'greenfield_publishers', 'UPDATE') AS publisher_update,
        has_table_privilege(current_user, 'greenfield_module_releases', 'UPDATE') AS release_update,
        has_table_privilege(current_user, 'greenfield_module_release_signatures', 'UPDATE') AS signature_update,
        has_table_privilege(current_user, 'greenfield_publisher_signing_audit_events', 'INSERT') AS audit_insert,
        has_table_privilege(current_user, 'greenfield_extension_catalogue', 'UPDATE') AS catalogue_update,
        has_table_privilege(current_user, 'greenfield_module_revocations', 'DELETE') AS revocation_delete,
        has_table_privilege(current_user, 'greenfield_publisher_signing_keys', 'UPDATE') AS key_update,
        has_table_privilege(current_user, 'greenfield_publisher_signing_key_events', 'INSERT') AS key_event_insert,
        has_table_privilege(current_user, 'greenfield_module_quarantines', 'INSERT') AS quarantine_insert
    `.execute(worker)
    expect(workerPrivileges.rows[0]).toEqual({
      publisher_update: false,
      release_update: false,
      signature_update: false,
      audit_insert: false,
      catalogue_update: false,
      revocation_delete: false,
      key_update: false,
      key_event_insert: false,
      quarantine_insert: false,
    })

    const apiGovernancePrivileges = await sql<{
      key_insert: boolean; key_update: boolean; key_event_insert: boolean;
      revocation_insert: boolean; quarantine_insert: boolean;
    }>`
      SELECT
        has_table_privilege(current_user, 'greenfield_publisher_signing_keys', 'INSERT') AS key_insert,
        has_table_privilege(current_user, 'greenfield_publisher_signing_keys', 'UPDATE') AS key_update,
        has_table_privilege(current_user, 'greenfield_publisher_signing_key_events', 'INSERT') AS key_event_insert,
        has_table_privilege(current_user, 'greenfield_module_revocations', 'INSERT') AS revocation_insert,
        has_table_privilege(current_user, 'greenfield_module_quarantines', 'INSERT') AS quarantine_insert
    `.execute(api)
    expect(apiGovernancePrivileges.rows[0]).toEqual({
      key_insert: false,
      key_update: false,
      key_event_insert: false,
      revocation_insert: false,
      quarantine_insert: false,
    })

    await denied(() => sql`UPDATE greenfield_publishers SET trust_level = 'firstParty' WHERE publisher_id = ${publisherId}`.execute(api))
    await denied(() => sql`UPDATE greenfield_module_releases SET release_state = 'published', published_at = NOW() WHERE release_id = ${releaseId}`.execute(api))
    await denied(() => sql`UPDATE greenfield_module_versions SET status = 'published' WHERE module_version_id = ${`module-version:${moduleId}:${version}`}`.execute(api))
    await denied(() => sql`INSERT INTO greenfield_publisher_signing_audit_events (
      event_id, event_type, job_id, publisher_id, actor_account_id, receipt, details, created_at
    ) VALUES (
      ${`psae_${randomUUID()}`}, 'signature_verified', ${jobId}, ${publisherId}, ${builderId},
      '{}'::jsonb, '{}'::jsonb, '2000-01-01'
    )`.execute(api))
    await denied(() => sql`UPDATE greenfield_publishers SET trust_level = 'firstParty' WHERE publisher_id = ${publisherId}`.execute(worker))
  })

  it('binds identity registration evidence and actor provenance to the fixed database transition', async () => {
    const audit = await admin.selectFrom('greenfield_publisher_signing_audit_events')
      .select(['event_id', 'event_type', 'actor_account_id', 'actor_database_role', 'details', 'created_at'])
      .where('identity_id', '=', identityId)
      .where('event_type', '=', 'identity_registered')
      .executeTakeFirstOrThrow()
    expect(audit).toMatchObject({
      event_type: 'identity_registered',
      actor_account_id: 'r3a2-signing-identity-account',
      actor_database_role: 'r3a2_signing_identity_authority',
      details: expect.objectContaining({signingKeyId: keyId, provider: 'DISPOSABLE_TEST', purpose: 'PUBLISHER'}),
    })
    expect(audit.created_at).toBeInstanceOf(Date)

    const registeredKey = await admin.selectFrom('greenfield_publisher_signing_keys')
      .select(['public_key_pem', 'fingerprint', 'registered_by_account_id', 'created_at'])
      .where('key_id', '=', keyId).executeTakeFirstOrThrow()
    expect(registeredKey).toMatchObject({registered_by_account_id: 'r3a2-signing-identity-account'})
    await denied(() => admin.updateTable('greenfield_publisher_signing_keys').set({
      public_key_pem: `${registeredKey.public_key_pem}\n`,
      fingerprint: `sha256:${'f'.repeat(64)}`,
      created_at: new Date('2000-01-01'),
    }).where('key_id', '=', keyId).execute())
    await denied(() => api.updateTable('greenfield_publisher_signing_keys')
      .set({updated_at: new Date()}).where('key_id', '=', keyId).execute())
    await denied(() => admin.insertInto('greenfield_publisher_signing_key_events').values({
      event_id: randomUUID(), key_id: keyId, publisher_id: publisherId,
      event_type: 'rotated', related_key_id: 'forged-key', reason: 'forged event',
      actor_account_id: builderId, created_at: new Date('2000-01-01'),
    }).execute())

    await denied(() => sql`INSERT INTO greenfield_publisher_signing_audit_events (
      event_id, event_type, identity_id, publisher_id, actor_account_id, receipt, details, created_at
    ) VALUES (
      ${`psae_${randomUUID()}`}, 'identity_registered', ${identityId}, ${publisherId}, ${builderId},
      '{}'::jsonb, ${JSON.stringify({signingKeyId: keyId})}::jsonb, '2000-01-01'
    )`.execute(admin))
    await denied(() => sql`INSERT INTO greenfield_publisher_signing_audit_events (
      event_id, event_type, identity_id, publisher_id, actor_account_id, receipt, details
    ) VALUES (
      ${`psae_${randomUUID()}`}, 'identity_registered', ${identityId}, ${publisherId}, ${builderId},
      '{}'::jsonb, '{}'::jsonb
    )`.execute(api))
    await denied(() => sql`SELECT greenfield_signing_identity_authority_register(
      ${publisherId}, ${`forged-${suffix}`}, '-----BEGIN PUBLIC KEY-----forged', ${`sha256:${'0'.repeat(64)}`},
      'DISPOSABLE_TEST', ${`test/forged-${suffix}`}, 'PUBLISHER', FALSE, NOW(), NOW() + INTERVAL '1 day', NULL
    )`.execute(api))
  })

  it('allows pending catalogue development but rejects unlinked publication and caller-assigned trust', async () => {
    const developmentSlug = `${namespace}.development`
    await api.insertInto('greenfield_extension_catalogue').values({
      extension_id: developmentSlug,
      slug: developmentSlug,
      kind: 'module',
      name: 'R3A2 pending development',
      description: 'Unpublished development projection',
      version: '0.0.0',
      publisher: 'Development publisher',
      trust: 'untrustedManifest',
      permissions: [],
      compatibility: {},
      manifest: {moduleId: developmentSlug, state: 'planned'},
      catalogue_status: 'inactive',
      executable: false,
      distribution_model: 'free',
      entitlement_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    }).execute()
    await api.updateTable('greenfield_extension_catalogue')
      .set({description: 'Updated unpublished development projection', updated_at: new Date()})
      .where('slug', '=', developmentSlug)
      .execute()
    expect(await admin.selectFrom('greenfield_extension_catalogue').select(['trust', 'catalogue_status', 'executable'])
      .where('slug', '=', 'modula.core.composerTools').executeTakeFirstOrThrow())
      .toEqual({trust: 'firstParty', catalogue_status: 'active', executable: true})

    for (const [slug, trust, status, executable] of [
      [`${namespace}.unlinked-active`, 'untrustedManifest', 'active', false],
      [`${namespace}.unlinked-executable`, 'untrustedManifest', 'inactive', true],
      [`${namespace}.forged-first-party`, 'firstParty', 'inactive', false],
    ] as const) {
      await denied(() => api.insertInto('greenfield_extension_catalogue').values({
        extension_id: slug,
        slug,
        kind: 'module',
        name: slug,
        description: 'Rejected projection',
        version: '0.0.0',
        publisher: 'Forged publisher',
        trust,
        permissions: [],
        compatibility: {},
        manifest: {moduleId: slug},
        catalogue_status: status,
        executable,
        distribution_model: 'free',
        entitlement_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      }).execute())
    }
    await denied(() => api.updateTable('greenfield_extension_catalogue')
      .set({trust: 'firstParty', updated_at: new Date()})
      .where('slug', '=', developmentSlug)
      .execute())
  })

  it('assigns publisher trust only through its fixed authority and records database provenance', async () => {
    const trustPublisherId = `${namespace}.trust-authority`
    const trustNamespace = `${namespace}.trusted`
    const startedAt = new Date()
    await admin.insertInto('greenfield_publishers').values({
      publisher_id: trustPublisherId,
      display_name: 'R3A trust authority fixture',
      website: null,
      status: 'verified',
      trust_level: 'untrustedManifest',
      created_at: startedAt,
      updated_at: startedAt,
      verified_at: startedAt,
      suspended_at: null,
      revoked_at: null,
    }).execute()
    await admin.insertInto('greenfield_publisher_namespaces').values({
      namespace: trustNamespace,
      publisher_id: trustPublisherId,
      verification_method: 'disposable-test',
      verification_evidence: {fixture: 'GF-SIGNER-R3A'},
      verified_at: startedAt,
      revoked_at: null,
      created_at: startedAt,
    }).execute()

    const assigned = await sql<{greenfield_publisher_trust_authority_set: string}>`
      SELECT greenfield_publisher_trust_authority_set(
        ${trustPublisherId}, 'untrustedManifest', 'firstParty', 'R3A isolated authority test'
      )
    `.execute(publisherTrust)
    expect(assigned.rows[0]?.greenfield_publisher_trust_authority_set).toBe('firstParty')
    const audit = await admin.selectFrom('greenfield_publisher_signing_audit_events')
      .select(['event_type', 'actor_account_id', 'actor_database_role', 'created_at'])
      .where('publisher_id', '=', trustPublisherId)
      .where('event_type', '=', 'publisher_trust_assigned')
      .executeTakeFirstOrThrow()
    expect(audit).toMatchObject({
      event_type: 'publisher_trust_assigned',
      actor_account_id: 'r3a-publisher-trust-account',
      actor_database_role: 'r3a_publisher_trust_authority',
    })
    expect(audit.created_at.getTime()).toBeGreaterThanOrEqual(startedAt.getTime())
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

  it('rejects incompatible direct and transitive authority memberships from PostgreSQL membership closure', async () => {
    const assertIsolation = () => sql`SELECT greenfield_assert_publisher_authority_role_isolation(
      'r2_signing_runner'::NAME,
      'r2_release_approver'::NAME,
      'r2_trust_verifier'::NAME,
      'r2_publication_authority'::NAME,
      'r3a_publisher_trust_authority'::NAME,
      'r3a2_signing_identity_authority'::NAME,
      'r3a2_quarantine_authority'::NAME,
      'r3a3_revocation_authority'::NAME
    )`.execute(admin)

    await sql.raw('GRANT r2_release_approver TO r2_signing_runner').execute(superuser)
    try {
      await expect(assertIsolation()).rejects.toMatchObject({code: '42501'})
    } finally {
      await sql.raw('REVOKE r2_release_approver FROM r2_signing_runner').execute(superuser)
    }
    await expect(assertIsolation()).resolves.toBeDefined()

    const middleRole = `r3a3_membership_middle_${suffix}`
    await sql.raw(`CREATE ROLE ${middleRole} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`).execute(superuser)
    try {
      await sql.raw(`GRANT r2_release_approver TO ${middleRole}`).execute(superuser)
      await sql.raw(`GRANT ${middleRole} TO r2_signing_runner`).execute(superuser)
      await expect(assertIsolation()).rejects.toMatchObject({code: '42501'})
    } finally {
      await sql.raw(`REVOKE ${middleRole} FROM r2_signing_runner`).execute(superuser)
      await sql.raw(`REVOKE r2_release_approver FROM ${middleRole}`).execute(superuser)
    }
    await expect(assertIsolation()).resolves.toBeDefined()

    await sql.raw(`GRANT r2_signing_runner TO ${middleRole}`).execute(superuser)
    try {
      await expect(assertIsolation()).rejects.toMatchObject({code: '42501'})
    } finally {
      await sql.raw(`REVOKE r2_signing_runner FROM ${middleRole}`).execute(superuser)
    }
    await expect(assertIsolation()).resolves.toBeDefined()

    await sql.raw(`GRANT ${middleRole} TO r2_signing_runner`).execute(superuser)
    try {
      await expect(assertIsolation()).rejects.toMatchObject({code: '42501'})
    } finally {
      await sql.raw(`REVOKE ${middleRole} FROM r2_signing_runner`).execute(superuser)
      await sql.raw(`DROP ROLE ${middleRole}`).execute(superuser)
    }
    await expect(assertIsolation()).resolves.toBeDefined()
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

  it('preserves quarantine history, uses an authorized lift, and completes the separated lifecycle', async () => {
    let revocationId: string
    let signingQuarantineId: string
    let publicationQuarantineId: string
    const signingRunner = new RestrictedPublisherSigningRunner(runner, provider, {workerId: 'r2-positive-runner'})
    const signingQuarantine = await sql<{quarantine_id: string}>`
      SELECT greenfield_quarantine_authority_record(
        ${releaseId}, 'R3A3 signing quarantine negative test', 'block'
      ) AS quarantine_id
    `.execute(quarantineAuthority)
    signingQuarantineId = signingQuarantine.rows[0]!.quarantine_id
    expect(await signingRunner.runOnce()).toBe(false)
    const recordedQuarantine = await admin.selectFrom('greenfield_module_quarantines')
      .select(['reason', 'created_by', 'created_by_database_role', 'created_at'])
      .where('quarantine_id', '=', signingQuarantineId).executeTakeFirstOrThrow()
    expect(recordedQuarantine).toMatchObject({
      reason: 'R3A3 signing quarantine negative test',
      created_by: 'r3a2-quarantine-authority-account',
      created_by_database_role: 'r3a2_quarantine_authority',
    })
    expect(recordedQuarantine.created_at.getUTCFullYear()).toBeGreaterThan(2025)
    await denied(() => admin.insertInto('greenfield_module_quarantines').values({
      quarantine_id: `forged-quarantine-${suffix}`, release_id: releaseId,
      reason: 'caller supplied actor must not be accepted', policy_action: 'block',
      created_by: builderId, created_at: new Date('2000-01-01'), lifted_at: null,
    }).execute())
    await denied(() => api.updateTable('greenfield_module_quarantines').set({lifted_at: new Date()})
      .where('quarantine_id', '=', signingQuarantineId).execute())
    const signingLift = await sql<{state: string}>`
      SELECT greenfield_quarantine_authority_lift(
        ${signingQuarantineId}, 'independent signing quarantine review passed'
      ) AS state
    `.execute(quarantineAuthority)
    expect(signingLift.rows[0]).toEqual({state: 'pendingReview'})
    await denied(() => admin.updateTable('greenfield_module_quarantines')
      .set({reason: 'rewritten reason'})
      .where('quarantine_id', '=', signingQuarantineId).execute())

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
    await denied(() => sql`UPDATE greenfield_module_release_signatures SET verification_state = 'verified', verified_at = NOW() WHERE signature_id = ${evidence.signature_id}`.execute(api))
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
    const publicationQuarantine = await sql<{quarantine_id: string}>`
      SELECT greenfield_quarantine_authority_record(
        ${releaseId}, 'R3A3 publication quarantine negative test', 'block'
      ) AS quarantine_id
    `.execute(quarantineAuthority)
    publicationQuarantineId = publicationQuarantine.rows[0]!.quarantine_id
    expect(await publicationRunner.runOnce()).toBe(false)
    expect(await admin.selectFrom('background_jobs').select(['status', 'attempt_count'])
      .where('id', '=', publicationQueueId).executeTakeFirstOrThrow())
      .toEqual({status: 'RETRYING', attempt_count: 1})
    const failureHistory = await sql<{disposition: string}>`
      SELECT disposition FROM greenfield_publication_failure_events
      WHERE queue_job_id = ${publicationQueueId}
    `.execute(admin)
    expect(failureHistory.rows).toEqual([{disposition: 'RETRYING'}])
    const publicationLift = await sql<{state: string}>`
      SELECT greenfield_quarantine_authority_lift(
        ${publicationQuarantineId}, 'independent publication quarantine review passed'
      ) AS state
    `.execute(quarantineAuthority)
    expect(publicationLift.rows[0]).toEqual({state: 'verified'})
    await admin.updateTable('background_jobs').set({available_at: new Date()})
      .where('id', '=', publicationQueueId).execute()
    expect(await publicationRunner.runOnce()).toBe(true)
    const finalJob = await admin.selectFrom('greenfield_publisher_release_jobs').select(['state', 'publication_authorized_by_account_id']).where('job_id', '=', jobId).executeTakeFirstOrThrow()
    expect(finalJob).toEqual({state: 'published', publication_authorized_by_account_id: 'r2-publication-account'})
    const publicationQueue = await admin.selectFrom('background_jobs').select(['status']).where('id', '=', publicationQueueId).executeTakeFirstOrThrow()
    expect(publicationQueue.status).toBe('SUCCEEDED')
    const catalogue = await admin.selectFrom('greenfield_extension_catalogue').select(['version', 'trust', 'catalogue_status'])
      .where('slug', '=', moduleId).executeTakeFirstOrThrow()
    expect(catalogue).toEqual({version, trust: 'verifiedPublisher', catalogue_status: 'active'})
    const fabricated = await admin.selectFrom('greenfield_publisher_signing_audit_events').select(({fn}) => fn.countAll().as('count'))
      .where('job_id', '=', jobId).where('event_type', '=', 'publication_authorized').executeTakeFirstOrThrow()
    expect(Number(fabricated.count)).toBe(1)
    const authorities = await admin.selectFrom('greenfield_publisher_signing_audit_events')
      .select(['event_type', 'actor_database_role']).where('job_id', '=', jobId)
      .where('event_type', 'in', ['signature_created', 'signature_verified', 'publication_authorized'])
      .orderBy('created_at').execute()
    expect(authorities).toEqual([
      {event_type: 'signature_created', actor_database_role: 'r2_signing_runner'},
      {event_type: 'signature_verified', actor_database_role: 'r2_trust_verifier'},
      {event_type: 'publication_authorized', actor_database_role: 'r2_publication_authority'},
    ])

    const quarantineEvents = await admin.selectFrom('greenfield_module_quarantine_events')
      .select(['quarantine_id', 'event_type', 'actor_account_id', 'actor_database_role', 'restored_release_state'])
      .where('release_id', '=', releaseId)
      .orderBy('created_at')
      .execute()
    expect(quarantineEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        quarantine_id: signingQuarantineId, event_type: 'recorded',
        actor_account_id: 'r3a2-quarantine-authority-account',
        actor_database_role: 'r3a2_quarantine_authority',
      }),
      expect.objectContaining({
        quarantine_id: signingQuarantineId, event_type: 'lifted',
        actor_database_role: 'r3a2_quarantine_authority', restored_release_state: 'pendingReview',
      }),
      expect.objectContaining({
        quarantine_id: publicationQuarantineId, event_type: 'lifted',
        actor_database_role: 'r3a2_quarantine_authority', restored_release_state: 'verified',
      }),
    ]))

    await denied(() => api.insertInto('greenfield_module_revocations').values({
      revocation_id: `forged-${suffix}`, scope: 'release', target_id: releaseId,
      reason: 'forged revocation', created_by: builderId, created_at: new Date('2000-01-01'),
    }).execute())
    await expect(sql`SELECT greenfield_revocation_authority_record(
      'unsupported', ${releaseId}, ${publisherId}, 'unsupported target type'
    )`.execute(revocationAuthority)).rejects.toMatchObject({code: '22023'})
    await expect(sql`SELECT greenfield_revocation_authority_record(
      'release', ${releaseId}, 'forged-publisher', 'wrong target ownership'
    )`.execute(revocationAuthority)).rejects.toMatchObject({code: '42501'})
    const [revocation, repeatedRevocation] = await Promise.all([
      sql<{revocation_id: string}>`SELECT greenfield_revocation_authority_record(
        'release', ${releaseId}, ${publisherId}, 'R3A3 permanent revocation test'
      ) AS revocation_id`.execute(revocationAuthority),
      sql<{revocation_id: string}>`SELECT greenfield_revocation_authority_record(
        'release', ${releaseId}, ${publisherId}, 'R3A3 permanent revocation test'
      ) AS revocation_id`.execute(revocationAuthorityPeer),
    ])
    revocationId = revocation.rows[0]!.revocation_id
    expect(repeatedRevocation.rows[0]?.revocation_id).toBe(revocationId)
    await expect(sql`SELECT greenfield_revocation_authority_record(
      'release', ${releaseId}, ${publisherId}, 'attempted reason replacement'
    )`.execute(revocationAuthority)).rejects.toMatchObject({code: '23505'})
    const recordedRevocation = await admin.selectFrom('greenfield_module_revocations')
      .select(['target_id', 'publisher_id', 'reason', 'created_by', 'created_by_database_role', 'created_at'])
      .where('revocation_id', '=', revocationId).executeTakeFirstOrThrow()
    expect(recordedRevocation).toMatchObject({
      target_id: releaseId,
      publisher_id: publisherId,
      reason: 'R3A3 permanent revocation test',
      created_by: 'r3a3-revocation-authority-account',
      created_by_database_role: 'r3a3_revocation_authority',
    })
    expect(recordedRevocation.created_at.getUTCFullYear()).toBeGreaterThan(2025)
    await denied(() => api.updateTable('greenfield_module_revocations')
      .set({reason: 'rewritten revocation reason', created_at: new Date('2000-01-01')})
      .where('revocation_id', '=', revocationId).execute())
    await denied(() => admin.updateTable('greenfield_module_revocations')
      .set({target_id: 'forged-target'})
      .where('revocation_id', '=', revocationId).execute())
    expect(await admin.selectFrom('greenfield_module_releases').select('release_state')
      .where('release_id', '=', releaseId).executeTakeFirstOrThrow()).toEqual({release_state: 'revoked'})
    await denied(() => api.updateTable('greenfield_extension_catalogue')
      .set({catalogue_status: 'active', updated_at: new Date()})
      .where('slug', '=', moduleId).execute())

    const rotatedKeyId = `r3a3-rotated-key-${suffix}`
    // Vault Transit rotates key versions in place, so the successor retains
    // the same provider reference while the revoked predecessor stays in the
    // immutable identity history.
    const rotatedProviderKeyRef = providerKeyRef
    const rotatedMaterialRef = `test/rotated-${suffix}`
    const rotatedPublicKey = provider.createIdentity({providerKeyRef: rotatedMaterialRef})
    const rotatedAt = new Date()
    const rotated = await sql<{identity_id: string}>`SELECT greenfield_signing_identity_authority_rotate(
      ${identityId}, ${rotatedKeyId}, ${rotatedPublicKey.publicKeyPem}, ${rotatedPublicKey.fingerprint},
      ${rotatedProviderKeyRef}, ${rotatedAt}, ${new Date(rotatedAt.getTime() + 3_600_000)},
      ${rotatedPublicKey.providerKeyVersion}
    ) AS identity_id`.execute(signingIdentity)
    const rotatedIdentityId = rotated.rows[0]!.identity_id
    expect(rotatedIdentityId).not.toBe(identityId)
    expect(await admin.selectFrom('greenfield_publisher_online_signing_identities')
      .select(['identity_id', 'signing_key_id', 'state']).where('identity_id', '=', identityId).executeTakeFirstOrThrow())
      .toEqual({identity_id: identityId, signing_key_id: keyId, state: 'REVOKED'})
    expect(await admin.selectFrom('greenfield_publisher_online_signing_identities')
      .select(['identity_id', 'signing_key_id', 'state']).where('identity_id', '=', rotatedIdentityId).executeTakeFirstOrThrow())
      .toEqual({identity_id: rotatedIdentityId, signing_key_id: rotatedKeyId, state: 'ACTIVE'})
    expect(await admin.selectFrom('greenfield_publisher_signing_keys')
      .select(['state', 'rotated_to_key_id']).where('key_id', '=', keyId).executeTakeFirstOrThrow())
      .toEqual({state: 'ROTATED', rotated_to_key_id: rotatedKeyId})
    const rotationEvents = await admin.selectFrom('greenfield_publisher_signing_key_events')
      .select(['key_id', 'event_type', 'related_key_id', 'actor_account_id'])
      .where('key_id', 'in', [keyId, rotatedKeyId]).orderBy('created_at').execute()
    expect(rotationEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({key_id: rotatedKeyId, event_type: 'registered', related_key_id: keyId, actor_account_id: 'r3a2-signing-identity-account'}),
      expect.objectContaining({key_id: keyId, event_type: 'rotated', related_key_id: rotatedKeyId, actor_account_id: 'r3a2-signing-identity-account'}),
    ]))

    await sql`SELECT greenfield_signing_identity_authority_revoke(
      ${rotatedIdentityId}, 'R3A3 terminal key revocation'
    )`.execute(signingIdentity)
    await denied(() => admin.updateTable('greenfield_publisher_signing_keys')
      .set({state: 'ACTIVE', revoked_at: null, revocation_reason: null, updated_at: new Date()})
      .where('key_id', '=', rotatedKeyId).execute())
    await denied(() => admin.updateTable('greenfield_publisher_online_signing_identities')
      .set({state: 'ACTIVE', revoked_at: null, revocation_reason: null, updated_at: new Date()})
      .where('identity_id', '=', rotatedIdentityId).execute())
  }, 60_000)

  it('rejects unsafe automated migration rollback without changing the ledger tip', async () => {
    await expect(migrateDown(adminUrl!)).rejects.toThrow(/unsafe automated downgrade of 100 is prohibited/i)
    const tip = await sql<{id: string}>`SELECT id FROM schema_migrations ORDER BY id DESC LIMIT 1`.execute(admin)
    expect(tip.rows[0]?.id).toBe('100_moliboo_genesis_first100_seed')
    const version = await sql<{value: string}>`SELECT value FROM schema_metadata WHERE key = 'schema_version'`.execute(admin)
    expect(version.rows[0]?.value).toBe('100')
  })
})
