import type {
  DeveloperBoardDto,
  DeveloperProductDto,
  DeveloperProductKind,
  DeveloperProductVisibility,
  DeveloperProgrammeState,
} from '@modula/api-contracts'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'
import {AuditRepository} from '../domains/audit/repository.js'

const PRODUCT_KINDS = new Set<DeveloperProductKind>(['module', 'addon', 'plugin', 'function', 'tool', 'widget', 'connector', 'backend-service', 'backend-engine', 'game-module'])
const VISIBILITIES = new Set<DeveloperProductVisibility>(['PRIVATE', 'INTERNAL', 'UNLISTED', 'BETA', 'PUBLIC'])
const PROGRAMME_STATES = new Set<DeveloperProgrammeState>(['NOT_ENROLLED', 'PENDING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'TERMINATED'])

export class DeveloperService {
  constructor(private readonly db: ModulaDb, private readonly config: AppConfig) {}

  async board(accountId: string): Promise<DeveloperBoardDto> {
    const [profile, memberships, programme, products] = await Promise.all([
      this.db.selectFrom('greenfield_developer_profiles').selectAll().where('account_id', '=', accountId).executeTakeFirst(),
      this.db.selectFrom('greenfield_developer_organisation_memberships as m')
        .innerJoin('greenfield_developer_organisations as o', 'o.organisation_id', 'm.organisation_id')
        .select(['o.organisation_id', 'o.slug', 'o.display_name', 'm.role', 'm.state'])
        .where('m.account_id', '=', accountId).where('m.state', '!=', 'REMOVED').execute(),
      this.db.selectFrom('greenfield_developer_programme_memberships').selectAll().where('account_id', '=', accountId).executeTakeFirst(),
      this.listProducts(accountId),
    ])
    const productIds = products.map(product => product.productId)
    const counts = productIds.length === 0 ? {builds: 0, releases: 0, testers: 0, pendingReviews: 0} : {
      builds: Number((await this.db.selectFrom('greenfield_developer_builds').select(({fn}) => fn.countAll().as('count')).where('product_id', 'in', productIds).executeTakeFirstOrThrow()).count),
      releases: Number((await this.db.selectFrom('greenfield_developer_releases').select(({fn}) => fn.countAll().as('count')).where('product_id', 'in', productIds).executeTakeFirstOrThrow()).count),
      testers: Number((await this.db.selectFrom('greenfield_developer_test_groups as g').innerJoin('greenfield_developer_test_group_members as m', 'm.test_group_id', 'g.test_group_id').select(({fn}) => fn.count('m.account_id').distinct().as('count')).where('g.product_id', 'in', productIds).where('m.state', '=', 'ACTIVE').executeTakeFirstOrThrow()).count),
      pendingReviews: Number((await this.db.selectFrom('greenfield_developer_review_submissions').select(({fn}) => fn.countAll().as('count')).where('product_id', 'in', productIds).where('state', 'in', ['SUBMITTED', 'AUTOMATED_REVIEW', 'MANUAL_REVIEW', 'CHANGES_REQUIRED']).executeTakeFirstOrThrow()).count),
    }
    return {
      profile: profile ? {accountId: profile.account_id, displayName: profile.display_name, biography: profile.biography, website: profile.website, status: profile.status, createdAt: profile.created_at.toISOString(), updatedAt: profile.updated_at.toISOString()} : null,
      organisations: memberships.map(row => ({organisationId: row.organisation_id, slug: row.slug, displayName: row.display_name, role: row.role, state: row.state})),
      programme: programme ? {state: programme.state, stateReason: programme.state_reason} : null,
      products,
      counts: {products: products.length, ...counts},
    }
  }

  async upsertProfile(accountId: string, input: {displayName?: unknown; biography?: unknown; website?: unknown}) {
    const displayName = requiredText(input.displayName, 120, 'Display name is required')
    const biography = optionalText(input.biography, 2_000)
    const website = optionalHttpsUrl(input.website)
    const now = new Date()
    const row = await this.db.insertInto('greenfield_developer_profiles').values({account_id: accountId, display_name: displayName, biography, website, status: 'ACTIVE', created_at: now, updated_at: now})
      .onConflict(oc => oc.column('account_id').doUpdateSet({display_name: displayName, biography, website, updated_at: now}))
      .returningAll().executeTakeFirstOrThrow()
    return {accountId: row.account_id, displayName: row.display_name, biography: row.biography, website: row.website, status: row.status, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString()}
  }

  async createOrganisation(accountId: string, input: {slug?: unknown; displayName?: unknown}) {
    const slug = requiredText(input.slug, 63, 'Organisation slug is required').toLowerCase()
    if (!/^[a-z][a-z0-9-]{2,62}$/.test(slug)) invalid('Invalid organisation slug')
    const displayName = requiredText(input.displayName, 120, 'Organisation display name is required')
    const organisationId = uuidv7()
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx.insertInto('greenfield_developer_organisations').values({organisation_id: organisationId, slug, display_name: displayName, status: 'ACTIVE', created_by_account_id: accountId, created_at: now, updated_at: now}).execute()
      await trx.insertInto('greenfield_developer_organisation_memberships').values({membership_id: uuidv7(), organisation_id: organisationId, account_id: accountId, role: 'OWNER', state: 'ACTIVE', invited_by_account_id: accountId, created_at: now, updated_at: now}).execute()
      await new AuditRepository(trx).append('developer.organisation.created', {slug}, {type: 'developerOrganisation', id: organisationId})
    })
    return {organisationId, slug, displayName, role: 'OWNER' as const, state: 'ACTIVE' as const}
  }

  async inviteOrganisationMember(accountId: string, organisationId: string, input: {accountId?: unknown; role?: unknown}) {
    await this.requireOrganisationRole(accountId, organisationId, ['OWNER', 'ADMIN'])
    const invitedAccountId = requiredText(input.accountId, 120, 'Member account is required')
    const role = String(input.role)
    if (!['ADMIN', 'DEVELOPER', 'RELEASE_MANAGER', 'VIEWER'].includes(role)) invalid('Invalid organisation role')
    const target = await this.db.selectFrom('greenfield_accounts').select('account_id').where('account_id', '=', invitedAccountId).executeTakeFirst()
    if (!target) notFound('Member account not found')
    const now = new Date()
    return this.db.insertInto('greenfield_developer_organisation_memberships').values({membership_id: uuidv7(), organisation_id: organisationId, account_id: invitedAccountId, role: role as any, state: 'INVITED', invited_by_account_id: accountId, created_at: now, updated_at: now})
      .onConflict(oc => oc.columns(['organisation_id', 'account_id']).doUpdateSet({role: role as any, state: 'INVITED', invited_by_account_id: accountId, updated_at: now})).returningAll().executeTakeFirstOrThrow()
  }

  async acceptOrganisationInvitation(accountId: string, organisationId: string) {
    const row = await this.db.updateTable('greenfield_developer_organisation_memberships').set({state: 'ACTIVE', updated_at: new Date()}).where('organisation_id', '=', organisationId).where('account_id', '=', accountId).where('state', '=', 'INVITED').returningAll().executeTakeFirst()
    if (!row) notFound('Organisation invitation not found')
    return row
  }

  async createPublisher(accountId: string, input: {publisherId?: unknown; displayName?: unknown; website?: unknown; organisationId?: unknown}) {
    const publisherId = requiredText(input.publisherId, 120, 'Publisher ID is required').toLowerCase()
    if (!/^[a-z][a-z0-9.-]{2,119}$/.test(publisherId) || publisherId === 'modula') invalid('Invalid or reserved publisher ID')
    const displayName = requiredText(input.displayName, 120, 'Publisher display name is required')
    const website = optionalHttpsUrl(input.website)
    const organisationId = optionalText(input.organisationId, 100) || null
    if (organisationId) await this.requireOrganisationRole(accountId, organisationId, ['OWNER', 'ADMIN'])
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx.insertInto('greenfield_publishers').values({publisher_id: publisherId, display_name: displayName, website, status: 'pending', trust_level: 'untrustedManifest', created_at: now, updated_at: now, verified_at: null, suspended_at: null, revoked_at: null}).execute()
      await trx.insertInto('greenfield_publisher_owners').values({publisher_owner_id: uuidv7(), publisher_id: publisherId, owner_type: organisationId ? 'ORGANISATION' : 'ACCOUNT', account_id: organisationId ? null : accountId, organisation_id: organisationId, created_at: now}).execute()
      await new AuditRepository(trx).append('developer.publisher.created', {publisherId, organisationId}, {type: 'publisher', id: publisherId})
    })
    return this.db.selectFrom('greenfield_publishers').selectAll().where('publisher_id', '=', publisherId).executeTakeFirstOrThrow()
  }

  async claimNamespace(accountId: string, publisherId: string, rawNamespace: unknown) {
    await this.requirePublisherAccess(accountId, publisherId)
    const namespace = requiredText(rawNamespace, 180, 'Namespace is required').toLowerCase()
    if (!/^[a-z][a-z0-9]*(\.[a-z0-9][a-z0-9-]*)+$/.test(namespace)) invalid('Invalid publisher namespace')
    if (namespace === 'digital.modula' || namespace.startsWith('digital.modula.')) forbidden('The digital.modula namespace is first-party only')
    const existing = await this.db.selectFrom('greenfield_publisher_namespaces').selectAll().where('namespace', '=', namespace).executeTakeFirst()
    if (existing) conflict('Namespace is already claimed')
    await this.db.insertInto('greenfield_publisher_namespaces').values({namespace, publisher_id: publisherId, verification_method: 'developerClaim', verification_evidence: {requestedByAccountId: accountId}, verified_at: null, revoked_at: null, created_at: new Date()}).execute()
    return {namespace, publisherId, verified: false}
  }

  async verifyNamespace(operatorAccountId: string, namespace: string) {
    await this.requireAdmin(operatorAccountId)
    const row = await this.db.updateTable('greenfield_publisher_namespaces').set({verification_method: 'operatorReview', verified_at: new Date(), revoked_at: null}).where('namespace', '=', namespace.toLowerCase()).returningAll().executeTakeFirst()
    if (!row) notFound('Namespace claim not found')
    return row
  }

  async acceptAgreement(accountId: string, agreementId: string, version: string, documentHash: string) {
    const agreement = await this.db.selectFrom('greenfield_developer_agreements').selectAll().where('agreement_id', '=', agreementId).where('version', '=', version).executeTakeFirst()
    if (!agreement || agreement.effective_at > new Date()) notFound('Agreement not found or not effective')
    if (agreement.document_hash !== documentHash.toLowerCase()) conflict('Agreement document hash does not match')
    const acceptedAt = new Date()
    const row = await this.db.insertInto('greenfield_developer_agreement_acceptances').values({acceptance_id: uuidv7(), agreement_id: agreementId, agreement_version: version, accepted_by_account_id: accountId, accepted_at: acceptedAt, document_hash: agreement.document_hash})
      .onConflict(oc => oc.columns(['agreement_id', 'agreement_version', 'accepted_by_account_id']).doNothing()).returningAll().executeTakeFirst()
    return row ?? this.db.selectFrom('greenfield_developer_agreement_acceptances').selectAll().where('agreement_id', '=', agreementId).where('agreement_version', '=', version).where('accepted_by_account_id', '=', accountId).executeTakeFirstOrThrow()
  }

  async enrol(accountId: string) {
    const now = new Date()
    return this.db.insertInto('greenfield_developer_programme_memberships').values({programme_membership_id: uuidv7(), account_id: accountId, organisation_id: null, state: 'PENDING', state_reason: null, started_at: null, ended_at: null, created_at: now, updated_at: now})
      .onConflict(oc => oc.columns(['account_id', 'organisation_id']).doUpdateSet({state: 'PENDING', state_reason: null, ended_at: null, updated_at: now})).returningAll().executeTakeFirstOrThrow()
  }

  async setProgrammeState(operatorAccountId: string, targetAccountId: string, state: DeveloperProgrammeState, reason?: unknown) {
    await this.requireAdmin(operatorAccountId)
    if (!PROGRAMME_STATES.has(state)) invalid('Invalid programme state')
    const now = new Date()
    const updated = await this.db.updateTable('greenfield_developer_programme_memberships').set({state, state_reason: optionalText(reason, 1_000) || null, started_at: state === 'ACTIVE' ? now : undefined, ended_at: ['TERMINATED'].includes(state) ? now : null, updated_at: now}).where('account_id', '=', targetAccountId).returningAll().executeTakeFirst()
    if (!updated) notFound('Programme membership not found')
    return updated
  }

  async createProduct(accountId: string, input: {productId?: unknown; publisherId?: unknown; organisationId?: unknown; kind?: unknown; displayName?: unknown; description?: unknown; visibility?: unknown}): Promise<DeveloperProductDto> {
    const productId = requiredText(input.productId, 180, 'Product ID is required').toLowerCase()
    if (!/^[a-z0-9]+([.-][a-z0-9]+)+$/.test(productId)) invalid('Invalid product ID')
    const publisherId = requiredText(input.publisherId, 120, 'Publisher ID is required').toLowerCase()
    await this.requirePublisherAccess(accountId, publisherId)
    const namespaceRows = await this.db.selectFrom('greenfield_publisher_namespaces').selectAll().where('publisher_id', '=', publisherId).where('revoked_at', 'is', null).execute()
    if (!namespaceRows.some(row => productId === row.namespace || productId.startsWith(`${row.namespace}.`))) forbidden('Product ID is outside the publisher namespace')
    const kind = String(input.kind) as DeveloperProductKind
    if (!PRODUCT_KINDS.has(kind)) invalid('Invalid product kind')
    const visibility = String(input.visibility ?? 'PRIVATE') as DeveloperProductVisibility
    if (!VISIBILITIES.has(visibility)) invalid('Invalid product visibility')
    const organisationId = optionalText(input.organisationId, 100) || null
    if (organisationId) await this.requireOrganisationRole(accountId, organisationId, ['OWNER', 'ADMIN', 'DEVELOPER'])
    if (visibility === 'PUBLIC') await this.assertPublicPublishingReady(accountId, publisherId)
    const now = new Date()
    const row = await this.db.insertInto('greenfield_developer_products').values({product_id: productId, publisher_id: publisherId, owner_account_id: organisationId ? null : accountId, owner_organisation_id: organisationId, extension_id: null, kind, display_name: requiredText(input.displayName, 120, 'Product display name is required'), description: optionalText(input.description, 2_000), visibility, state: 'DRAFT', created_at: now, updated_at: now}).returningAll().executeTakeFirstOrThrow()
    return mapProduct(row)
  }

  async listProducts(accountId: string): Promise<DeveloperProductDto[]> {
    const orgs = await this.activeOrganisationIds(accountId)
    let query = this.db.selectFrom('greenfield_developer_products').selectAll().where('owner_account_id', '=', accountId)
    if (orgs.length) query = this.db.selectFrom('greenfield_developer_products').selectAll().where(({eb, or}) => or([eb('owner_account_id', '=', accountId), eb('owner_organisation_id', 'in', orgs)]))
    return (await query.orderBy('created_at', 'desc').execute()).map(mapProduct)
  }

  async productDetail(accountId: string, productId: string) {
    const product = await this.requireProductAccess(accountId, productId)
    const [sources, builds, releases, testGroups, reviews] = await Promise.all([
      this.db.selectFrom('greenfield_developer_source_connections').selectAll().where('product_id', '=', productId).orderBy('created_at', 'desc').execute(),
      this.db.selectFrom('greenfield_developer_builds').selectAll().where('product_id', '=', productId).orderBy('created_at', 'desc').limit(100).execute(),
      this.db.selectFrom('greenfield_developer_releases').selectAll().where('product_id', '=', productId).orderBy('created_at', 'desc').limit(100).execute(),
      this.db.selectFrom('greenfield_developer_test_groups').selectAll().where('product_id', '=', productId).orderBy('created_at', 'asc').execute(),
      this.db.selectFrom('greenfield_developer_review_submissions').selectAll().where('product_id', '=', productId).orderBy('created_at', 'desc').limit(100).execute(),
    ])
    return {product: mapProduct(product), sources, builds, releases, testGroups, reviews}
  }

  async connectSource(accountId: string, productId: string, input: {provider?: unknown; repository?: unknown; repositoryId?: unknown; defaultBranch?: unknown; credentialRef?: unknown}) {
    await this.requireProductAccess(accountId, productId)
    const provider = String(input.provider)
    if (!['github', 'gitlab', 'bitbucket', 'self-hosted-git'].includes(provider)) invalid('Invalid source provider')
    const repository = requiredText(input.repository, 300, 'Repository is required')
    const credentialRef = optionalText(input.credentialRef, 300) || null
    if (credentialRef && !credentialRef.startsWith('secret://developer.')) forbidden('Developer credentials must use a scoped secret handle')
    const now = new Date()
    return this.db.insertInto('greenfield_developer_source_connections').values({source_connection_id: uuidv7(), product_id: productId, provider: provider as any, repository, repository_id: optionalText(input.repositoryId, 200) || null, default_branch: optionalText(input.defaultBranch, 120) || 'main', credential_ref: credentialRef, state: 'ACTIVE', created_by_account_id: accountId, created_at: now, updated_at: now, revoked_at: null}).returningAll().executeTakeFirstOrThrow()
  }

  async createTestGroup(accountId: string, productId: string, input: {name?: unknown; kind?: unknown}) {
    await this.requireProductAccess(accountId, productId)
    const kind = String(input.kind)
    if (!['OWNER', 'TEAM', 'INTERNAL', 'ALPHA', 'BETA', 'NAMED'].includes(kind)) invalid('Invalid test group kind')
    const now = new Date()
    return this.db.insertInto('greenfield_developer_test_groups').values({test_group_id: uuidv7(), product_id: productId, name: requiredText(input.name, 120, 'Test group name is required'), kind: kind as any, created_by_account_id: accountId, created_at: now, updated_at: now}).returningAll().executeTakeFirstOrThrow()
  }

  async submitReview(accountId: string, productId: string, input: {developerReleaseId?: unknown; checks?: unknown}) {
    const product = await this.requireProductAccess(accountId, productId)
    await this.assertPublicPublishingReady(accountId, product.publisher_id)
    const releaseId = requiredText(input.developerReleaseId, 120, 'Developer release is required')
    const release = await this.db.selectFrom('greenfield_developer_releases').selectAll().where('developer_release_id', '=', releaseId).where('product_id', '=', productId).executeTakeFirst()
    if (!release) notFound('Developer release not found')
    const now = new Date()
    return this.db.insertInto('greenfield_developer_review_submissions').values({review_submission_id: uuidv7(), product_id: productId, developer_release_id: releaseId, state: 'SUBMITTED', checks: objectValue(input.checks), submitted_by_account_id: accountId, reviewer_account_id: null, decision_reason: null, submitted_at: now, decided_at: null, created_at: now, updated_at: now}).returningAll().executeTakeFirstOrThrow()
  }

  private async requireProductAccess(accountId: string, productId: string) {
    const product = await this.db.selectFrom('greenfield_developer_products').selectAll().where('product_id', '=', productId).executeTakeFirst()
    if (!product) notFound('Product not found')
    if (product.owner_account_id === accountId) return product
    if (product.owner_organisation_id) {
      await this.requireOrganisationRole(accountId, product.owner_organisation_id, ['OWNER', 'ADMIN', 'DEVELOPER', 'RELEASE_MANAGER'])
      return product
    }
    forbidden('Product access denied')
  }

  private async requirePublisherAccess(accountId: string, publisherId: string) {
    const owners = await this.db.selectFrom('greenfield_publisher_owners').selectAll().where('publisher_id', '=', publisherId).execute()
    if (owners.some(owner => owner.account_id === accountId)) return
    for (const owner of owners) {
      if (!owner.organisation_id) continue
      const membership = await this.db.selectFrom('greenfield_developer_organisation_memberships').select(['role', 'state'])
        .where('organisation_id', '=', owner.organisation_id).where('account_id', '=', accountId).executeTakeFirst()
      if (membership?.state === 'ACTIVE' && ['OWNER', 'ADMIN', 'DEVELOPER', 'RELEASE_MANAGER'].includes(membership.role)) return
    }
    forbidden('Publisher access denied')
  }

  private async requireOrganisationRole(accountId: string, organisationId: string, roles: string[]) {
    const membership = await this.db.selectFrom('greenfield_developer_organisation_memberships').selectAll().where('organisation_id', '=', organisationId).where('account_id', '=', accountId).where('state', '=', 'ACTIVE').executeTakeFirst()
    if (!membership || !roles.includes(membership.role)) forbidden('Organisation access denied')
  }

  private async activeOrganisationIds(accountId: string) {
    return (await this.db.selectFrom('greenfield_developer_organisation_memberships').select('organisation_id').where('account_id', '=', accountId).where('state', '=', 'ACTIVE').execute()).map(row => row.organisation_id)
  }

  private async assertPublicPublishingReady(accountId: string, publisherId: string) {
    const [publisher, programme] = await Promise.all([
      this.db.selectFrom('greenfield_publishers').select('status').where('publisher_id', '=', publisherId).executeTakeFirst(),
      this.db.selectFrom('greenfield_developer_programme_memberships').select('state').where('account_id', '=', accountId).executeTakeFirst(),
    ])
    if (publisher?.status !== 'verified') forbidden('Verified publisher required')
    if (programme?.state !== 'ACTIVE') forbidden('Active Developer Programme membership required')
  }

  private async requireAdmin(accountId: string) {
    const account = await this.db.selectFrom('greenfield_accounts').select('primary_handle').where('account_id', '=', accountId).executeTakeFirst()
    if (!account || !this.config.adminHandles.includes(account.primary_handle.toLowerCase())) forbidden('Developer programme administration required')
  }
}

function mapProduct(row: any): DeveloperProductDto {
  return {productId: row.product_id, publisherId: row.publisher_id, ownerAccountId: row.owner_account_id, ownerOrganisationId: row.owner_organisation_id, kind: row.kind, displayName: row.display_name, description: row.description, visibility: row.visibility, state: row.state, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString()}
}
function requiredText(value: unknown, max: number, message: string) { const text = typeof value === 'string' ? value.trim() : ''; if (!text || text.length > max) invalid(message); return text }
function optionalText(value: unknown, max: number) { const text = typeof value === 'string' ? value.trim() : ''; if (text.length > max) invalid('Text value is too long'); return text }
function optionalHttpsUrl(value: unknown) { const text = optionalText(value, 2_048); if (!text) return null; let url: URL; try { url = new URL(text) } catch { invalid('Invalid HTTPS URL') } if (url!.protocol !== 'https:' || url!.username || url!.password) invalid('Invalid HTTPS URL'); return url!.toString() }
function objectValue(value: unknown) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }
function invalid(message: string): never { throw Object.assign(new Error(message), {code: 'VALIDATION_FAILED'}) }
function forbidden(message: string): never { throw Object.assign(new Error(message), {code: 'FORBIDDEN'}) }
function conflict(message: string): never { throw Object.assign(new Error(message), {code: 'CONFLICT'}) }
function notFound(message: string): never { throw Object.assign(new Error(message), {code: 'NOT_FOUND'}) }
