import {sql} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'
import {invalidatePublicIdentity, PREMIUM_TIERS, publicIdentityForActor, type PremiumTier} from './badges.js'

export type MembershipStatus = 'active' | 'expired' | 'revoked' | 'downgraded'

type PurchaseStatus = {
  enabled: boolean
  environment: 'sandbox'
  reason: string | null
  products: Array<{productId: string; tier: Exclude<PremiumTier, 'core'>; billingPeriod: 'monthly' | 'annual'; environment: 'sandbox'; state: 'active' | 'disabled'}>
}

export class PremiumService {
  constructor(
    private readonly db: ModulaDb,
    private readonly qaCapabilityEvaluation: boolean,
    private readonly loadPurchaseStatus: () => Promise<PurchaseStatus>,
  ) {}

  async catalogue() {
    const version = await this.activeCatalogueVersion()
    const [tiers, capabilities] = await Promise.all([
      this.db.selectFrom('greenfield_premium_tiers').selectAll().where('catalogue_version', '=', version).orderBy('rank').execute(),
      this.db.selectFrom('greenfield_premium_capabilities').selectAll().where('catalogue_version', '=', version).orderBy('capability_id').execute(),
    ])
    const purchase = await this.loadPurchaseStatus()
    return {
      schemaVersion: 1,
      catalogueVersion: version,
      pricingStatus: 'supplied_display_only',
      purchase,
      tiers: tiers.map(row => {
        const metadata = objectValue(row.metadata)
        return {
          id: row.tier_id,
          displayName: row.display_name,
          rank: row.rank,
          paid: row.paid,
          price: null,
          displayPrice: typeof metadata.displayPrice === 'string' ? metadata.displayPrice : null,
          products: purchase.products.filter(product => product.tier === row.tier_id),
          metadata,
        }
      }),
      capabilities: capabilities.map(row => ({id: row.capability_id, displayName: row.display_name, minimumRank: row.minimum_rank, availabilityMode: row.availability_mode, metadata: row.metadata})),
    }
  }

  async membership(accountId: string, actorId: string) {
    const row = await this.db.selectFrom('greenfield_premium_memberships').selectAll().where('account_id', '=', accountId).executeTakeFirst()
    const preference = await this.db.selectFrom('greenfield_premium_preferences').select('badge_visible').where('account_id', '=', accountId).executeTakeFirst()
    const now = new Date()
    const active = Boolean(row && (row.subscription_status === 'active' || row.subscription_status === 'grace') && row.effective_at <= now && (!row.expires_at || row.expires_at > now))
    const tier: PremiumTier = active && row ? row.tier_id : 'core'
    const effectiveStatus = (row?.subscription_status === 'active' || row?.subscription_status === 'grace') && !active ? 'expired' : row?.subscription_status ?? 'core'
    return {
      schemaVersion: 1,
      accountId,
      tier,
      recordedTier: row?.tier_id ?? 'core',
      subscriptionStatus: active ? row!.subscription_status : effectiveStatus,
      entitlementSource: row?.entitlement_source ?? 'platform_default',
      effectiveAt: row?.effective_at.toISOString() ?? null,
      expiresAt: row?.expires_at?.toISOString() ?? null,
      membershipSince: row?.membership_since?.toISOString() ?? null,
      badgeVisible: preference?.badge_visible ?? true,
      revision: row?.revision ?? 0,
      renewal: {known: false, renewsAt: null},
      purchase: await this.loadPurchaseStatus(),
      publicIdentity: await publicIdentityForActor(this.db, actorId),
      serverTime: now.toISOString(),
    }
  }

  async effectiveEntitlements(accountId: string, actorId: string) {
    const membership = await this.membership(accountId, actorId)
    const version = await this.activeCatalogueVersion()
    const tiers = await this.db.selectFrom('greenfield_premium_tiers').select(['tier_id', 'rank']).where('catalogue_version', '=', version).execute()
    const tierRank = new Map(tiers.map(row => [row.tier_id, row.rank]))
    const currentRank = tierRank.get(membership.tier) ?? 0
    const capabilities = await this.db.selectFrom('greenfield_premium_capabilities').selectAll().where('catalogue_version', '=', version).orderBy('capability_id').execute()
    return {
      schemaVersion: 1,
      catalogueVersion: version,
      tier: membership.tier,
      subscriptionStatus: membership.subscriptionStatus,
      capabilities: capabilities.map(capability => {
        const available = capability.availability_mode === 'existing_free'
          || (capability.availability_mode === 'qa_only' && this.qaCapabilityEvaluation && currentRank >= capability.minimum_rank)
        return {
          id: capability.capability_id,
          available,
          value: valueForTier(capability.value_by_tier, membership.tier),
          mode: capability.availability_mode,
          reason: available
            ? capability.availability_mode === 'existing_free'
              ? 'existing_free_feature'
              : membership.entitlementSource === 'apple_verified'
                ? 'verified_apple_sandbox_entitlement'
                : 'qa_membership_entitlement'
            : capability.availability_mode === 'future_disabled' ? 'future_feature_disabled' : 'tier_or_environment_not_eligible',
        }
      }),
    }
  }

  async feature(accountId: string, actorId: string, capabilityId: string) {
    const evaluated = await this.effectiveEntitlements(accountId, actorId)
    const capability = evaluated.capabilities.find(item => item.id === capabilityId)
    if (!capability) notFound('Capability not found')
    return {...capability, catalogueVersion: evaluated.catalogueVersion, tier: evaluated.tier}
  }

  async setBadgeVisibility(accountId: string, actorId: string, visible: boolean) {
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      const membership = await trx.selectFrom('greenfield_premium_memberships').select(['tier_id', 'subscription_status']).where('account_id', '=', accountId).executeTakeFirst()
      await trx.insertInto('greenfield_premium_preferences').values({account_id: accountId, badge_visible: visible, revision: 1, updated_by_actor_id: actorId, updated_at: now})
        .onConflict(oc => oc.column('account_id').doUpdateSet({badge_visible: visible, revision: sql<number>`greenfield_premium_preferences.revision + 1`, updated_by_actor_id: actorId, updated_at: now})).execute()
      await trx.insertInto('greenfield_premium_membership_events').values({
        event_id: uuidv7(), account_id: accountId, event_type: 'badge_visibility_changed', previous_tier_id: membership?.tier_id ?? null,
        tier_id: membership?.tier_id ?? 'core', previous_status: membership?.subscription_status ?? null,
        subscription_status: membership?.subscription_status ?? 'active', source: 'account_preference',
        idempotency_key: `badge:${accountId}:${now.getTime()}:${visible}`, actor_id: actorId, audit_metadata: {visible}, occurred_at: now,
      }).execute()
    })
    await this.invalidateAccount(accountId)
    return this.membership(accountId, actorId)
  }

  /** Non-production fixture operation. The route is absent unless explicitly enabled. */
  async assignQaFixture(adminActorId: string, handle: string, input: Record<string, unknown>, idempotencyKey: string) {
    const normalized = handle.replace(/^@/, '').toLowerCase()
    const account = await this.db.selectFrom('greenfield_accounts').selectAll().where(sql`lower(primary_handle)`, '=', normalized).executeTakeFirst()
    if (!account) notFound('Account not found')
    const tier = String(input.tier ?? '') as PremiumTier
    if (!PREMIUM_TIERS.includes(tier)) invalid('tier must be core, plus, horizon, horizon_plus or studio')
    const status = String(input.subscriptionStatus ?? 'active') as MembershipStatus
    if (!['active', 'expired', 'revoked', 'downgraded'].includes(status)) invalid('Invalid subscriptionStatus')
    const replay = await this.db.selectFrom('greenfield_premium_membership_events').select('event_id').where('idempotency_key', '=', idempotencyKey).executeTakeFirst()
    if (replay) return this.membershipForAccount(account.account_id)

    const version = await this.activeCatalogueVersion()
    const existing = await this.db.selectFrom('greenfield_premium_memberships').selectAll().where('account_id', '=', account.account_id).executeTakeFirst()
    const now = new Date()
    const effectiveAt = parseDate(input.effectiveAt, now)
    const expiresAt = input.expiresAt == null ? null : parseDate(input.expiresAt)
    if (expiresAt && expiresAt <= effectiveAt) invalid('expiresAt must be after effectiveAt')
    const membershipSince = tier !== 'core'
      ? existing?.membership_since ?? parseDate(input.membershipSince, effectiveAt)
      : existing?.membership_since ?? null
    const nextRevision = (existing?.revision ?? 0) + 1
    const eventType = status === 'expired' ? 'expired' : status === 'revoked' ? 'revoked' : status === 'downgraded' || tier === 'core' ? 'downgraded' : 'assigned'

    await this.db.transaction().execute(async trx => {
      await trx.insertInto('greenfield_premium_memberships').values({
        account_id: account.account_id, catalogue_version: version, tier_id: tier, subscription_status: status,
        entitlement_source: 'qa_fixture', effective_at: effectiveAt, expires_at: expiresAt, membership_since: membershipSince,
        revision: nextRevision, provider_reference_hash: null, audit_metadata: {fixture: true}, created_at: existing?.created_at ?? now, updated_at: now,
      }).onConflict(oc => oc.column('account_id').doUpdateSet({
        catalogue_version: version, tier_id: tier, subscription_status: status, entitlement_source: 'qa_fixture',
        effective_at: effectiveAt, expires_at: expiresAt, membership_since: membershipSince, revision: nextRevision,
        provider_reference_hash: null, audit_metadata: {fixture: true}, updated_at: now,
      })).execute()
      await trx.insertInto('greenfield_premium_membership_events').values({
        event_id: uuidv7(), account_id: account.account_id, event_type: eventType, previous_tier_id: existing?.tier_id ?? null,
        tier_id: tier, previous_status: existing?.subscription_status ?? null, subscription_status: status, source: 'qa_fixture',
        idempotency_key: idempotencyKey, actor_id: adminActorId, audit_metadata: {fixture: true}, occurred_at: now,
      }).execute()
    })
    await this.invalidateAccount(account.account_id)
    return this.membershipForAccount(account.account_id)
  }

  private async membershipForAccount(accountId: string) {
    const actor = await this.db.selectFrom('actors').select('id').where('account_id', '=', accountId).where('deleted_at', 'is', null).orderBy('created_at').executeTakeFirst()
    if (!actor) notFound('Account actor not found')
    return this.membership(accountId, actor.id)
  }

  private async invalidateAccount(accountId: string) {
    const actors = await this.db.selectFrom('actors').select('id').where('account_id', '=', accountId).execute()
    invalidatePublicIdentity(actors.map(row => row.id))
  }

  private async activeCatalogueVersion() {
    const row = await this.db.selectFrom('greenfield_premium_catalogue_versions').select('catalogue_version').where('status', '=', 'active').executeTakeFirst()
    if (!row) throw Object.assign(new Error('Premium catalogue unavailable'), {code: 'CAPABILITY_UNAVAILABLE'})
    return row.catalogue_version
  }
}

function valueForTier(value: unknown, tier: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return (value as Record<string, unknown>)[tier] ?? null
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function parseDate(value: unknown, fallback?: Date) {
  if (value == null && fallback) return fallback
  const date = new Date(String(value ?? ''))
  if (Number.isNaN(date.getTime())) invalid('Invalid timestamp')
  return date
}

function invalid(message: string): never { throw Object.assign(new Error(message), {code: 'VALIDATION_FAILED'}) }
function notFound(message: string): never { throw Object.assign(new Error(message), {code: 'NOT_FOUND'}) }
