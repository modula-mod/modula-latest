import {createHash, randomUUID} from 'node:crypto'
import {sql, type Transaction} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import type {Database} from '../database/types.js'
import {uuidv7} from '../lib/uuidv7.js'
import {invalidatePublicIdentity, type PremiumTier} from './badges.js'
import type {
  AppleNotificationPayload,
  AppleRenewalPayload,
  AppleTransactionPayload,
  PremiumAppleVerifier,
} from './apple-verifier.js'

type PaidTier = Exclude<PremiumTier, 'core'>
type BillingPeriod = 'monthly' | 'annual'
type AppleStatus = 'active' | 'grace' | 'expired' | 'revoked'
type AppleSource = 'client' | 'notification'

type NormalizedTransaction = {
  transactionId: string
  originalTransactionId: string
  webOrderLineItemId: string | null
  appAccountToken: string | null
  productId: string
  purchaseAt: Date
  originalPurchaseAt: Date
  expiresAt: Date
  graceExpiresAt: Date | null
  revokedAt: Date | null
  signedAt: Date
  isUpgraded: boolean
  status: AppleStatus
  evidenceSha256: string
  transactionReason: string | null
}

type NotificationRecord = {
  notificationUuid: string
  notificationType: string
  subtype: string | null
  signedAt: Date
  evidenceSha256: string
}

export class PremiumAppleService {
  constructor(
    private readonly db: ModulaDb,
    private readonly verifier: PremiumAppleVerifier | null,
  ) {}

  configured(): boolean {
    return this.verifier !== null
  }

  async syncAdapterRegistration(): Promise<void> {
    if (!this.verifier) return
    await this.db.updateTable('greenfield_billing_adapter_registrations').set({
      state: 'ACTIVE',
      service_id: 'greenfield-api:premium-apple-sandbox',
      configuration_ref: 'secret://greenfield/premium/apple-sandbox',
      last_verified_at: new Date(),
      updated_at: new Date(),
    }).where('adapter', '=', 'APPLE').execute()
  }

  async purchaseStatus() {
    const products = this.verifier ? await this.activeProducts() : []
    return {
      enabled: Boolean(this.verifier && products.length > 0),
      environment: 'sandbox' as const,
      reason: !this.verifier
        ? 'apple_sandbox_verifier_disabled'
        : products.length === 0
          ? 'apple_products_unconfigured'
          : null,
      products,
    }
  }

  async configureProduct(actorId: string, productIdInput: string, input: Record<string, unknown>) {
    this.requireConfigured()
    const productId = productIdInput.trim()
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,159}$/.test(productId)) invalid('Invalid Apple product identifier')
    const tierValue = String(input.tier ?? '')
    if (!['plus', 'horizon', 'horizon_plus', 'studio'].includes(tierValue)) invalid('tier must be plus, horizon, horizon_plus or studio')
    const tier = tierValue as PaidTier
    const billingPeriod = String(input.billingPeriod ?? '') as BillingPeriod
    if (!['monthly', 'annual'].includes(billingPeriod)) invalid('billingPeriod must be monthly or annual')
    const state = String(input.state ?? 'active') as 'active' | 'disabled'
    if (!['active', 'disabled'].includes(state)) invalid('state must be active or disabled')
    const catalogueVersion = await this.activeCatalogueVersion()
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`premium-product:${catalogueVersion}:${tier}:${billingPeriod}`}, 0))`.execute(trx)
      if (state === 'active') {
        const collision = await trx.selectFrom('greenfield_premium_apple_products').select('product_id')
          .where('catalogue_version', '=', catalogueVersion).where('tier_id', '=', tier)
          .where('billing_period', '=', billingPeriod).where('environment', '=', 'Sandbox')
          .where('state', '=', 'active').where('product_id', '!=', productId).executeTakeFirst()
        if (collision) conflict('Another active product already maps to this tier and billing period')
      }
      await trx.insertInto('greenfield_premium_apple_products').values({
        product_id: productId,
        catalogue_version: catalogueVersion,
        tier_id: tier,
        billing_period: billingPeriod,
        environment: 'Sandbox',
        state,
        configured_by_actor_id: actorId,
        created_at: now,
        updated_at: now,
      }).onConflict(oc => oc.column('product_id').doUpdateSet({
        catalogue_version: catalogueVersion,
        tier_id: tier,
        billing_period: billingPeriod,
        state,
        configured_by_actor_id: actorId,
        updated_at: now,
      })).execute()
    })
    const row = await this.db.selectFrom('greenfield_premium_apple_products').selectAll().where('product_id', '=', productId).executeTakeFirstOrThrow()
    return productView(row)
  }

  async purchaseContext(accountId: string) {
    this.requireConfigured()
    const products = await this.activeProducts()
    if (products.length === 0) unavailable('Apple sandbox products are not configured')
    const proposed = randomUUID()
    await this.db.insertInto('greenfield_premium_apple_accounts').values({
      account_id: accountId,
      app_account_token: proposed,
      created_at: new Date(),
    }).onConflict(oc => oc.column('account_id').doNothing()).execute()
    const binding = await this.db.selectFrom('greenfield_premium_apple_accounts').selectAll().where('account_id', '=', accountId).executeTakeFirstOrThrow()
    return {
      environment: 'sandbox' as const,
      appAccountToken: binding.app_account_token,
      products,
    }
  }

  async submitTransaction(accountId: string, signedTransaction: string) {
    const verifier = this.requireConfigured()
    assertSignedPayload(signedTransaction, 'signedTransaction')
    const decoded = await verify(() => verifier.verifyTransaction(signedTransaction), 'Signed transaction verification failed')
    const transaction = normalizeTransaction(decoded, signedTransaction)
    if (!transaction.appAccountToken) forbidden('Verified transaction has no account binding')
    const result = await this.persistTransaction({
      accountId,
      transaction,
      source: 'client',
      reasonCode: 'CLIENT_SIGNED_TRANSACTION',
      notification: null,
      requireActiveProduct: true,
    })
    if (result.changed) await this.invalidateAccount(accountId)
    return result.response
  }

  async processNotification(signedPayload: string) {
    const verifier = this.requireConfigured()
    assertSignedPayload(signedPayload, 'signedPayload')
    const decoded = await verify(() => verifier.verifyNotification(signedPayload), 'Signed notification verification failed')
    const notification = normalizeNotification(decoded, signedPayload)
    const replay = await this.notificationReplay(notification)
    if (replay) return replay

    const signedTransaction = decoded.data?.signedTransactionInfo
    if (notification.notificationType === 'TEST' || !signedTransaction) {
      return this.persistNotification(notification, 'ignored', 'NO_TRANSACTION_DATA', null)
    }
    assertSignedPayload(signedTransaction, 'signedTransactionInfo')
    const transactionPayload = await verify(() => verifier.verifyTransaction(signedTransaction), 'Notification transaction verification failed')
    let renewal: AppleRenewalPayload | null = null
    if (decoded.data?.signedRenewalInfo) {
      assertSignedPayload(decoded.data.signedRenewalInfo, 'signedRenewalInfo')
      renewal = await verify(() => verifier.verifyRenewal(decoded.data!.signedRenewalInfo!), 'Notification renewal verification failed')
    }
    const transaction = normalizeTransaction(
      transactionPayload,
      signedTransaction,
      notificationStatus(decoded, renewal, transactionPayload),
      renewal?.gracePeriodExpiresDate == null ? null : appleDate(renewal.gracePeriodExpiresDate, 'gracePeriodExpiresDate'),
    )
    transaction.evidenceSha256 = sha256([
      signedPayload,
      signedTransaction,
      decoded.data?.signedRenewalInfo ?? '',
    ].join('\n'))
    const product = await this.db.selectFrom('greenfield_premium_apple_products').select('product_id').where('product_id', '=', transaction.productId).executeTakeFirst()
    if (!product) return this.persistNotification(notification, 'ignored', 'PRODUCT_NOT_CONFIGURED', null)

    let accountId: string | null = null
    if (transaction.appAccountToken) {
      accountId = (await this.db.selectFrom('greenfield_premium_apple_accounts').select('account_id')
        .where('app_account_token', '=', transaction.appAccountToken).executeTakeFirst())?.account_id ?? null
    } else {
      accountId = (await this.db.selectFrom('greenfield_premium_apple_transactions').select('account_id')
        .where('original_transaction_id', '=', transaction.originalTransactionId)
        .orderBy('latest_signed_at', 'desc').executeTakeFirst())?.account_id ?? null
    }
    if (!accountId) return this.persistNotification(notification, 'unbound', 'ACCOUNT_BINDING_NOT_FOUND', null)

    const result = await this.persistTransaction({
      accountId,
      transaction,
      source: 'notification',
      reasonCode: notificationReason(notification),
      notification,
      requireActiveProduct: false,
    })
    if (result.changed) await this.invalidateAccount(accountId)
    return result.response
  }

  private async persistTransaction(input: {
    accountId: string
    transaction: NormalizedTransaction
    source: AppleSource
    reasonCode: string
    notification: NotificationRecord | null
    requireActiveProduct: boolean
  }) {
    const result = await this.db.transaction().execute(async trx => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`premium-account:${input.accountId}`}, 0))`.execute(trx)

      if (input.notification) {
        const insertedNotification = await trx.insertInto('greenfield_premium_apple_notifications').values({
          notification_uuid: input.notification.notificationUuid,
          notification_type: input.notification.notificationType,
          subtype: input.notification.subtype,
          environment: 'Sandbox',
          signed_at: input.notification.signedAt,
          evidence_sha256: input.notification.evidenceSha256,
          transaction_id: null,
          state: 'processed',
          reason_code: input.reasonCode,
          processed_at: new Date(),
        }).onConflict(oc => oc.column('notification_uuid').doNothing()).returning('notification_uuid').executeTakeFirst()
        if (!insertedNotification) {
          const previous = await trx.selectFrom('greenfield_premium_apple_notifications').selectAll()
            .where('notification_uuid', '=', input.notification.notificationUuid).executeTakeFirstOrThrow()
          if (previous.evidence_sha256 !== input.notification.evidenceSha256) conflict('Notification UUID was reused with different signed evidence')
          return {changed: false, response: notificationView(previous, true)}
        }
      }

      const productQuery = trx.selectFrom('greenfield_premium_apple_products').selectAll().where('product_id', '=', input.transaction.productId)
      const product = await (input.requireActiveProduct ? productQuery.where('state', '=', 'active') : productQuery).executeTakeFirst()
      if (!product) unavailable('Verified transaction product is not enabled')

      const binding = await trx.selectFrom('greenfield_premium_apple_accounts').selectAll().where('account_id', '=', input.accountId).executeTakeFirst()
      if (!binding) forbidden('Apple purchase context is not initialized for this account')
      const token = input.transaction.appAccountToken ?? binding.app_account_token
      if (token !== binding.app_account_token) forbidden('Verified transaction belongs to a different account')

      const originalOwner = await trx.selectFrom('greenfield_premium_apple_transactions').select('account_id')
        .where('original_transaction_id', '=', input.transaction.originalTransactionId).orderBy('created_at').executeTakeFirst()
      if (originalOwner && originalOwner.account_id !== input.accountId) forbidden('Original transaction is already bound to another account')

      const previousEvidence = await trx.selectFrom('greenfield_premium_apple_transaction_events').select('event_id')
        .where('transaction_id', '=', input.transaction.transactionId).where('evidence_sha256', '=', input.transaction.evidenceSha256).executeTakeFirst()
      if (previousEvidence) {
        if (input.notification) {
          await trx.updateTable('greenfield_premium_apple_notifications').set({transaction_id: input.transaction.transactionId})
            .where('notification_uuid', '=', input.notification.notificationUuid).execute()
        }
        return {
          changed: false,
          response: transactionResponse(input.transaction, product.tier_id, true, null),
        }
      }

      const existingTransaction = await trx.selectFrom('greenfield_premium_apple_transactions').selectAll()
        .where('transaction_id', '=', input.transaction.transactionId).forUpdate().executeTakeFirst()
      if (existingTransaction && existingTransaction.account_id !== input.accountId) forbidden('Transaction is already bound to another account')
      const now = new Date()
      if (!existingTransaction) {
        await trx.insertInto('greenfield_premium_apple_transactions').values({
          transaction_id: input.transaction.transactionId,
          original_transaction_id: input.transaction.originalTransactionId,
          web_order_line_item_id: input.transaction.webOrderLineItemId,
          account_id: input.accountId,
          app_account_token: token,
          product_id: input.transaction.productId,
          purchase_at: input.transaction.purchaseAt,
          original_purchase_at: input.transaction.originalPurchaseAt,
          expires_at: input.transaction.expiresAt,
          grace_expires_at: input.transaction.graceExpiresAt,
          revoked_at: input.transaction.revokedAt,
          environment: 'Sandbox',
          ownership_type: 'PURCHASED',
          is_upgraded: input.transaction.isUpgraded,
          status: input.transaction.status,
          latest_signed_at: input.transaction.signedAt,
          evidence_sha256: input.transaction.evidenceSha256,
          created_at: now,
          updated_at: now,
        }).execute()
      } else if (input.transaction.signedAt >= existingTransaction.latest_signed_at) {
        await trx.updateTable('greenfield_premium_apple_transactions').set({
          web_order_line_item_id: input.transaction.webOrderLineItemId,
          product_id: input.transaction.productId,
          purchase_at: input.transaction.purchaseAt,
          expires_at: input.transaction.expiresAt,
          grace_expires_at: input.transaction.graceExpiresAt,
          revoked_at: input.transaction.revokedAt,
          is_upgraded: input.transaction.isUpgraded,
          status: input.transaction.status,
          latest_signed_at: input.transaction.signedAt,
          evidence_sha256: input.transaction.evidenceSha256,
          updated_at: now,
        }).where('transaction_id', '=', input.transaction.transactionId).execute()
      }

      await trx.insertInto('greenfield_premium_apple_transaction_events').values({
        event_id: uuidv7(),
        transaction_id: input.transaction.transactionId,
        account_id: input.accountId,
        source: input.source,
        notification_uuid: input.notification?.notificationUuid ?? null,
        status: input.transaction.status,
        signed_at: input.transaction.signedAt,
        evidence_sha256: input.transaction.evidenceSha256,
        reason_code: input.reasonCode,
        occurred_at: now,
      }).execute()
      if (input.notification) {
        await trx.updateTable('greenfield_premium_apple_notifications').set({transaction_id: input.transaction.transactionId})
          .where('notification_uuid', '=', input.notification.notificationUuid).execute()
      }

      const projection = await this.projectLatestMembership(trx, input.accountId, input.source, input.reasonCode, input.transaction.evidenceSha256)
      return {
        changed: projection.changed,
        response: transactionResponse(input.transaction, product.tier_id, false, projection.revision),
      }
    })
    return result
  }

  private async projectLatestMembership(
    trx: Transaction<Database>,
    accountId: string,
    source: AppleSource,
    reasonCode: string,
    evidenceSha256: string,
  ) {
    const latest = await trx.selectFrom('greenfield_premium_apple_transactions as transaction')
      .innerJoin('greenfield_premium_apple_products as product', 'product.product_id', 'transaction.product_id')
      .select([
        'transaction.transaction_id', 'transaction.original_transaction_id', 'transaction.purchase_at',
        'transaction.original_purchase_at', 'transaction.expires_at', 'transaction.grace_expires_at',
        'transaction.status', 'transaction.latest_signed_at', 'product.catalogue_version', 'product.tier_id',
      ])
      .where('transaction.account_id', '=', accountId)
      .orderBy('transaction.latest_signed_at', 'desc').orderBy('transaction.transaction_id', 'desc').executeTakeFirstOrThrow()
    const now = new Date()
    const entitlementExpiry = latest.status === 'grace' ? latest.grace_expires_at ?? latest.expires_at : latest.expires_at
    const status: AppleStatus = latest.status === 'active' || latest.status === 'grace'
      ? entitlementExpiry && entitlementExpiry > now ? latest.status : 'expired'
      : latest.status
    const existing = await trx.selectFrom('greenfield_premium_memberships').selectAll().where('account_id', '=', accountId).forUpdate().executeTakeFirst()
    const providerReferenceHash = sha256(latest.original_transaction_id)
    const changed = !existing
      || existing.tier_id !== latest.tier_id
      || existing.subscription_status !== status
      || existing.expires_at?.getTime() !== entitlementExpiry?.getTime()
      || existing.provider_reference_hash !== providerReferenceHash
    if (!changed) return {changed: false, revision: existing.revision}

    const revision = (existing?.revision ?? 0) + 1
    const membershipSince = existing?.membership_since ?? latest.original_purchase_at
    const eventType = await membershipEventType(
      trx,
      latest.catalogue_version,
      existing?.tier_id ?? null,
      existing?.subscription_status ?? null,
      latest.tier_id,
      status,
      source,
    )
    const auditMetadata = {
      environment: 'sandbox',
      transactionIdHash: sha256(latest.transaction_id),
      originalTransactionIdHash: providerReferenceHash,
      reasonCode,
    }
    await trx.insertInto('greenfield_premium_memberships').values({
      account_id: accountId,
      catalogue_version: latest.catalogue_version,
      tier_id: latest.tier_id,
      subscription_status: status,
      entitlement_source: 'apple_verified',
      effective_at: latest.purchase_at,
      expires_at: entitlementExpiry,
      membership_since: membershipSince,
      revision,
      provider_reference_hash: providerReferenceHash,
      audit_metadata: auditMetadata,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    }).onConflict(oc => oc.column('account_id').doUpdateSet({
      catalogue_version: latest.catalogue_version,
      tier_id: latest.tier_id,
      subscription_status: status,
      entitlement_source: 'apple_verified',
      effective_at: latest.purchase_at,
      expires_at: entitlementExpiry,
      membership_since: membershipSince,
      revision,
      provider_reference_hash: providerReferenceHash,
      audit_metadata: auditMetadata,
      updated_at: now,
    })).execute()
    await trx.insertInto('greenfield_premium_membership_events').values({
      event_id: uuidv7(),
      account_id: accountId,
      event_type: eventType,
      previous_tier_id: existing?.tier_id ?? null,
      tier_id: latest.tier_id,
      previous_status: existing?.subscription_status ?? null,
      subscription_status: status,
      source: 'apple_verified',
      idempotency_key: `apple:${evidenceSha256}`,
      actor_id: null,
      audit_metadata: auditMetadata,
      occurred_at: now,
    }).onConflict(oc => oc.column('idempotency_key').doNothing()).execute()
    return {changed: true, revision}
  }

  private async notificationReplay(notification: NotificationRecord) {
    const previous = await this.db.selectFrom('greenfield_premium_apple_notifications').selectAll()
      .where('notification_uuid', '=', notification.notificationUuid).executeTakeFirst()
    if (!previous) return null
    if (previous.evidence_sha256 !== notification.evidenceSha256) conflict('Notification UUID was reused with different signed evidence')
    return notificationView(previous, true)
  }

  private async persistNotification(notification: NotificationRecord, state: 'ignored' | 'unbound', reasonCode: string, transactionId: string | null) {
    const inserted = await this.db.insertInto('greenfield_premium_apple_notifications').values({
      notification_uuid: notification.notificationUuid,
      notification_type: notification.notificationType,
      subtype: notification.subtype,
      environment: 'Sandbox',
      signed_at: notification.signedAt,
      evidence_sha256: notification.evidenceSha256,
      transaction_id: transactionId,
      state,
      reason_code: reasonCode,
      processed_at: new Date(),
    }).onConflict(oc => oc.column('notification_uuid').doNothing()).returningAll().executeTakeFirst()
    if (inserted) return notificationView(inserted, false)
    const previous = await this.db.selectFrom('greenfield_premium_apple_notifications').selectAll()
      .where('notification_uuid', '=', notification.notificationUuid).executeTakeFirstOrThrow()
    if (previous.evidence_sha256 !== notification.evidenceSha256) conflict('Notification UUID was reused with different signed evidence')
    return notificationView(previous, true)
  }

  private async activeProducts() {
    const rows = await this.db.selectFrom('greenfield_premium_apple_products').selectAll()
      .where('state', '=', 'active').where('environment', '=', 'Sandbox')
      .orderBy('tier_id').orderBy('billing_period').execute()
    return rows.map(productView)
  }

  private requireConfigured(): PremiumAppleVerifier {
    if (!this.verifier) unavailable('Apple sandbox verification is disabled')
    return this.verifier
  }

  private async activeCatalogueVersion() {
    const row = await this.db.selectFrom('greenfield_premium_catalogue_versions').select('catalogue_version')
      .where('status', '=', 'active').executeTakeFirst()
    if (!row) unavailable('Premium catalogue unavailable')
    return row.catalogue_version
  }

  private async invalidateAccount(accountId: string) {
    const actors = await this.db.selectFrom('actors').select('id').where('account_id', '=', accountId).execute()
    invalidatePublicIdentity(actors.map(row => row.id))
  }
}

async function membershipEventType(
  trx: Transaction<Database>,
  catalogueVersion: number,
  previousTier: PremiumTier | null,
  previousStatus: string | null,
  tier: PaidTier,
  status: AppleStatus,
  source: AppleSource,
) {
  if (status === 'revoked') return 'revoked' as const
  if (status === 'expired') return 'expired' as const
  if (status === 'grace' && previousStatus !== 'grace') return 'grace_started' as const
  if (status === 'active' && previousStatus === 'grace') return 'grace_ended' as const
  if (!previousTier || previousTier === 'core') return source === 'client' ? 'restored' as const : 'purchased' as const
  const ranks = await trx.selectFrom('greenfield_premium_tiers').select(['tier_id', 'rank'])
    .where('catalogue_version', '=', catalogueVersion).execute()
  const rank = new Map(ranks.map(row => [row.tier_id, row.rank]))
  if ((rank.get(tier) ?? 0) > (rank.get(previousTier) ?? 0)) return 'upgraded' as const
  if ((rank.get(tier) ?? 0) < (rank.get(previousTier) ?? 0)) return 'downgraded' as const
  return 'renewed' as const
}

function normalizeTransaction(
  payload: AppleTransactionPayload,
  signedTransaction: string,
  statusOverride?: AppleStatus,
  graceExpiresAt: Date | null = null,
): NormalizedTransaction {
  const transactionId = requiredText(payload.transactionId, 160, 'Verified transaction ID is missing')
  const originalTransactionId = requiredText(payload.originalTransactionId, 160, 'Verified original transaction ID is missing')
  const productId = requiredText(payload.productId, 160, 'Verified product ID is missing')
  if (payload.environment !== 'Sandbox') forbidden('Only Apple sandbox transactions are accepted')
  if (payload.type !== 'Auto-Renewable Subscription') forbidden('Only auto-renewable Premium subscriptions are accepted')
  if (payload.inAppOwnershipType !== 'PURCHASED') forbidden('Family-shared Premium transactions are not accepted')
  const purchaseAt = appleDate(payload.purchaseDate, 'purchaseDate')
  const originalPurchaseAt = appleDate(payload.originalPurchaseDate, 'originalPurchaseDate')
  const expiresAt = appleDate(payload.expiresDate, 'expiresDate')
  const signedAt = appleDate(payload.signedDate, 'signedDate')
  if (signedAt.getTime() > Date.now() + 300_000) invalid('Verified signedDate is too far in the future')
  if (originalPurchaseAt > purchaseAt || expiresAt <= originalPurchaseAt) invalid('Verified transaction dates are inconsistent')
  const revokedAt = payload.revocationDate == null ? null : appleDate(payload.revocationDate, 'revocationDate')
  const appAccountToken = payload.appAccountToken == null ? null : normalizedUuid(payload.appAccountToken)
  const baseStatus: AppleStatus = revokedAt
    ? 'revoked'
    : payload.isUpgraded
      ? 'expired'
      : expiresAt <= new Date()
        ? 'expired'
        : 'active'
  return {
    transactionId,
    originalTransactionId,
    webOrderLineItemId: optionalText(payload.webOrderLineItemId, 160),
    appAccountToken,
    productId,
    purchaseAt,
    originalPurchaseAt,
    expiresAt,
    graceExpiresAt,
    revokedAt,
    signedAt,
    isUpgraded: payload.isUpgraded === true,
    status: statusOverride ?? baseStatus,
    evidenceSha256: sha256(signedTransaction),
    transactionReason: optionalText(payload.transactionReason, 80),
  }
}

function normalizeNotification(payload: AppleNotificationPayload, signedPayload: string): NotificationRecord {
  const environment = payload.data?.environment ?? payload.summary?.environment ?? payload.appData?.environment
  if (environment !== 'Sandbox') forbidden('Only Apple sandbox notifications are accepted')
  return {
    notificationUuid: requiredText(payload.notificationUUID, 160, 'Notification UUID is missing'),
    notificationType: requiredText(payload.notificationType, 80, 'Notification type is missing'),
    subtype: optionalText(payload.subtype, 80),
    signedAt: appleDate(payload.signedDate, 'notification signedDate'),
    evidenceSha256: sha256(signedPayload),
  }
}

function notificationStatus(notification: AppleNotificationPayload, renewal: AppleRenewalPayload | null, transaction: AppleTransactionPayload): AppleStatus | undefined {
  const type = String(notification.notificationType ?? '')
  if (type === 'REFUND' || type === 'REVOKE' || notification.data?.status === 5) return 'revoked'
  if (type === 'EXPIRED' || type === 'GRACE_PERIOD_EXPIRED' || notification.data?.status === 2) return 'expired'
  if (notification.data?.status === 4 || (type === 'DID_FAIL_TO_RENEW' && notification.subtype === 'GRACE_PERIOD')) {
    if (renewal?.gracePeriodExpiresDate && renewal.gracePeriodExpiresDate > Date.now()) return 'grace'
    return 'expired'
  }
  if (transaction.revocationDate) return 'revoked'
  return undefined
}

function notificationReason(notification: NotificationRecord) {
  return `APPLE_${notification.notificationType}${notification.subtype ? `_${notification.subtype}` : ''}`.slice(0, 120)
}

function transactionResponse(transaction: NormalizedTransaction, tier: PaidTier, replay: boolean, membershipRevision: number | null) {
  return {
    accepted: true as const,
    replay,
    environment: 'sandbox' as const,
    transactionId: transaction.transactionId,
    originalTransactionId: transaction.originalTransactionId,
    productId: transaction.productId,
    tier,
    status: transaction.status,
    expiresAt: transaction.status === 'grace'
      ? (transaction.graceExpiresAt ?? transaction.expiresAt).toISOString()
      : transaction.expiresAt.toISOString(),
    membershipRevision,
  }
}

function notificationView(row: Database['greenfield_premium_apple_notifications'], replay: boolean) {
  return {
    accepted: true as const,
    replay,
    notificationUuid: row.notification_uuid,
    notificationType: row.notification_type,
    state: row.state,
    reasonCode: row.reason_code,
    transactionId: row.transaction_id,
  }
}

function productView(row: Database['greenfield_premium_apple_products']) {
  return {
    productId: row.product_id,
    tier: row.tier_id,
    billingPeriod: row.billing_period,
    environment: 'sandbox' as const,
    state: row.state,
  }
}

function appleDate(value: unknown, label: string): Date {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) invalid(`Verified ${label} is invalid`)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) invalid(`Verified ${label} is invalid`)
  return date
}

function normalizedUuid(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    invalid('Verified appAccountToken is not a UUID')
  }
  return normalized
}

function requiredText(value: unknown, max: number, message: string): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text || text.length > max) invalid(message)
  return text
}

function optionalText(value: unknown, max: number): string | null {
  if (value == null) return null
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text || text.length > max) invalid('Verified text field is invalid')
  return text
}

function assertSignedPayload(value: string, field: string) {
  if (typeof value !== 'string' || value.length < 16 || value.length > 200_000 || value.split('.').length !== 3) {
    invalid(`${field} must be a compact JWS of at most 200000 characters`)
  }
}

async function verify<T>(operation: () => Promise<T>, message: string): Promise<T> {
  try {
    return await operation()
  } catch {
    invalid(message)
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function invalid(message: string): never { throw Object.assign(new Error(message), {code: 'VALIDATION_FAILED'}) }
function forbidden(message: string): never { throw Object.assign(new Error(message), {code: 'FORBIDDEN'}) }
function conflict(message: string): never { throw Object.assign(new Error(message), {code: 'CONFLICT'}) }
function unavailable(message: string): never { throw Object.assign(new Error(message), {code: 'CAPABILITY_UNAVAILABLE'}) }
