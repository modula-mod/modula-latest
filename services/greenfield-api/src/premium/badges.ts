import type {ModulaDb} from '../database/client.js'

export const PREMIUM_TIERS = ['core', 'plus', 'horizon', 'horizon_plus', 'studio'] as const
export type PremiumTier = (typeof PREMIUM_TIERS)[number]
export const VERIFIED_TYPES = ['person', 'organisation', 'official'] as const
export type VerifiedType = (typeof VERIFIED_TYPES)[number]

/** Public badge fields embedded wherever an author or profile is returned. */
export type PublicBadgeFields = {
  /** Paid tier with an active or grace entitlement; null for Core / none. */
  premiumTier: Exclude<PremiumTier, 'core'> | null
  /** Tenure start (never reset). Only set while premiumTier is set. */
  premiumSince: string | null
  /** Trust mark, independent of billing. */
  verifiedType: VerifiedType | null
  /** Convenience mirror of verifiedType !== null for existing native decoders. */
  isVerified: boolean
}

export const NO_BADGES: PublicBadgeFields = Object.freeze({premiumTier: null, premiumSince: null, verifiedType: null, isVerified: false})

let badgesEnabled = false

/** Set once at boot from MODULA_PREMIUM_ENTITLEMENTS_ENABLED. When off, every payload carries the empty defaults and no premium table is read. */
export function setPremiumBadgesEnabled(enabled: boolean) { badgesEnabled = enabled }
export function premiumBadgesEnabled() { return badgesEnabled }

/** Entitled statuses: Apple keeps service during the grace period, not during billing retry. */
export const ENTITLED_STATUSES = ['active', 'grace'] as const

export function isEntitledNow(row: {status: string; expires_at: Date | null; grace_expires_at: Date | null}, now = new Date()) {
  if (row.status === 'active') return !row.expires_at || row.expires_at.getTime() > now.getTime()
  if (row.status === 'grace') return !row.grace_expires_at || row.grace_expires_at.getTime() > now.getTime()
  return false
}

/** One batched read for a set of actors. Missing actors get NO_BADGES. */
export async function badgesForActors(db: ModulaDb, actorIds: string[]): Promise<Map<string, PublicBadgeFields>> {
  const ids = [...new Set(actorIds.filter(Boolean))]
  const result = new Map<string, PublicBadgeFields>()
  for (const id of ids) result.set(id, NO_BADGES)
  if (!badgesEnabled || ids.length === 0) return result
  const now = new Date()
  const [entitlements, members, verifications] = await Promise.all([
    db.selectFrom('greenfield_premium_entitlements')
      .innerJoin('greenfield_premium_tiers', 'greenfield_premium_tiers.tier_id', 'greenfield_premium_entitlements.tier_id')
      .select(['greenfield_premium_entitlements.actor_id', 'greenfield_premium_entitlements.tier_id', 'greenfield_premium_entitlements.status', 'greenfield_premium_entitlements.expires_at', 'greenfield_premium_entitlements.grace_expires_at', 'greenfield_premium_tiers.rank'])
      .where('greenfield_premium_entitlements.actor_id', 'in', ids)
      .where('greenfield_premium_entitlements.status', 'in', [...ENTITLED_STATUSES])
      .execute(),
    db.selectFrom('greenfield_premium_members').select(['actor_id', 'member_since']).where('actor_id', 'in', ids).execute(),
    db.selectFrom('greenfield_verifications').select(['actor_id', 'verified_type']).where('actor_id', 'in', ids).where('state', '=', 'verified').execute(),
  ])
  const since = new Map(members.map(row => [row.actor_id, row.member_since]))
  const best = new Map<string, {tier: string; rank: number}>()
  for (const row of entitlements) {
    if (!isEntitledNow(row, now) || row.tier_id === 'core') continue
    const current = best.get(row.actor_id)
    if (!current || row.rank > current.rank) best.set(row.actor_id, {tier: row.tier_id, rank: row.rank})
  }
  const verified = new Map(verifications.map(row => [row.actor_id, row.verified_type as VerifiedType]))
  for (const id of ids) {
    const tier = best.get(id)?.tier as PublicBadgeFields['premiumTier'] | undefined
    const verifiedType = verified.get(id) ?? null
    result.set(id, {
      premiumTier: tier ?? null,
      premiumSince: tier ? since.get(id)?.toISOString() ?? null : null,
      verifiedType,
      isVerified: verifiedType !== null,
    })
  }
  return result
}

export async function badgesForActor(db: ModulaDb, actorId: string): Promise<PublicBadgeFields> {
  return (await badgesForActors(db, [actorId])).get(actorId) ?? NO_BADGES
}
