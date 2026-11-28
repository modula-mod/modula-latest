import {spawn} from 'node:child_process'
import {createPublicKey, randomBytes, randomUUID, verify} from 'node:crypto'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import pg from 'pg'
import {sql} from 'kysely'
import {expect} from 'vitest'
import {createDb, type ModulaDb} from '../../src/database/client.js'
import {GreenfieldModuleReleaseService} from '../../src/modules/release-service.js'
import {GreenfieldRegistryAuthorityService, type RegistryAuthorityConfig} from '../../src/modules/registry-authority-service.js'
import {
  approvalFactsSha256,
  buildPublisherReleaseApprovalFacts,
  parsePublisherPublicKey,
  statementBytes,
  statementSha256,
  type PublisherReleaseStatement,
} from '../../src/modules/release-signing.js'
import {enqueueReleaseJobWork, RELEASE_JOB_PUBLISH, RELEASE_JOB_SIGN} from '../../src/publisher/release-job-core.js'
import {RestrictedPublisherPublicationAuthority} from '../../src/publisher/restricted-publication-authority.js'
import {RestrictedPublisherSigningRunner} from '../../src/publisher/restricted-signing-runner.js'
import {RestrictedPublisherTrustVerifier} from '../../src/publisher/restricted-trust-verifier.js'
import {DisposableEd25519SigningProvider} from '../../src/publisher/signing-provider.js'
import {adapterManifest, evidenceFor} from './registry-fixtures.js'

const grantsFile = join(dirname(fileURLToPath(import.meta.url)), '../../../../ops/security/publisher-release-runner-grants.sql')

type AuthorityName =
  | 'runner'
  | 'approver'
  | 'trustVerifier'
  | 'publicationAuthority'
  | 'publisherTrustAuthority'
  | 'signingIdentityAuthority'
  | 'quarantineAuthority'
  | 'revocationAuthority'

type AuthorityRole = {name: string; password: string}

export type AuthorizedPublicationRoleFixture = {
  roles: Record<AuthorityName, AuthorityRole>
  urls: Record<AuthorityName, string>
}

export type AuthorizedSigningIdentityFixture = {
  identityId: string
  publisherId: string
  signingKeyId: string
  providerKeyRef: string
  publicKeyFingerprint: string
}

export function authorizedRegistryAuthorityConfig(
  databaseUrl: string,
  fixture: AuthorizedPublicationRoleFixture,
): RegistryAuthorityConfig {
  return {
    databaseUrl,
    trustVerifierDatabaseUrl: fixture.urls.trustVerifier,
    publicationAuthorityDatabaseUrl: fixture.urls.publicationAuthority,
    quarantineAuthorityDatabaseUrl: fixture.urls.quarantineAuthority,
    revocationAuthorityDatabaseUrl: fixture.urls.revocationAuthority,
  }
}

/**
 * Builds the production authority adapter from the fixed disposable principals
 * configured by the database-backed CI job. Missing credentials are a setup
 * failure, never a reason to fall back to ordinary database mutation.
 */
export function authorizedRegistryAuthorityFromEnv(
  adminDb: ModulaDb,
  databaseUrl: string,
): GreenfieldRegistryAuthorityService {
  const required = (name: string): string => {
    const value = process.env[name]?.trim()
    if (!value) throw new Error(`${name} is required for authority-separated registry fixtures`)
    return value
  }
  return new GreenfieldRegistryAuthorityService(adminDb, {
    databaseUrl,
    trustVerifierDatabaseUrl: required('MODULA_TRUST_VERIFIER_DATABASE_URL'),
    publicationAuthorityDatabaseUrl: required('MODULA_PUBLICATION_AUTHORITY_DATABASE_URL'),
    quarantineAuthorityDatabaseUrl: required('MODULA_QUARANTINE_AUTHORITY_DATABASE_URL'),
    revocationAuthorityDatabaseUrl: required('MODULA_REVOCATION_AUTHORITY_DATABASE_URL'),
  })
}

export function authorizedReleaseServiceFromEnv(
  adminDb: ModulaDb,
  databaseUrl: string,
): GreenfieldModuleReleaseService {
  return new GreenfieldModuleReleaseService(
    adminDb,
    authorizedRegistryAuthorityFromEnv(adminDb, databaseUrl),
  )
}

export function configureAuthorizedRegistryAuthorityEnv(fixture: AuthorizedPublicationRoleFixture): void {
  process.env.MODULA_TRUST_VERIFIER_DATABASE_URL = fixture.urls.trustVerifier
  process.env.MODULA_PUBLICATION_AUTHORITY_DATABASE_URL = fixture.urls.publicationAuthority
  process.env.MODULA_SIGNING_IDENTITY_AUTHORITY_DATABASE_URL = fixture.urls.signingIdentityAuthority
  process.env.MODULA_QUARANTINE_AUTHORITY_DATABASE_URL = fixture.urls.quarantineAuthority
  process.env.MODULA_REVOCATION_AUTHORITY_DATABASE_URL = fixture.urls.revocationAuthority
}

export function clearAuthorizedRegistryAuthorityEnv(): void {
  delete process.env.MODULA_TRUST_VERIFIER_DATABASE_URL
  delete process.env.MODULA_PUBLICATION_AUTHORITY_DATABASE_URL
  delete process.env.MODULA_SIGNING_IDENTITY_AUTHORITY_DATABASE_URL
  delete process.env.MODULA_QUARANTINE_AUTHORITY_DATABASE_URL
  delete process.env.MODULA_REVOCATION_AUTHORITY_DATABASE_URL
}

export async function verifyAuthorizedExternalSignature(input: {
  adminDb: ModulaDb
  targetDatabaseUrl: string
  fixture: AuthorizedPublicationRoleFixture
  releaseId: string
}) {
  return new GreenfieldRegistryAuthorityService(
    input.adminDb,
    authorizedRegistryAuthorityConfig(input.targetDatabaseUrl, input.fixture),
  ).verifyPendingSignature(input.releaseId)
}

export async function publishAuthorizedRelease(input: {
  adminDb: ModulaDb
  targetDatabaseUrl: string
  fixture: AuthorizedPublicationRoleFixture
  releaseId: string
}) {
  return new GreenfieldRegistryAuthorityService(
    input.adminDb,
    authorizedRegistryAuthorityConfig(input.targetDatabaseUrl, input.fixture),
  ).publishRelease(input.releaseId)
}

export async function quarantineAuthorizedRelease(input: {
  adminDb: ModulaDb
  targetDatabaseUrl: string
  fixture: AuthorizedPublicationRoleFixture
  releaseId: string
  reason: string
  policyAction?: 'warn' | 'disableExecutableContributions' | 'block'
}) {
  return new GreenfieldRegistryAuthorityService(
    input.adminDb,
    authorizedRegistryAuthorityConfig(input.targetDatabaseUrl, input.fixture),
  ).quarantineRelease(input.releaseId, input.reason, input.policyAction)
}

export async function revokeAuthorizedRelease(input: {
  adminDb: ModulaDb
  targetDatabaseUrl: string
  fixture: AuthorizedPublicationRoleFixture
  releaseId: string
  reason: string
}) {
  return new GreenfieldRegistryAuthorityService(
    input.adminDb,
    authorizedRegistryAuthorityConfig(input.targetDatabaseUrl, input.fixture),
  ).revokeRelease(input.releaseId, input.reason)
}

function identifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function databaseUrlForRole(baseUrl: string, role: AuthorityRole): string {
  const url = new URL(baseUrl)
  url.username = role.name
  url.password = role.password
  return url.toString()
}

async function runGrantInstaller(databaseUrl: string, variables: Record<string, string>): Promise<void> {
  const args = ['--no-psqlrc', '--dbname', databaseUrl]
  for (const [name, value] of Object.entries(variables)) args.push(`--set=${name}=${value}`)
  args.push('--file', grantsFile)
  await new Promise<void>((resolve, reject) => {
    const child = spawn('psql', args, {stdio: ['ignore', 'pipe', 'pipe']})
    let output = ''
    child.stdout.on('data', chunk => { output += String(chunk) })
    child.stderr.on('data', chunk => { output += String(chunk) })
    child.once('error', reject)
    child.once('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`Restricted publisher authority grant installer failed (${code}): ${output.slice(-4_000)}`))
    })
  })
}

/**
 * Creates disposable, mutually isolated login roles and applies the canonical
 * production grant installer. The associated accounts are automated test
 * principals only; they are not human or production approval evidence.
 */
export async function provisionAuthorizedPublicationRoles(input: {
  adminPool: pg.Pool
  targetDatabaseUrl: string
  targetDb: ModulaDb
  suffix: string
}): Promise<AuthorizedPublicationRoleFixture> {
  const rolePrefix = `r4a2_listing_${input.suffix.replaceAll('-', '').slice(0, 12)}`
  const role = (label: string): AuthorityRole => ({
    name: `${rolePrefix}_${label}`,
    password: randomBytes(24).toString('base64url'),
  })
  const roles: Record<AuthorityName, AuthorityRole> = {
    runner: role('runner'),
    approver: role('approver'),
    trustVerifier: role('verifier'),
    publicationAuthority: role('publication'),
    publisherTrustAuthority: role('publisher_trust'),
    signingIdentityAuthority: role('signing_identity'),
    quarantineAuthority: role('quarantine'),
    revocationAuthority: role('revocation'),
  }
  const created: AuthorityRole[] = []
  try {
    for (const authority of Object.values(roles)) {
      await input.adminPool.query(
        `CREATE ROLE ${identifier(authority.name)} LOGIN PASSWORD ${literal(authority.password)} `
        + 'NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
      )
      created.push(authority)
    }

    const accountPrefix = `r4a2-listing-${input.suffix}`
    const actorAccounts = {
      approver: `${accountPrefix}-approver`,
      publication: `${accountPrefix}-publication`,
      publisherTrust: `${accountPrefix}-publisher-trust`,
      signingIdentity: `${accountPrefix}-signing-identity`,
      quarantine: `${accountPrefix}-quarantine`,
      revocation: `${accountPrefix}-revocation`,
    }
    const now = new Date()
    await input.targetDb.insertInto('greenfield_accounts').values(Object.entries(actorAccounts).map(([kind, accountId]) => ({
      account_id: accountId,
      primary_handle: `r4a2${kind.toLowerCase()}${input.suffix.replaceAll('-', '').slice(0, 8)}`,
      status: 'active' as const,
      created_at: now,
      updated_at: now,
    }))).execute()

    await runGrantInstaller(input.targetDatabaseUrl, {
      runner_role: roles.runner.name,
      approver_role: roles.approver.name,
      approver_account_id: actorAccounts.approver,
      trust_verifier_role: roles.trustVerifier.name,
      publication_authority_role: roles.publicationAuthority.name,
      publication_authority_account_id: actorAccounts.publication,
      publisher_trust_authority_role: roles.publisherTrustAuthority.name,
      publisher_trust_authority_account_id: actorAccounts.publisherTrust,
      signing_identity_authority_role: roles.signingIdentityAuthority.name,
      signing_identity_authority_account_id: actorAccounts.signingIdentity,
      quarantine_authority_role: roles.quarantineAuthority.name,
      quarantine_authority_account_id: actorAccounts.quarantine,
      revocation_authority_role: roles.revocationAuthority.name,
      revocation_authority_account_id: actorAccounts.revocation,
    })
    return {
      roles,
      urls: Object.fromEntries(Object.entries(roles).map(([name, authority]) => [
        name,
        databaseUrlForRole(input.targetDatabaseUrl, authority),
      ])) as Record<AuthorityName, string>,
    }
  } catch (error) {
    for (const authority of created.reverse()) {
      await input.adminPool.query(`DROP ROLE IF EXISTS ${identifier(authority.name)}`).catch(() => undefined)
    }
    throw error
  }
}

export async function dropAuthorizedPublicationRoles(adminPool: pg.Pool, fixture: AuthorizedPublicationRoleFixture): Promise<void> {
  for (const authority of Object.values(fixture.roles).reverse()) {
    await adminPool.query(`DROP OWNED BY ${identifier(authority.name)}`)
    await adminPool.query(`DROP ROLE IF EXISTS ${identifier(authority.name)}`)
  }
}

/**
 * Registers a disposable signing identity through the fixed database authority.
 * This is test evidence only: it is never human approval or production key
 * enrollment, even when the fixture publisher is the built-in `modula` row.
 */
export async function registerAuthorizedSigningIdentity(input: {
  authorityUrl: string
  publisherId: string
  signingKeyId: string
  publicKeyPem: string
  providerKeyRef: string
  purpose?: 'PUBLISHER' | 'MODULA_FIRST_PARTY'
  provider?: 'DISPOSABLE_TEST'
  validFrom?: Date
  validUntil?: Date
}): Promise<AuthorizedSigningIdentityFixture> {
  const authority = createDb(input.authorityUrl, undefined, {max: 1, applicationName: 'test-signing-identity-authority'})
  const parsed = parsePublisherPublicKey(input.publicKeyPem)
  const validFrom = input.validFrom ?? new Date(Date.now() - 60_000)
  const validUntil = input.validUntil ?? new Date(Date.now() + 3_600_000)
  const purpose = input.purpose ?? 'PUBLISHER'
  try {
    const registered = await sql<{identity_id: string}>`
      SELECT greenfield_signing_identity_authority_register(
        ${input.publisherId}, ${input.signingKeyId}, ${parsed.publicKeyPem}, ${parsed.fingerprint},
        ${input.provider ?? 'DISPOSABLE_TEST'}, ${input.providerKeyRef}, ${purpose},
        ${purpose === 'MODULA_FIRST_PARTY'}, ${validFrom}, ${validUntil}, NULL
      ) AS identity_id
    `.execute(authority)
    return {
      identityId: registered.rows[0]!.identity_id,
      publisherId: input.publisherId,
      signingKeyId: input.signingKeyId,
      providerKeyRef: input.providerKeyRef,
      publicKeyFingerprint: parsed.fingerprint,
    }
  } finally {
    await authority.destroy()
  }
}

export async function rotateAuthorizedSigningIdentity(input: {
  authorityUrl: string
  identityId: string
  signingKeyId: string
  publicKeyPem: string
  providerKeyRef: string
  validFrom?: Date
  validUntil?: Date
}): Promise<string> {
  const authority = createDb(input.authorityUrl, undefined, {max: 1, applicationName: 'test-signing-identity-authority'})
  const parsed = parsePublisherPublicKey(input.publicKeyPem)
  try {
    const rotated = await sql<{identity_id: string}>`
      SELECT greenfield_signing_identity_authority_rotate(
        ${input.identityId}, ${input.signingKeyId}, ${parsed.publicKeyPem}, ${parsed.fingerprint},
        ${input.providerKeyRef}, ${input.validFrom ?? new Date(Date.now() - 60_000)},
        ${input.validUntil ?? new Date(Date.now() + 3_600_000)}, NULL
      ) AS identity_id
    `.execute(authority)
    return rotated.rows[0]!.identity_id
  } finally {
    await authority.destroy()
  }
}

export async function revokeAuthorizedSigningIdentity(input: {
  authorityUrl: string
  identityId: string
  reason: string
}): Promise<string> {
  const authority = createDb(input.authorityUrl, undefined, {max: 1, applicationName: 'test-signing-identity-authority'})
  try {
    const revoked = await sql<{identity_id: string}>`
      SELECT greenfield_signing_identity_authority_revoke(${input.identityId}, ${input.reason}) AS identity_id
    `.execute(authority)
    return revoked.rows[0]!.identity_id
  } finally {
    await authority.destroy()
  }
}

export async function setAuthorizedPublisherTrust(input: {
  authorityUrl: string
  publisherId: string
  expectedCurrentTrustLevel: 'firstParty' | 'verifiedPublisher' | 'reviewedCommunity' | 'untrustedManifest'
  trustLevel: 'firstParty' | 'verifiedPublisher' | 'reviewedCommunity' | 'untrustedManifest'
  reason: string
}): Promise<void> {
  const authority = createDb(input.authorityUrl, undefined, {max: 1, applicationName: 'test-publisher-trust-authority'})
  try {
    await sql`SELECT greenfield_publisher_trust_authority_set(
      ${input.publisherId}, ${input.expectedCurrentTrustLevel}, ${input.trustLevel}, ${input.reason}
    )`.execute(authority)
  } finally {
    await authority.destroy()
  }
}

/**
 * Publishes one valid registry fixture through the authority-separated path.
 * Direct release publication and direct signature verification are deliberately
 * absent: the restricted principals perform those transitions.
 */
export async function publishAuthorizedRegistryFixture(input: {
  adminDb: ModulaDb
  authorityUrls: AuthorizedPublicationRoleFixture['urls']
  moduleId: string
  version?: string
  suffix: string
}) {
  const version = input.version ?? '1.0.0'
  const namespace = input.moduleId.split('.').slice(0, -1).join('.')
  const publisherId = `${namespace}.publisher`
  const builderId = `r4a2-listing-${input.suffix}-builder`
  const repository = `modula-test/registry-listing-${input.suffix}`
  const sourceCommit = '1'.repeat(40)
  const releaseTag = `${input.moduleId}-v${version}`
  const manifest = adapterManifest(input.moduleId, version, {
    publisher: {publisherId, displayName: 'Registry Listing Test Publisher'},
    source: {
      provider: 'github', repository, commit: sourceCommit, manifestPath: 'module.manifest.json',
      releaseTag, releaseAssetName: `${input.moduleId}-${version}.tgz`,
    },
    license: {status: 'verified', evidenceIds: ['automated-authority-separated-registry-fixture']},
    trust: {requestedLevel: 'verifiedPublisher'},
  })
  const evidence = evidenceFor(manifest)
  const now = new Date()
  const provider = new DisposableEd25519SigningProvider({allowInsecureTestProvider: true})
  const keyId = `r4a2-listing-key-${input.suffix}`
  const providerKeyRef = `test/registry-listing-${input.suffix}`
  const authorizationId = `psa_${randomUUID()}`
  const jobId = `prj_${randomUUID()}`
  const signingRequestId = `psr_${randomUUID()}`

  const runner = createDb(input.authorityUrls.runner, undefined, {max: 1, applicationName: 'r4a2-listing-runner'})
  const approver = createDb(input.authorityUrls.approver, undefined, {max: 1, applicationName: 'r4a2-listing-approver'})
  const verifierDb = createDb(input.authorityUrls.trustVerifier, undefined, {max: 1, applicationName: 'r4a2-listing-verifier'})
  const publication = createDb(input.authorityUrls.publicationAuthority, undefined, {max: 1, applicationName: 'r4a2-listing-publication'})
  const signingIdentity = createDb(input.authorityUrls.signingIdentityAuthority, undefined, {max: 1, applicationName: 'r4a2-listing-signing-identity'})

  try {
    await input.adminDb.insertInto('greenfield_accounts').values({
      account_id: builderId, primary_handle: `r4a2builder${input.suffix.replaceAll('-', '').slice(0, 8)}`,
      status: 'active', created_at: now, updated_at: now,
    }).execute()
    await input.adminDb.insertInto('greenfield_publishers').values({
      publisher_id: publisherId, display_name: 'Registry Listing Test Publisher', website: null,
      status: 'verified', trust_level: 'verifiedPublisher', created_at: now, updated_at: now,
      verified_at: now, suspended_at: null, revoked_at: null,
    }).execute()
    await input.adminDb.insertInto('greenfield_publisher_namespaces').values({
      namespace, publisher_id: publisherId, verification_method: 'disposable-authority-separated-test',
      verification_evidence: {fixture: 'GF-SIGNER-R4A2-01', productionApproval: false},
      verified_at: now, revoked_at: null, created_at: now,
    }).execute()

    const pending = await new GreenfieldModuleReleaseService(input.adminDb).importPendingReview(manifest, evidence)
    await input.adminDb.insertInto('greenfield_developer_products').values({
      product_id: input.moduleId, publisher_id: publisherId, owner_account_id: builderId,
      owner_organisation_id: null, extension_id: input.moduleId, kind: 'module', display_name: input.moduleId,
      description: 'Authority-separated registry listing fixture', visibility: 'PRIVATE', state: 'ACTIVE',
      created_at: now, updated_at: now,
    }).execute()

    const publicKey = provider.createIdentity({providerKeyRef})
    const registration = await sql<{identity_id: string}>`
      SELECT greenfield_signing_identity_authority_register(
        ${publisherId}, ${keyId}, ${publicKey.publicKeyPem}, ${publicKey.fingerprint},
        'DISPOSABLE_TEST', ${providerKeyRef}, 'PUBLISHER', FALSE,
        ${new Date(now.getTime() - 60_000)}, ${new Date(now.getTime() + 3_600_000)}, NULL
      ) AS identity_id
    `.execute(signingIdentity)
    const identityId = registration.rows[0]!.identity_id
    await input.adminDb.insertInto('greenfield_publisher_signing_authorizations').values({
      authorization_id: authorizationId, publisher_id: publisherId, product_id: input.moduleId, account_id: builderId,
      state: 'ACTIVE', first_party_authorized: false, valid_from: new Date(now.getTime() - 60_000),
      valid_until: new Date(now.getTime() + 3_600_000), granted_by_account_id: builderId,
      suspended_at: null, revoked_at: null,
      reason: 'automated disposable test authorization; not human production approval', created_at: now, updated_at: now,
    }).execute()

    const approvalFacts = buildPublisherReleaseApprovalFacts({manifest, sourceSha: sourceCommit, artifactSha256: evidence.artifactSha256})
    const approvalSha256 = approvalFactsSha256(approvalFacts)
    await input.adminDb.insertInto('greenfield_publisher_release_jobs').values({
      job_id: jobId, module_id: input.moduleId, publisher_id: publisherId, created_by_account_id: builderId,
      source_repository: repository, release_tag: releaseTag, source_commit: sourceCommit, version, channel: 'stable',
      artifact_sha256: evidence.artifactSha256, release_id: pending.releaseId, state: 'awaiting_approval', cancelled_from_state: null,
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
        ${`test/authorized-publication/${input.suffix}`}, 'AUTOMATED_TEST_POLICY'
      )
    `.execute(approver)
    expect(approved.rows[0]?.greenfield_release_approver_record).toBe(approvalSha256)
    await input.adminDb.updateTable('greenfield_publisher_release_jobs').set({
      state: 'signing', signing_request_id: signingRequestId, sign_requested_by_account_id: builderId,
    } as never).where('job_id', '=', jobId).execute()
    await enqueueReleaseJobWork(input.adminDb, {jobId, workType: RELEASE_JOB_SIGN, accountId: builderId, moduleId: input.moduleId})

    expect(await new RestrictedPublisherSigningRunner(runner, provider, {workerId: `r4a2-listing-${input.suffix}`}).runOnce()).toBe(true)
    const pendingEvidence = await sql<{
      job_id: string
      signature_id: string
      statement: PublisherReleaseStatement
      statement_sha256: string
      signature: string
      public_key_pem: string
      public_key_fingerprint: string
    }>`SELECT * FROM greenfield_trust_verifier_claim(${jobId})`.execute(verifierDb)
    expect(pendingEvidence.rows).toHaveLength(1)
    const signatureEvidence = pendingEvidence.rows[0]!
    expect(statementSha256(signatureEvidence.statement)).toBe(signatureEvidence.statement_sha256)
    expect(verify(
      null,
      statementBytes(signatureEvidence.statement),
      createPublicKey(signatureEvidence.public_key_pem),
      Buffer.from(signatureEvidence.signature, 'base64url'),
    )).toBe(true)
    expect(await new RestrictedPublisherTrustVerifier(verifierDb).runOnce(jobId)).toBe(true)

    const verified = await input.adminDb.selectFrom('greenfield_module_release_signatures')
      .select(['verification_state']).where('signature_id', '=', signatureEvidence.signature_id).executeTakeFirstOrThrow()
    expect(verified.verification_state).toBe('verified')
    await input.adminDb.updateTable('greenfield_publisher_release_jobs').set({
      state: 'publishing', publish_requested_by_account_id: builderId, publish_started_at: new Date(),
    } as never).where('job_id', '=', jobId).execute()
    await enqueueReleaseJobWork(input.adminDb, {jobId, workType: RELEASE_JOB_PUBLISH, accountId: builderId, moduleId: input.moduleId})
    expect(await new RestrictedPublisherPublicationAuthority(publication).runOnce()).toBe(true)

    const [release, catalogue, job] = await Promise.all([
      input.adminDb.selectFrom('greenfield_module_releases').select(['release_state', 'trust_level'])
        .where('release_id', '=', pending.releaseId).executeTakeFirstOrThrow(),
      input.adminDb.selectFrom('greenfield_extension_catalogue').select(['catalogue_status', 'trust', 'version'])
        .where('slug', '=', input.moduleId).executeTakeFirstOrThrow(),
      input.adminDb.selectFrom('greenfield_publisher_release_jobs')
        .select(['state', 'publication_authorized_by_account_id']).where('job_id', '=', jobId).executeTakeFirstOrThrow(),
    ])
    expect(release).toEqual({release_state: 'published', trust_level: 'verifiedPublisher'})
    expect(catalogue).toEqual({catalogue_status: 'active', trust: 'verifiedPublisher', version})
    expect(job.state).toBe('published')
    expect(job.publication_authorized_by_account_id).not.toBe(builderId)

    return {
      releaseId: pending.releaseId,
      jobId,
      identityId,
      publisherId,
      approvalSha256,
      publicationAuthorityAccountId: job.publication_authorized_by_account_id,
    }
  } finally {
    await Promise.all([runner, approver, verifierDb, publication, signingIdentity].map(db => db.destroy()))
  }
}

/**
 * Writes a faithful pre-authority-separation row at schema 091. This helper
 * refuses to run on a hardened schema, so it cannot become a publication bypass.
 */
export async function seedLegacyMalformedRegistryRelease(input: {
  db: ModulaDb
  moduleId: string
  version?: string
  suffix: string
}) {
  const tip = await sql<{id: string}>`SELECT id FROM schema_migrations ORDER BY id DESC LIMIT 1`.execute(input.db)
  expect(tip.rows[0]?.id).toBe('091_greenfield_online_signing_authority')

  const version = input.version ?? '1.0.0'
  const now = new Date()
  const publisherId = `legacy-listing-publisher-${input.suffix}`
  const extensionId = `extension:${input.moduleId}`
  const extensionVersionId = `${input.moduleId}@${version}`
  const moduleVersionId = `module-version:${input.moduleId}:${version}`
  const releaseId = `release:${input.moduleId}:${version}`
  const manifest = {
    moduleId: input.moduleId,
    name: 'listing-incomplete',
    description: 'Historical published fixture with no manifest.compatibility',
    version,
    permissions: [],
    contributions: {},
  }
  await input.db.insertInto('greenfield_publishers').values({
    publisher_id: publisherId, display_name: 'Legacy Listing Compatibility Fixture', website: null, status: 'verified',
    trust_level: 'verifiedPublisher', created_at: now, updated_at: now, verified_at: now, suspended_at: null, revoked_at: null,
  }).execute()
  await input.db.insertInto('greenfield_extensions').values({
    extension_id: extensionId, slug: input.moduleId, publisher_account_id: null, status: 'published', created_at: now, updated_at: now,
  }).execute()
  await input.db.insertInto('greenfield_extension_versions').values({
    extension_version_id: extensionVersionId, extension_id: extensionId, version, manifest, status: 'published', created_at: now,
  }).execute()
  await input.db.insertInto('greenfield_module_versions').values({
    module_version_id: moduleVersionId, extension_version_id: extensionVersionId, module_id: input.moduleId,
    version, publisher_id: publisherId, manifest, status: 'published', created_at: now, updated_at: now,
  }).execute()
  await input.db.insertInto('greenfield_module_releases').values({
    release_id: releaseId, module_version_id: moduleVersionId, extension_id: extensionId, extension_version_id: extensionVersionId,
    module_id: input.moduleId, version, publisher_id: publisherId, release_state: 'published',
    source_repository: 'modula-test/legacy-listing-compatibility', source_commit: 'a'.repeat(40),
    manifest_path: 'manifest.json', manifest_sha256: 'b'.repeat(64), release_sha256: 'c'.repeat(64),
    signature_key_id: 'legacy-test-key', signature: 'historical-signature', compatibility: {}, license_status: 'verified',
    trust_level: 'verifiedPublisher', product_kind: 'module', extension_product: {}, published_at: now,
    quarantined_at: null, revoked_at: null, superseded_at: null, created_at: now, updated_at: now,
  }).execute()
  return {releaseId, publisherId}
}
