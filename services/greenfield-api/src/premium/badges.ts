import type {ModulaDb} from '../database/client.js'

export const PREMIUM_TIERS = ['core', 'plus', 'horizon', 'horizon_plus', 'studio'] as const
export type PremiumTier = (typeof PREMIUM_TIERS)[number]
export const VERIFICATION_TYPES = ['person', 'notable_person', 'organization', 'public_body', 'official_module_developer'] as const
export type VerificationType = (typeof VERIFICATION_TYPES)[number]
export type VerificationMark = 'blue_identity_seal' | 'ink_squircle' | 'slate_hexagon' | 'developer_seal'

export type PublicIdentitySummary = {
  schemaVersion: 1
  verification: {status: 'unverified' | 'verified'; type: VerificationType | null; mark: VerificationMark | null}
  membership: {tier: PremiumTier; status: 'core' | 'active' | 'expired' | 'revoked' | 'downgraded'; badgeVisible: boolean; mark: 'modula_unit' | null}
  publicIdentity: {
    schemaVersion: 1
    verification: {status: 'unverified' | 'verified'; type: VerificationType | null; mark: VerificationMark | null}
    membership: {tier: PremiumTier; status: 'core' | 'active' | 'expired' | 'revoked' | 'downgraded'; badgeVisible: boolean; mark: 'modula_unit' | null}
  }
  premiumTier: Exclude<PremiumTier, 'core'> | null
  premiumSince: string | null
  premiumBadgeVisible: boolean
  verificationStatus: 'unverified' | 'verified'
  verifiedType: VerificationType | null
  isVerified: boolean
}

export const EMPTY_PUBLIC_IDENTITY: PublicIdentitySummary = Object.freeze({
  schemaVersion: 1,
  verification: Object.freeze({status: 'unverified', type: null, mark: null}),
  membership: Object.freeze({tier: 'core', status: 'core', badgeVisible: false, mark: null}),
  publicIdentity: Object.freeze({
    schemaVersion: 1,
    verification: Object.freeze({status: 'unverified', type: null, mark: null}),
    membership: Object.freeze({tier: 'core', status: 'core', badgeVisible: false, mark: null}),
  }),
  premiumTier: null,
  premiumSince: null,
  premiumBadgeVisible: false,
  verificationStatus: 'unverified',
  verifiedType: null,
  isVerified: false,
})

let premiumEnabled = false
let verificationEnabled = false
const CACHE_TTL_MS = 15_000
const cache = new Map<string, {expiresAt: number; value: PublicIdentitySummary}>()

export function setPublicIdentityProjectionEnabled(input: {premium: boolean; verification: boolean}) {
  premiumEnabled = input.premium
  verificationEnabled = input.verification
  cache.clear()
}

export function invalidatePublicIdentity(actorIds?: string[]) {
  if (!actorIds) cache.clear()
  else for (const actorId of actorIds) cache.delete(actorId)
}

export function verificationMark(type: VerificationType): VerificationMark {
  if (type === 'organization') return 'ink_squircle'
  if (type === 'public_body') return 'slate_hexagon'
  if (type === 'official_module_developer') return 'developer_seal'
  return 'blue_identity_seal'
}

/**
 * Canonical batched public projection. It never reads profile identity claims,
 * payment identifiers, application evidence or review notes.
 */
export async function publicIdentitiesForActors(db: ModulaDb, actorIds: string[]): Promise<Map<string, PublicIdentitySummary>> {
  const ids = [...new Set(actorIds.filter(Boolean))]
  const result = new Map<string, PublicIdentitySummary>()
  const missing: string[] = []
  const nowMs = Date.now()
  for (const id of ids) {
    const hit = cache.get(id)
    if (hit && hit.expiresAt > nowMs) result.set(id, hit.value)
    else missing.push(id)
  }
  if (missing.length === 0) return result
  if (!premiumEnabled && !verificationEnabled) {
    for (const id of missing) result.set(id, EMPTY_PUBLIC_IDENTITY)
    return result
  }

  const values = new Map<string, PublicIdentitySummary>()
  for (const id of missing) values.set(id, structuredClone(EMPTY_PUBLIC_IDENTITY))
  const now = new Date()

  if (premiumEnabled) {
    const rows = await db.selectFrom('actors')
      .leftJoin('greenfield_premium_memberships', 'greenfield_premium_memberships.account_id', 'actors.account_id')
      .leftJoin('greenfield_premium_preferences', 'greenfield_premium_preferences.account_id', 'actors.account_id')
      .select([
        'actors.id as actor_id',
        'greenfield_premium_memberships.tier_id',
        'greenfield_premium_memberships.subscription_status',
        'greenfield_premium_memberships.effective_at',
        'greenfield_premium_memberships.expires_at',
        'greenfield_premium_memberships.membership_since',
        'greenfield_premium_preferences.badge_visible',
      ])
      .where('actors.id', 'in', missing)
      .execute()
    for (const row of rows) {
      const current = values.get(row.actor_id) ?? structuredClone(EMPTY_PUBLIC_IDENTITY)
      const tier = (row.tier_id ?? 'core') as PremiumTier
      const recordedStatus = row.subscription_status ?? 'core'
      const active = recordedStatus === 'active'
        && row.effective_at !== null
        && row.effective_at.getTime() <= now.getTime()
        && (!row.expires_at || row.expires_at.getTime() > now.getTime())
      const effectiveTier = active ? tier : 'core'
      const effectiveStatus = recordedStatus === 'active' && !active ? 'expired' : recordedStatus
      const badgeVisible = active && effectiveTier !== 'core' && row.badge_visible !== false
      values.set(row.actor_id, {
        ...current,
        membership: {tier: effectiveTier, status: active ? 'active' : effectiveStatus, badgeVisible, mark: badgeVisible ? 'modula_unit' : null},
        publicIdentity: {...current.publicIdentity, membership: {tier: effectiveTier, status: active ? 'active' : effectiveStatus, badgeVisible, mark: badgeVisible ? 'modula_unit' : null}},
        premiumTier: effectiveTier === 'core' ? null : effectiveTier,
        premiumSince: effectiveTier === 'core' ? null : row.membership_since?.toISOString() ?? null,
        premiumBadgeVisible: badgeVisible,
      })
    }
  }

  if (verificationEnabled) {
    const rows = await db.selectFrom('actors')
      .innerJoin('greenfield_verification_statuses', 'greenfield_verification_statuses.account_id', 'actors.account_id')
      .select(['actors.id as actor_id', 'greenfield_verification_statuses.state', 'greenfield_verification_statuses.verification_type', 'greenfield_verification_statuses.reverification_due_at'])
      .where('actors.id', 'in', missing)
      .where('greenfield_verification_statuses.state', '=', 'verified')
      .execute()
    for (const row of rows) {
      if (!row.verification_type || (row.reverification_due_at && row.reverification_due_at.getTime() <= now.getTime())) continue
      const current = values.get(row.actor_id) ?? structuredClone(EMPTY_PUBLIC_IDENTITY)
      const type = row.verification_type as VerificationType
      values.set(row.actor_id, {
        ...current,
        verification: {status: 'verified', type, mark: verificationMark(type)},
        publicIdentity: {...current.publicIdentity, verification: {status: 'verified', type, mark: verificationMark(type)}},
        verificationStatus: 'verified',
        verifiedType: type,
        isVerified: true,
      })
    }
  }

  for (const id of missing) {
    const value = values.get(id) ?? EMPTY_PUBLIC_IDENTITY
    cache.set(id, {expiresAt: nowMs + CACHE_TTL_MS, value})
    result.set(id, value)
  }
  return result
}

export async function publicIdentityForActor(db: ModulaDb, actorId: string): Promise<PublicIdentitySummary> {
  return (await publicIdentitiesForActors(db, [actorId])).get(actorId) ?? EMPTY_PUBLIC_IDENTITY
}

/** Compatibility aliases retained for existing social repositories. */
export const badgesForActors = publicIdentitiesForActors
export const badgesForActor = publicIdentityForActor
export type PublicBadgeFields = PublicIdentitySummary
export const NO_BADGES = EMPTY_PUBLIC_IDENTITY
