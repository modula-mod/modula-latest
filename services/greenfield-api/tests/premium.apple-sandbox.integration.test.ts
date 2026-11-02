import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import pg from 'pg'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import type {
  AppleNotificationPayload,
  AppleRenewalPayload,
  AppleTransactionPayload,
  PremiumAppleVerifier,
} from '../src/premium/apple-verifier.js'

const baseDatabaseUrl = process.env.MODULA_TEST_DATABASE_URL
const adminDatabaseUrl = process.env.MODULA_TEST_ADMIN_DATABASE_URL
const describeIfDb = baseDatabaseUrl && adminDatabaseUrl ? describe : describe.skip

describeIfDb('Premium Apple sandbox verification integration', () => {
  const verifier = new FakeAppleVerifier()
  const suffix = Date.now().toString(36)
  const adminHandle = `paadmin${suffix}`.slice(0, 20)
  const databaseName = `modula_premium_apple_${process.pid}_${Date.now()}`
  const plusProduct = 'modula.premium.plus.monthly'
  const horizonProduct = 'modula.premium.horizon.monthly'
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let buyer: Awaited<ReturnType<typeof createUser>>
  let other: Awaited<ReturnType<typeof createUser>>
  let admin: Awaited<ReturnType<typeof createUser>>
  let buyerToken = ''
  let otherToken = ''
  let originalTransactionId = ''
  let lastPlusTransaction = ''
  let preservedPostId = ''
  let signedClock = Date.now() - 120_000

  beforeAll(async () => {
    const adminClient = new pg.Client({connectionString: adminDatabaseUrl!})
    await adminClient.connect()
    await adminClient.query(`CREATE DATABASE ${quoteIdentifier(databaseName)} OWNER modula_migrator`)
    await adminClient.end()
    const parsedDatabaseUrl = new URL(baseDatabaseUrl!)
    parsedDatabaseUrl.pathname = `/${databaseName}`
    const databaseUrl = parsedDatabaseUrl.toString()
    Object.assign(process.env, {
      NODE_ENV: 'test', MODULA_ENVIRONMENT: 'preview', MODULA_API_HOST: '127.0.0.1', MODULA_API_PORT: '4033',
      MODULA_PUBLIC_API_URL: 'https://api.qa.invalid', MODULA_DATABASE_URL: databaseUrl, MODULA_DATABASE_MIGRATOR_URL: databaseUrl,
      MODULA_ALLOWED_ORIGINS: 'https://qa.invalid', MODULA_LOG_LEVEL: 'silent', MODULA_PREVIEW_WRITES_ENABLED: 'true', MODULA_INVITE_ONLY: 'true',
      MODULA_REGISTRATION_INVITE_CODES: 'test-invite', MODULA_ATPROTO_ENABLED: 'false', MODULA_RATE_LIMIT_ENABLED: 'false',
      MODULA_MEDIA_ROOT: `/tmp/modula-premium-apple-${process.pid}`, MODULA_PREMIUM_ENTITLEMENTS_ENABLED: 'true',
      MODULA_PREMIUM_QA_ASSIGNMENTS_ENABLED: 'true', MODULA_PREMIUM_APPLE_SANDBOX_ENABLED: 'true',
      MODULA_PREMIUM_APPLE_BUNDLE_ID: 'digital.modula.app.native', MODULA_PREMIUM_APPLE_ROOT_CA_FILES: '/qa/apple-root.der',
      MODULA_VERIFICATION_ENABLED: 'true', MODULA_ADMIN_HANDLES: adminHandle,
    })
    await migrateUp(databaseUrl)
    const created = await createServer(loadConfig(), {premiumAppleVerifier: verifier})
    app = created.app
    db = created.db
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()
    await app.ready()
    buyer = await createUser(`pabuyer${suffix}`.slice(0, 20), 'Premium Buyer')
    other = await createUser(`paother${suffix}`.slice(0, 20), 'Premium Other')
    admin = await createUser(adminHandle, 'Premium Admin')
  })

  afterAll(async () => {
    for (const key of [
      'MODULA_PREMIUM_ENTITLEMENTS_ENABLED', 'MODULA_PREMIUM_QA_ASSIGNMENTS_ENABLED',
      'MODULA_PREMIUM_APPLE_SANDBOX_ENABLED', 'MODULA_PREMIUM_APPLE_BUNDLE_ID',
      'MODULA_PREMIUM_APPLE_ROOT_CA_FILES', 'MODULA_VERIFICATION_ENABLED', 'MODULA_ADMIN_HANDLES',
    ]) delete process.env[key]
    await app?.close()
    await db?.destroy()
    const adminClient = new pg.Client({connectionString: adminDatabaseUrl!})
    await adminClient.connect()
    await adminClient.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [databaseName])
    await adminClient.query(`DROP DATABASE ${quoteIdentifier(databaseName)}`)
    await adminClient.end()
  })

  it('fails closed until an operator configures confirmed sandbox products', async () => {
    expect((await app.inject({method: 'POST', url: '/v1/me/membership/apple-purchase-context', payload: {}})).statusCode).toBe(401)
    const before = await authed(buyer, 'GET', '/v1/premium/tiers')
    expect(before.statusCode, before.body).toBe(200)
    expect(before.json().data.purchase).toMatchObject({enabled: false, environment: 'sandbox', reason: 'apple_products_unconfigured', products: []})
    expect(before.json().data.tiers.map((tier: any) => tier.displayPrice)).toEqual(['Free', '£3.99', '£8.99', '£14.99', 'From £29.99'])

    expect((await configureProduct(buyer, plusProduct, 'plus')).statusCode).toBe(403)
    expect((await authed(admin, 'PUT', `/v1/admin/qa/premium/apple-products/${plusProduct}`, {
      tier: 'plus', billingPeriod: 'monthly', untrustedEntitlement: true,
    })).statusCode).toBe(400)
    expect((await configureProduct(admin, plusProduct, 'plus')).statusCode).toBe(200)
    expect((await configureProduct(admin, horizonProduct, 'horizon')).statusCode).toBe(200)

    const after = await authed(buyer, 'GET', '/v1/premium/tiers')
    expect(after.json().data.purchase).toMatchObject({enabled: true, environment: 'sandbox', reason: null})
    expect(after.json().data.purchase.products.map((item: any) => item.productId)).toEqual([horizonProduct, plusProduct])
    expect((await authed(buyer, 'POST', '/v1/me/membership/apple-purchase-context', {accountId: other.accountId})).statusCode).toBe(400)
    const buyerContext = await authed(buyer, 'POST', '/v1/me/membership/apple-purchase-context', {})
    const otherContext = await authed(other, 'POST', '/v1/me/membership/apple-purchase-context', {})
    expect(buyerContext.statusCode, buyerContext.body).toBe(200)
    expect(otherContext.statusCode, otherContext.body).toBe(200)
    buyerToken = buyerContext.json().data.appAccountToken
    otherToken = otherContext.json().data.appAccountToken
    expect(buyerToken).not.toBe(otherToken)
    expect(buyerContext.json().data.products).toHaveLength(2)

    const adapters = await authed(buyer, 'GET', '/v1/commerce/billing-adapters')
    expect(adapters.json().data.find((item: any) => item.adapter === 'APPLE')).toMatchObject({state: 'ACTIVE'})
  })

  it('binds verified transactions to one account and applies upgrades, downgrades and idempotent restoration', async () => {
    expect((await authed(buyer, 'POST', '/v1/premium/apple/transactions', {premium: true, tier: 'studio'})).statusCode).toBe(400)
    expect((await authed(buyer, 'POST', '/v1/premium/apple/transactions', {signedTransaction: jws('not-registered')})).statusCode).toBe(400)

    originalTransactionId = `original-${suffix}`
    const initial = addTransaction('initial-plus', {
      transactionId: `tx-plus-initial-${suffix}`,
      originalTransactionId,
      productId: plusProduct,
      appAccountToken: buyerToken,
      transactionReason: 'PURCHASE',
    })
    const accepted = await authed(buyer, 'POST', '/v1/premium/apple/transactions', {signedTransaction: initial})
    expect(accepted.statusCode, accepted.body).toBe(200)
    expect(accepted.json().data).toMatchObject({accepted: true, replay: false, tier: 'plus', status: 'active'})
    const firstMembership = (await authed(buyer, 'GET', '/v1/me/membership')).json().data
    expect(firstMembership).toMatchObject({tier: 'plus', subscriptionStatus: 'active', entitlementSource: 'apple_verified'})
    const entitlements = (await authed(buyer, 'GET', '/v1/me/entitlements')).json().data
    expect(entitlements.capabilities.find((item: any) => item.id === 'profile_analytics')).toMatchObject({available: true, reason: 'verified_apple_sandbox_entitlement'})

    const replay = await authed(buyer, 'POST', '/v1/premium/apple/transactions', {signedTransaction: initial})
    expect(replay.json().data).toMatchObject({replay: true})
    expect((await authed(buyer, 'GET', '/v1/me/membership')).json().data.revision).toBe(firstMembership.revision)
    expect((await authed(other, 'POST', '/v1/premium/apple/transactions', {signedTransaction: initial})).statusCode).toBe(403)

    const renewal = addTransaction('concurrent-renewal', {
      transactionId: `tx-plus-renewal-${suffix}`,
      originalTransactionId,
      productId: plusProduct,
      appAccountToken: buyerToken,
      transactionReason: 'RENEWAL',
      purchaseDate: Date.now() - 20_000,
      expiresDate: Date.now() + 45 * 86_400_000,
    })
    const concurrent = await Promise.all([
      authed(buyer, 'POST', '/v1/premium/apple/transactions', {signedTransaction: renewal}),
      authed(buyer, 'POST', '/v1/premium/apple/transactions', {signedTransaction: renewal}),
    ])
    expect(concurrent.map(response => response.statusCode)).toEqual([200, 200])
    expect(concurrent.map(response => response.json().data.replay).sort()).toEqual([false, true])

    const upgrade = addTransaction('upgrade-horizon', {
      transactionId: `tx-horizon-${suffix}`,
      originalTransactionId,
      productId: horizonProduct,
      appAccountToken: buyerToken,
      transactionReason: 'PURCHASE',
      purchaseDate: Date.now() - 10_000,
      expiresDate: Date.now() + 60 * 86_400_000,
    })
    expect((await authed(buyer, 'POST', '/v1/premium/apple/transactions', {signedTransaction: upgrade})).statusCode).toBe(200)
    expect((await authed(buyer, 'GET', '/v1/me/membership')).json().data.tier).toBe('horizon')

    const post = await authed(buyer, 'POST', '/v1/posts', {text: `Premium preservation ${suffix}`, audience: 'public', idempotencyKey: `premium-preserve-${suffix}`})
    expect(post.statusCode, post.body).toBe(201)
    preservedPostId = post.json().data.id
    lastPlusTransaction = addTransaction('downgrade-plus', {
      transactionId: `tx-plus-downgrade-${suffix}`,
      originalTransactionId,
      productId: plusProduct,
      appAccountToken: buyerToken,
      transactionReason: 'PURCHASE',
      purchaseDate: Date.now() - 5_000,
      expiresDate: Date.now() + 30 * 86_400_000,
    })
    await authed(buyer, 'POST', '/v1/premium/apple/transactions', {signedTransaction: lastPlusTransaction})
    expect((await authed(buyer, 'GET', '/v1/me/membership')).json().data.tier).toBe('plus')
    expect(await db.selectFrom('posts').select('id').where('id', '=', preservedPostId).executeTakeFirst()).toBeTruthy()

    const restoredSession = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email: buyer.email, password: buyer.password}})
    expect([200, 201]).toContain(restoredSession.statusCode)
    const restored = await authed({accessToken: restoredSession.json().data.accessToken}, 'POST', '/v1/premium/apple/transactions', {signedTransaction: lastPlusTransaction})
    expect(restored.json().data).toMatchObject({replay: true, tier: 'plus'})

    const verificationPurchase = addTransaction('attempt-buy-verification', {
      transactionId: `tx-verification-${suffix}`,
      originalTransactionId: `verification-${suffix}`,
      productId: 'modula.verification.person',
      appAccountToken: buyerToken,
    })
    expect((await authed(buyer, 'POST', '/v1/premium/apple/transactions', {signedTransaction: verificationPurchase})).statusCode).toBe(503)
    expect((await authed(buyer, 'GET', '/v1/me/verification')).json().data.status).toBe('unverified')

    const stored = await db.selectFrom('greenfield_premium_apple_transactions').selectAll().where('account_id', '=', buyer.accountId).execute()
    expect(stored).toHaveLength(4)
    expect(stored.every(row => row.evidence_sha256.length === 64 && !JSON.stringify(row).includes(lastPlusTransaction))).toBe(true)
  })

  it('applies grace, recovery, expiration and refund notifications once without deleting data', async () => {
    const current = verifier.transactions.get(lastPlusTransaction)!
    const graceTransaction = addTransaction('grace-transaction', {
      ...current,
      expiresDate: Date.now() - 1_000,
      signedDate: nextSignedDate(),
    })
    const renewalInfo = addRenewal('grace-renewal', {
      originalTransactionId,
      productId: plusProduct,
      appAccountToken: buyerToken,
      environment: 'Sandbox',
      gracePeriodExpiresDate: Date.now() + 3 * 86_400_000,
      signedDate: nextSignedDate(),
    })
    const graceNotification = addNotification('grace-notification', {
      notificationUUID: `notification-grace-${suffix}`,
      notificationType: 'DID_FAIL_TO_RENEW',
      subtype: 'GRACE_PERIOD',
      signedDate: nextSignedDate(),
      data: {
        environment: 'Sandbox', bundleId: 'digital.modula.app.native', status: 4,
        signedTransactionInfo: graceTransaction, signedRenewalInfo: renewalInfo,
      },
    })
    const grace = await app.inject({method: 'POST', url: '/v1/premium/apple/notifications', payload: {signedPayload: graceNotification}})
    expect(grace.statusCode, grace.body).toBe(200)
    expect(grace.json().data).toMatchObject({accepted: true, replay: false, tier: 'plus', status: 'grace'})
    expect((await authed(buyer, 'GET', '/v1/me/membership')).json().data).toMatchObject({tier: 'plus', subscriptionStatus: 'grace'})
    const eventsBeforeReplay = await db.selectFrom('greenfield_premium_apple_transaction_events').select('event_id').execute()
    const graceReplay = await app.inject({method: 'POST', url: '/v1/premium/apple/notifications', payload: {signedPayload: graceNotification}})
    expect(graceReplay.json().data.replay).toBe(true)
    expect(await db.selectFrom('greenfield_premium_apple_transaction_events').select('event_id').execute()).toHaveLength(eventsBeforeReplay.length)

    const recoveredTransaction = addTransaction('billing-recovery', {
      transactionId: `tx-recovered-${suffix}`,
      originalTransactionId,
      productId: horizonProduct,
      appAccountToken: buyerToken,
      transactionReason: 'RENEWAL',
      purchaseDate: Date.now() - 2_000,
      expiresDate: Date.now() + 60 * 86_400_000,
    })
    const recoveredNotification = addNotification('recovered-notification', {
      notificationUUID: `notification-recovered-${suffix}`,
      notificationType: 'DID_RENEW',
      subtype: 'BILLING_RECOVERY',
      signedDate: nextSignedDate(),
      data: {environment: 'Sandbox', bundleId: 'digital.modula.app.native', status: 1, signedTransactionInfo: recoveredTransaction},
    })
    expect((await app.inject({method: 'POST', url: '/v1/premium/apple/notifications', payload: {signedPayload: recoveredNotification}})).statusCode).toBe(200)
    expect((await authed(buyer, 'GET', '/v1/me/membership')).json().data).toMatchObject({tier: 'horizon', subscriptionStatus: 'active'})

    const expiredTransaction = addTransaction('expired-transaction', {
      ...verifier.transactions.get(recoveredTransaction)!,
      signedDate: nextSignedDate(),
    })
    const expiredNotification = addNotification('expired-notification', {
      notificationUUID: `notification-expired-${suffix}`,
      notificationType: 'EXPIRED',
      signedDate: nextSignedDate(),
      data: {environment: 'Sandbox', bundleId: 'digital.modula.app.native', status: 2, signedTransactionInfo: expiredTransaction},
    })
    await app.inject({method: 'POST', url: '/v1/premium/apple/notifications', payload: {signedPayload: expiredNotification}})
    expect((await authed(buyer, 'GET', '/v1/me/membership')).json().data).toMatchObject({tier: 'core', recordedTier: 'horizon', subscriptionStatus: 'expired'})

    const refundedTransaction = addTransaction('refunded-transaction', {
      ...verifier.transactions.get(recoveredTransaction)!,
      signedDate: nextSignedDate(),
      revocationDate: Date.now() - 1_000,
    })
    const refundedNotification = addNotification('refund-notification', {
      notificationUUID: `notification-refund-${suffix}`,
      notificationType: 'REFUND',
      signedDate: nextSignedDate(),
      data: {environment: 'Sandbox', bundleId: 'digital.modula.app.native', status: 5, signedTransactionInfo: refundedTransaction},
    })
    expect((await app.inject({method: 'POST', url: '/v1/premium/apple/notifications', payload: {signedPayload: refundedNotification}})).statusCode).toBe(200)
    expect((await authed(buyer, 'GET', '/v1/me/membership')).json().data).toMatchObject({tier: 'core', subscriptionStatus: 'revoked'})
    expect(await db.selectFrom('posts').select('id').where('id', '=', preservedPostId).executeTakeFirst()).toBeTruthy()

    const conflictingNotification = addNotification('refund-notification-conflict', {
      notificationUUID: `notification-refund-${suffix}`,
      notificationType: 'REFUND',
      signedDate: nextSignedDate(),
      data: {environment: 'Sandbox', bundleId: 'digital.modula.app.native', status: 5, signedTransactionInfo: refundedTransaction},
    })
    expect((await app.inject({method: 'POST', url: '/v1/premium/apple/notifications', payload: {signedPayload: conflictingNotification}})).statusCode).toBe(409)
    expect((await app.inject({method: 'POST', url: '/v1/premium/apple/notifications', payload: {signedPayload: jws('forged-notification')}})).statusCode).toBe(400)
  })

  function nextSignedDate() {
    signedClock += 1_000
    return signedClock
  }

  function addTransaction(label: string, overrides: Partial<AppleTransactionPayload>) {
    const signed = jws(label)
    const now = Date.now()
    verifier.transactions.set(signed, {
      transactionId: `tx-${label}-${suffix}`,
      originalTransactionId: `tx-${label}-${suffix}`,
      webOrderLineItemId: `line-${label}-${suffix}`,
      bundleId: 'digital.modula.app.native',
      productId: plusProduct,
      subscriptionGroupIdentifier: 'modula.premium',
      purchaseDate: now - 30_000,
      originalPurchaseDate: now - 10 * 86_400_000,
      expiresDate: now + 30 * 86_400_000,
      type: 'Auto-Renewable Subscription',
      appAccountToken: buyerToken,
      inAppOwnershipType: 'PURCHASED',
      signedDate: nextSignedDate(),
      environment: 'Sandbox',
      ...overrides,
    })
    return signed
  }

  function addRenewal(label: string, payload: AppleRenewalPayload) {
    const signed = jws(label)
    verifier.renewals.set(signed, payload)
    return signed
  }

  function addNotification(label: string, payload: AppleNotificationPayload) {
    const signed = jws(label)
    verifier.notifications.set(signed, payload)
    return signed
  }

  async function configureProduct(actor: {accessToken: string}, productId: string, tier: 'plus' | 'horizon') {
    return authed(actor, 'PUT', `/v1/admin/qa/premium/apple-products/${productId}`, {tier, billingPeriod: 'monthly', state: 'active'})
  }

  async function authed(actor: {accessToken: string}, method: string, url: string, payload?: unknown) {
    return app.inject({method: method as any, url, headers: {authorization: `Bearer ${actor.accessToken}`}, ...(payload === undefined ? {} : {payload})})
  }

  async function createUser(handle: string, displayName: string) {
    const password = 'secure-pass-word-1'
    const email = `${handle}@example.invalid`
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()
    const register = await app.inject({method: 'POST', url: '/v1/accounts/register', payload: {email, password, handle, displayName, acceptedTerms: true, inviteCode: 'test-invite'}})
    expect(register.statusCode, register.body).toBe(201)
    const verified = await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token: register.json().data.verificationToken}})
    expect(verified.statusCode, verified.body).toBe(200)
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect([200, 201]).toContain(session.statusCode)
    const accessToken = session.json().data.accessToken
    const me = await app.inject({method: 'GET', url: '/v1/accounts/me', headers: {authorization: `Bearer ${accessToken}`}})
    const accountId = me.json().data.accountId
    const actor = await db.selectFrom('actors').select('id').where('account_id', '=', accountId).executeTakeFirstOrThrow()
    return {accountId, actorId: actor.id, handle, email, password, accessToken}
  }
})

class FakeAppleVerifier implements PremiumAppleVerifier {
  readonly transactions = new Map<string, AppleTransactionPayload>()
  readonly renewals = new Map<string, AppleRenewalPayload>()
  readonly notifications = new Map<string, AppleNotificationPayload>()

  async verifyTransaction(signedTransaction: string) {
    const value = this.transactions.get(signedTransaction)
    if (!value) throw new Error('invalid transaction signature')
    return structuredClone(value)
  }

  async verifyRenewal(signedRenewal: string) {
    const value = this.renewals.get(signedRenewal)
    if (!value) throw new Error('invalid renewal signature')
    return structuredClone(value)
  }

  async verifyNotification(signedPayload: string) {
    const value = this.notifications.get(signedPayload)
    if (!value) throw new Error('invalid notification signature')
    return structuredClone(value)
  }
}

function jws(label: string) {
  return `eyJhbGciOiJFUzI1NiJ9.${Buffer.from(label).toString('base64url')}.c2lnbmF0dXJl`
}

function quoteIdentifier(value: string) { return `"${value.replaceAll('"', '""')}"` }
