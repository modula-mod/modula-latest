import {getNamespacePrefix, usesReservedNamespace} from '@modula/greenfield-module-manifest'
import type {
  PublisherOnlineSigningIdentityPublicView,
  PublisherReleaseSigningStatus,
} from '@modula/greenfield-module-registry-contracts'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {DeveloperService} from '../developers/service.js'
import {consoleError, loadJob} from './release-job-core.js'
import type {PublisherSigningIdentity} from './signing-provider.js'

export type SigningAuthorization = {
  publisherId: string
  moduleId: string
  firstParty: boolean
  identities: PublisherSigningIdentity[]
}

/** Database-authoritative builder, module, source, grant and identity checks. */
export class PublisherOnlineSigningAuthority {
  private readonly developers: DeveloperService

  constructor(private readonly db: ModulaDb, config: AppConfig) {
    this.developers = new DeveloperService(db, config)
  }

  async requireAuthorization(input: {accountId: string; publisherId: string; moduleId: string; sourceRepository: string}): Promise<SigningAuthorization> {
    try { await this.developers.requirePublisherAccess(input.accountId, input.publisherId) }
    catch { consoleError('SIGNING_AUTHORIZATION_REQUIRED', 'Publisher signing authority is required') }

    const now = new Date()
    const [profile, programme, publisher, product, namespace, grant] = await Promise.all([
      this.db.selectFrom('greenfield_developer_profiles').select(['status']).where('account_id', '=', input.accountId).executeTakeFirst(),
      this.db.selectFrom('greenfield_developer_programme_memberships').select(['state']).where('account_id', '=', input.accountId).executeTakeFirst(),
      this.db.selectFrom('greenfield_publishers').select(['status', 'trust_level', 'revoked_at']).where('publisher_id', '=', input.publisherId).executeTakeFirst(),
      this.db.selectFrom('greenfield_developer_products').selectAll().where('product_id', '=', input.moduleId).executeTakeFirst(),
      this.db.selectFrom('greenfield_publisher_namespaces').select(['publisher_id', 'verified_at', 'revoked_at']).where('namespace', '=', getNamespacePrefix(input.moduleId)).executeTakeFirst(),
      this.db.selectFrom('greenfield_publisher_signing_authorizations').selectAll()
        .where('publisher_id', '=', input.publisherId).where('product_id', '=', input.moduleId).where('account_id', '=', input.accountId).executeTakeFirst(),
    ])
    if (profile?.status !== 'ACTIVE' || programme?.state !== 'ACTIVE') {
      consoleError('SIGNING_AUTHORIZATION_REQUIRED', 'An active Builder Programme membership and developer profile are required')
    }
    if (!publisher || publisher.status !== 'verified' || publisher.revoked_at) {
      consoleError('SIGNING_AUTHORIZATION_REQUIRED', 'The publisher is not verified and active')
    }
    if (!product || product.publisher_id !== input.publisherId || product.state !== 'ACTIVE') {
      consoleError('SIGNING_AUTHORIZATION_REQUIRED', 'The module is not an active verified developer product for this publisher')
    }
    await this.requireProductOwner(input.accountId, product.owner_account_id, product.owner_organisation_id)
    if (!namespace || namespace.publisher_id !== input.publisherId || !namespace.verified_at || namespace.revoked_at) {
      consoleError('SIGNING_AUTHORIZATION_REQUIRED', 'Module namespace ownership is not verified')
    }
    const repository = githubOwnerName(input.sourceRepository)
    const sources = await this.db.selectFrom('greenfield_developer_source_connections').select(['repository'])
      .where('product_id', '=', input.moduleId).where('provider', '=', 'github').where('state', '=', 'ACTIVE').execute()
    if (!repository || !sources.some(source => githubOwnerName(source.repository)?.toLowerCase() === repository.toLowerCase())) {
      consoleError('SIGNING_AUTHORIZATION_REQUIRED', 'The source repository is not an active verified association for this module')
    }
    if (!grant || grant.state !== 'ACTIVE' || grant.valid_from > now || (grant.valid_until && grant.valid_until <= now)) {
      consoleError('SIGNING_AUTHORIZATION_REQUIRED', 'No active signing grant exists for this builder and module')
    }

    const firstParty = publisher.trust_level === 'firstParty' || usesReservedNamespace(input.moduleId)
    if (firstParty && !grant.first_party_authorized) {
      consoleError('SIGNING_AUTHORIZATION_REQUIRED', 'First-party signing requires a separately verified elevated grant')
    }
    const rows = await this.db.selectFrom('greenfield_publisher_online_signing_identities as i')
      .innerJoin('greenfield_publisher_signing_keys as k', 'k.key_id', 'i.signing_key_id')
      .select([
        'i.identity_id', 'i.publisher_id', 'i.signing_key_id', 'i.provider', 'i.provider_key_ref', 'i.purpose', 'i.state',
        'i.first_party_authorized', 'i.valid_from', 'i.valid_until', 'k.publisher_id as key_publisher_id', 'k.state as key_state',
        'k.valid_from as key_valid_from', 'k.valid_until as key_valid_until', 'k.revoked_at as key_revoked_at',
      ])
      .where('i.publisher_id', '=', input.publisherId).execute()
    const identities: PublisherSigningIdentity[] = rows.filter(row =>
      row.key_publisher_id === input.publisherId
      && row.state === 'ACTIVE'
      && row.key_state === 'ACTIVE'
      && !row.key_revoked_at
      && row.valid_from <= now && row.valid_until > now
      && row.key_valid_from <= now && (!row.key_valid_until || row.key_valid_until > now)
      && (firstParty
        ? row.purpose === 'MODULA_FIRST_PARTY' && row.first_party_authorized
        : row.purpose === 'PUBLISHER'),
    ).map(row => ({
      identityId: row.identity_id,
      publisherId: row.publisher_id,
      signingKeyId: row.signing_key_id,
      provider: row.provider,
      providerKeyRef: row.provider_key_ref,
      purpose: row.purpose,
      state: row.state,
      firstPartyAuthorized: row.first_party_authorized,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
    }))
    if (!identities.length) consoleError('SIGNING_IDENTITY_UNAVAILABLE', 'No active publisher-scoped online signing identity is available')
    return {publisherId: input.publisherId, moduleId: input.moduleId, firstParty, identities}
  }

  async listPermittedIdentities(input: {accountId: string; publisherId: string; moduleId: string; sourceRepository: string}): Promise<PublisherOnlineSigningIdentityPublicView[]> {
    const authorization = await this.requireAuthorization(input)
    const rows = await this.db.selectFrom('greenfield_publisher_online_signing_identities as i')
      .innerJoin('greenfield_publisher_signing_keys as k', 'k.key_id', 'i.signing_key_id')
      .select(['i.identity_id', 'i.publisher_id', 'i.signing_key_id', 'i.provider', 'i.purpose', 'i.state', 'i.first_party_authorized', 'i.valid_from', 'i.valid_until', 'k.fingerprint'])
      .where('i.identity_id', 'in', authorization.identities.map(identity => identity.identityId)).execute()
    return rows.map(row => ({
      identityId: row.identity_id,
      publisherId: row.publisher_id,
      signingKeyId: row.signing_key_id,
      provider: row.provider,
      purpose: row.purpose,
      state: row.state,
      publicKeyFingerprint: row.fingerprint,
      validFrom: row.valid_from.toISOString(),
      validUntil: row.valid_until.toISOString(),
      firstPartyAuthorized: row.first_party_authorized,
    }))
  }

  async signingStatus(accountId: string, jobId: string): Promise<PublisherReleaseSigningStatus> {
    const job = await loadJob(this.db, jobId)
    if (!job) consoleError('JOB_NOT_FOUND', 'Release job not found')
    try { await this.developers.requirePublisherAccess(accountId, job.publisher_id) }
    catch { consoleError('FORBIDDEN_NOT_PUBLISHER', 'Publisher access denied for this release job') }
    const events = await this.db.selectFrom('greenfield_publisher_signing_audit_events').selectAll()
      .where('job_id', '=', jobId).orderBy('created_at').execute()
    return {
      jobId,
      state: job.state as PublisherReleaseSigningStatus['state'],
      approval: job.approval_sha256 && job.approved_at ? {sha256: job.approval_sha256, approvedAt: job.approved_at.toISOString()} : null,
      receipt: (job.signing_receipt ?? null) as PublisherReleaseSigningStatus['receipt'],
      auditHistory: events.map(event => ({
        eventId: event.event_id,
        eventType: event.event_type,
        identityId: event.identity_id,
        approvalSha256: event.approval_sha256,
        statementSha256: event.statement_sha256,
        receipt: event.receipt as Record<string, unknown>,
        details: event.details as Record<string, unknown>,
        at: event.created_at.toISOString(),
      })),
    }
  }

  private async requireProductOwner(accountId: string, ownerAccountId: string | null, ownerOrganisationId: string | null) {
    if (ownerAccountId === accountId) return
    if (ownerOrganisationId) {
      const membership = await this.db.selectFrom('greenfield_developer_organisation_memberships').select(['state', 'role'])
        .where('organisation_id', '=', ownerOrganisationId).where('account_id', '=', accountId).executeTakeFirst()
      if (membership?.state === 'ACTIVE' && ['OWNER', 'ADMIN', 'DEVELOPER', 'RELEASE_MANAGER'].includes(membership.role)) return
    }
    consoleError('SIGNING_AUTHORIZATION_REQUIRED', 'The builder is not authorized for this specific module')
  }
}

function githubOwnerName(value: string): string | null {
  const text = String(value ?? '').trim()
  const fromUrl = /^https:\/\/github\.com\/([A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/.exec(text)
  const candidate = fromUrl ? fromUrl[1]! : text
  return /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(candidate) ? candidate : null
}
