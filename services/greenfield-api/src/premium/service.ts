import {createHash, randomUUID} from 'node:crypto'
import {sql} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'
import type {AppleJwsVerifier, AppleNotification, AppleTransaction} from './apple-verifier.js'
import {badgesForActor, isEntitledNow, VERIFIED_TYPES, type PublicBadgeFields, type VerifiedType} from './badges.js'

export type EntitlementStatus = 'active' | 'grace' | 'billing_retry' | 'expired' | 'revoked'

type EntitlementRow = {
  entitlement_id: string
  actor_id: string
  tier_id: string
  source: string
  environment: string
  product_id: string | null
  original_transaction_id: string | null
  latest_transaction_id: string | null
  status: EntitlementStatus
  auto_renew: boolean | null
  started_at: Date
  expires_at: Date | null
  grace_expires_at: Date | null
  revoked_at: Date | null
  revocation_reason: string | null
  last_signed_at: Date | null
}

/** Notification types that change status. Anything else is recorded and acknowledged without a state change. */
const RENEWING = new Set(['SUBSCRIBED', 'DID_RENEW', 'OFFER_REDEEMED', 'REFUND_REVERSED', 'RENEWAL_EXTENDED'])
const KEEP_STATUS = new Set(['DID_CHANGE_RENEWAL_PREF', 'DID_CHANGE_RENEWAL_STATUS', 'PRICE_INCREASE', 'REFUND_DECLINED', 'CONSUMPTION_REQUEST', 'RENEWAL_EXTENSION', 'METADATA_UPDATE', 'MIGRATION', 'PRICE_CHANGE', 'RESCIND_CONSENT'])

/**
 * Modula Premium entitlements. Billing events only ever change gating:
 * rows are never deleted, and nothing here touches outfits, ownership,
 * character state or the verification table.
 */
export class PremiumService {
  constructor(private readonly db: ModulaDb, private readonly verifier: AppleJwsVerifier | null) {}

  async me(actorId: string) {
    const member = await this.ensureMember(actorId)
    const rows = await this.db.selectFrom('greenfield_premium_entitlements').selectAll().where('actor_id', '=', actorId).orderBy('created_at', 'asc').execute() as EntitlementRow[]
    const tiers = await this.tierCatalogue()
    const now = new Date()
    const subscriptions = rows.map(row => present(row, tiers, now))
    const entitled = subscriptions.filter(item => item.entitled).sort((a, b) => (tiers.get(b.tier)?.rank ?? 0) - (tiers.get(a.tier)?.rank ?? 0))
    const current = entitled[0] ?? subscriptions.slice().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0] ?? null
    const tier = entitled[0]?.tier ?? 'core'
    const verification = await this.verification(actorId)
    const badges: PublicBadgeFields = await badgesForActor(this.db, actorId)
    return {
      tier,
      tierName: tiers.get(tier)?.displayName ?? 'Modula Core',
      isPremium: tier !== 'core',
      status: current ? current.status : 'none',
      source: current?.source ?? null,
      productId: current?.productId ?? null,
      originalTransactionId: current?.originalTransactionId ?? null,
      expiresAt: current?.expiresAt ?? null,
      graceExpiresAt: current?.graceExpiresAt ?? null,
      autoRenew: current?.autoRenew ?? null,
      environment: current?.environment ?? null,
      memberSince: member.member_since?.toISOString() ?? null,
      appAccountToken: member.app_account_token,
      verification,
      badges,
      subscriptions,
      serverTime: now.toISOString(),
    }
  }

  /** POST /v1/premium/apple/transactions: a StoreKit 2 jwsRepresentation from the signed-in user's device. */
  async applyClientTransaction(actorId: string, jws: unknown) {
    const transaction = await this.requireVerifier().verifyTransaction(String(jws ?? ''))
    const member = await this.ensureMember(actorId)
    if (!transaction.appAccountToken) forbidden('APP_ACCOUNT_TOKEN_MISSING')
    if (transaction.appAccountToken !== member.app_account_token) forbidden('APP_ACCOUNT_TOKEN_MISMATCH')
    await this.upsertFromTransaction(actorId, transaction, null, 'client_transaction', hashOf(jws))
    return this.me(actorId)
  }

  /** POST /v1/premium/apple/notifications: App Store Server Notifications V2. */
  async applyNotification(body: unknown) {
    const signedPayload = (body && typeof body === 'object' ? (body as any).signedPayload : undefined)
    const notification = await this.requireVerifier().verifyNotification(String(signedPayload ?? ''))
    const replay = await this.db.selectFrom('greenfield_premium_events').select('event_id').where('notification_uuid', '=', notification.notificationUUID).executeTakeFirst()
    if (replay) return {accepted: true, replay: true, notificationType: notification.notificationType}
    const payloadHash = hashOf(signedPayload)
    const transaction = notification.transaction
    if (!transaction) {
      await this.recordEvent({entitlementId: null, actorId: null, source: 'apple_notification', notification, previousStatus: null, status: null, payloadHash})
      return {accepted: true, replay: false, notificationType: notification.notificationType, applied: false}
    }
    const existing = await this.byOriginal(transaction.originalTransactionId)
    let actorId = existing?.actor_id ?? null
    if (!actorId && transaction.appAccountToken) {
      const member = await this.db.selectFrom('greenfield_premium_members').select('actor_id').where('app_account_token', '=', transaction.appAccountToken).executeTakeFirst()
      actorId = member?.actor_id ?? null
    }
    if (!actorId) {
      // Unknown subscriber: acknowledge so Apple stops retrying, keep the audit row.
      await this.recordEvent({entitlementId: null, actorId: null, source: 'apple_notification', notification, previousStatus: null, status: null, payloadHash})
      return {accepted: true, replay: false, notificationType: notification.notificationType, applied: false}
    }
    const applied = await this.upsertFromTransaction(actorId, transaction, notification, 'apple_notification', payloadHash)
    return {accepted: true, replay: false, notificationType: notification.notificationType, applied: applied.changed, status: applied.status}
  }

  /** Admin (QA) only. Never reachable from billing code paths. */
  async setVerification(adminActorId: string, handle: string, input: Record<string, unknown>) {
    const profile = await this.db.selectFrom('profiles').select(['actor_id', 'handle']).where(sql`lower(handle)`, '=', handle.replace(/^@/, '').toLowerCase()).where('deleted_at', 'is', null).executeTakeFirst()
    if (!profile) notFound('Profile not found')
    const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 280) || null : null
    const now = new Date()
    if (input.verifiedType === null) {
      await this.db.updateTable('greenfield_verifications').set({state: 'revoked', revoked_at: now, reason, set_by_actor_id: adminActorId, updated_at: now}).where('actor_id', '=', profile.actor_id).execute()
    } else {
      const verifiedType = String(input.verifiedType ?? '') as VerifiedType
      if (!VERIFIED_TYPES.includes(verifiedType)) invalid('verifiedType must be person, organisation, official or null')
      await this.db.insertInto('greenfield_verifications').values({actor_id: profile.actor_id, verified_type: verifiedType, state: 'verified', verified_at: now, revoked_at: null, reason, set_by_actor_id: adminActorId, updated_at: now})
        .onConflict(oc => oc.column('actor_id').doUpdateSet({verified_type: verifiedType, state: 'verified', verified_at: now, revoked_at: null, reason, set_by_actor_id: adminActorId, updated_at: now})).execute()
    }
    return {handle: profile.handle, verification: await this.verification(profile.actor_id), badges: await badgesForActor(this.db, profile.actor_id)}
  }

  private async upsertFromTransaction(actorId: string, transaction: AppleTransaction, notification: AppleNotification | null, source: 'client_transaction' | 'apple_notification', payloadHash: string) {
    const product = await this.db.selectFrom('greenfield_premium_products').select(['product_id', 'tier_id']).where('product_id', '=', transaction.productId).executeTakeFirst()
    if (!product) invalid('Unknown Modula Premium product')
    const existing = await this.byOriginal(transaction.originalTransactionId)
    if (existing && existing.actor_id !== actorId) conflict('This App Store subscription belongs to another Modula account')
    const now = new Date()
    const signedAt = new Date(notification?.signedDate ?? transaction.signedDate ?? now.getTime())
    const expiresAt = transaction.expiresDate ? new Date(transaction.expiresDate) : null
    const stale = Boolean(existing?.last_signed_at && existing.last_signed_at.getTime() > signedAt.getTime())
    const previousStatus = existing?.status ?? null
    let next = nextState(existing, transaction, notification, now)
    if (stale && existing) next = {status: existing.status, graceExpiresAt: existing.grace_expires_at, autoRenew: existing.auto_renew}
    const entitlementId = existing?.entitlement_id ?? uuidv7()
    await this.db.transaction().execute(async trx => {
      if (!existing) {
        await trx.insertInto('greenfield_premium_entitlements').values({
          entitlement_id: entitlementId, actor_id: actorId, tier_id: product.tier_id, source: 'apple', environment: transaction.environment === 'Production' ? 'Production' : 'Sandbox',
          product_id: product.product_id, original_transaction_id: transaction.originalTransactionId, latest_transaction_id: transaction.transactionId,
          status: next.status, auto_renew: next.autoRenew, started_at: new Date(transaction.originalPurchaseDate ?? transaction.purchaseDate ?? now.getTime()),
          expires_at: expiresAt, grace_expires_at: next.graceExpiresAt, revoked_at: next.status === 'revoked' ? new Date(transaction.revocationDate ?? now.getTime()) : null,
          revocation_reason: next.status === 'revoked' ? revocationReason(transaction, notification) : null, last_signed_at: signedAt, created_at: now, updated_at: now,
        }).execute()
      } else if (!stale) {
        await trx.updateTable('greenfield_premium_entitlements').set({
          tier_id: product.tier_id, product_id: product.product_id, latest_transaction_id: transaction.transactionId, status: next.status, auto_renew: next.autoRenew,
          expires_at: expiresAt ?? existing.expires_at, grace_expires_at: next.graceExpiresAt,
          revoked_at: next.status === 'revoked' ? existing.revoked_at ?? new Date(transaction.revocationDate ?? now.getTime()) : null,
          revocation_reason: next.status === 'revoked' ? existing.revocation_reason ?? revocationReason(transaction, notification) : null,
          last_signed_at: signedAt, updated_at: now,
        }).where('entitlement_id', '=', entitlementId).execute()
      }
      if (next.status === 'active' || next.status === 'grace') {
        // Tenure starts at the first paid moment and is never reset by later downgrades or expiry.
        const firstPaid = new Date(transaction.originalPurchaseDate ?? transaction.purchaseDate ?? now.getTime())
        await trx.updateTable('greenfield_premium_members').set({member_since: sql<Date>`LEAST(COALESCE(member_since, ${firstPaid}), ${firstPaid})`, updated_at: now}).where('actor_id', '=', actorId).execute()
      }
      await this.recordEvent({entitlementId, actorId, source, notification, previousStatus, status: next.status, payloadHash}, trx as unknown as ModulaDb)
    })
    return {changed: !stale && previousStatus !== next.status, status: next.status}
  }

  private async recordEvent(input: {entitlementId: string | null; actorId: string | null; source: string; notification: AppleNotification | null; previousStatus: string | null; status: string | null; payloadHash: string}, database: ModulaDb = this.db) {
    await database.insertInto('greenfield_premium_events').values({
      event_id: uuidv7(), entitlement_id: input.entitlementId, actor_id: input.actorId, source: input.source,
      notification_uuid: input.notification?.notificationUUID ?? null, notification_type: input.notification?.notificationType ?? null, notification_subtype: input.notification?.subtype ?? null,
      previous_status: input.previousStatus, status: input.status, payload_sha256: input.payloadHash, occurred_at: new Date(),
    }).onConflict(oc => oc.column('notification_uuid').doNothing()).execute()
  }

  private async ensureMember(actorId: string) {
    await this.db.insertInto('greenfield_premium_members').values({actor_id: actorId, app_account_token: randomUUID(), member_since: null, created_at: new Date(), updated_at: new Date()}).onConflict(oc => oc.column('actor_id').doNothing()).execute()
    const row = await this.db.selectFrom('greenfield_premium_members').selectAll().where('actor_id', '=', actorId).executeTakeFirstOrThrow()
    return {...row, app_account_token: String(row.app_account_token).toLowerCase()}
  }

  private async verification(actorId: string) {
    const row = await this.db.selectFrom('greenfield_verifications').selectAll().where('actor_id', '=', actorId).executeTakeFirst()
    if (!row) return null
    return {type: row.verified_type, state: row.state, verifiedAt: row.verified_at.toISOString(), revokedAt: row.revoked_at?.toISOString() ?? null}
  }

  private async byOriginal(originalTransactionId: string) {
    return await this.db.selectFrom('greenfield_premium_entitlements').selectAll().where('original_transaction_id', '=', originalTransactionId).executeTakeFirst() as EntitlementRow | undefined
  }

  private async tierCatalogue() {
    const rows = await this.db.selectFrom('greenfield_premium_tiers').selectAll().execute()
    return new Map(rows.map(row => [row.tier_id, {displayName: row.display_name, rank: row.rank}]))
  }

  private requireVerifier() {
    if (!this.verifier) throw Object.assign(new Error('App Store verification is not configured'), {code: 'FORBIDDEN'})
    return this.verifier
  }
}

export function nextState(existing: Pick<EntitlementRow, 'status' | 'grace_expires_at' | 'auto_renew'> | undefined, transaction: AppleTransaction, notification: AppleNotification | null, now: Date): {status: EntitlementStatus; graceExpiresAt: Date | null; autoRenew: boolean | null} {
  const renewal = notification?.renewalInfo
  const autoRenew = renewal?.autoRenewStatus === undefined ? existing?.auto_renew ?? null : renewal.autoRenewStatus === 1
  const expired = Boolean(transaction.expiresDate && transaction.expiresDate <= now.getTime())
  const byDate: EntitlementStatus = transaction.revocationDate ? 'revoked' : expired ? 'expired' : 'active'
  if (!notification) {
    // Client-posted transaction: trust Apple's dates, but never undo a grace / retry state Apple told us about.
    if (byDate === 'expired' && existing && (existing.status === 'grace' || existing.status === 'billing_retry')) return {status: existing.status, graceExpiresAt: existing.grace_expires_at, autoRenew}
    return {status: byDate, graceExpiresAt: null, autoRenew}
  }
  const type = notification.notificationType
  if (type === 'REFUND' || type === 'REVOKE') return {status: 'revoked', graceExpiresAt: null, autoRenew}
  if (type === 'EXPIRED') return {status: 'expired', graceExpiresAt: null, autoRenew}
  if (type === 'GRACE_PERIOD_EXPIRED') return {status: 'billing_retry', graceExpiresAt: null, autoRenew}
  if (type === 'DID_FAIL_TO_RENEW') {
    if (notification.subtype === 'GRACE_PERIOD') return {status: 'grace', graceExpiresAt: renewal?.gracePeriodExpiresDate ? new Date(renewal.gracePeriodExpiresDate) : null, autoRenew}
    return {status: 'billing_retry', graceExpiresAt: null, autoRenew}
  }
  if (RENEWING.has(type)) return {status: byDate, graceExpiresAt: null, autoRenew}
  if (KEEP_STATUS.has(type) && existing) return {status: existing.status, graceExpiresAt: existing.grace_expires_at, autoRenew}
  return {status: existing?.status ?? byDate, graceExpiresAt: existing?.grace_expires_at ?? null, autoRenew}
}

function present(row: EntitlementRow, tiers: Map<string, {displayName: string; rank: number}>, now: Date) {
  const entitled = isEntitledNow(row, now)
  const status: EntitlementStatus = row.status === 'active' && !entitled ? 'expired' : row.status
  return {
    entitlementId: row.entitlement_id, tier: row.tier_id, tierName: tiers.get(row.tier_id)?.displayName ?? row.tier_id, status, entitled,
    source: row.source, environment: row.environment, productId: row.product_id, originalTransactionId: row.original_transaction_id,
    startedAt: row.started_at.toISOString(), expiresAt: row.expires_at?.toISOString() ?? null, graceExpiresAt: row.grace_expires_at?.toISOString() ?? null,
    revokedAt: row.revoked_at?.toISOString() ?? null, autoRenew: row.auto_renew, updatedAt: (row as any).updated_at?.toISOString?.() ?? row.started_at.toISOString(),
  }
}

function revocationReason(transaction: AppleTransaction, notification: AppleNotification | null) {
  if (notification?.notificationType === 'REVOKE') return 'family_sharing_revoked'
  if (transaction.revocationReason === 1) return 'refund_app_issue'
  if (transaction.revocationReason === 0) return 'refund_other'
  return notification?.notificationType === 'REFUND' ? 'refund' : 'revoked'
}

function hashOf(value: unknown) { return createHash('sha256').update(String(value ?? '')).digest('hex') }
function invalid(message: string): never { throw Object.assign(new Error(message), {code: 'VALIDATION_FAILED'}) }
function forbidden(message: string): never { throw Object.assign(new Error(message), {code: 'FORBIDDEN'}) }
function conflict(message: string): never { throw Object.assign(new Error(message), {code: 'CONFLICT'}) }
function notFound(message: string): never { throw Object.assign(new Error(message), {code: 'NOT_FOUND'}) }
