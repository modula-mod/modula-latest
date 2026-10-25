import {describe, expect, it} from 'vitest'
import {AppStoreJwsVerifier, appleRootCertificate} from '../src/premium/apple-verifier.js'
import {nextState} from '../src/premium/service.js'
import {createTestChain, notificationPayload, TEST_BUNDLE_ID, transactionPayload} from './helpers/storekit-test-chain.js'

const chain = createTestChain()
const verifier = new AppStoreJwsVerifier({bundleId: TEST_BUNDLE_ID, environment: 'Sandbox', enableOnlineChecks: false, rootCertificates: [chain.rootDer]})

async function rejection(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error: any) {
    return error.reason as string
  }
  throw new Error('expected rejection')
}

describe('Modula Premium: StoreKit 2 JWS verification', () => {
  it('pins Apple Root CA - G3 by fingerprint', () => {
    expect(appleRootCertificate().length).toBeGreaterThan(500)
  })

  it('accepts a correctly signed Sandbox transaction', async () => {
    const payload = transactionPayload({appAccountToken: '2f1d2c3b-4a59-4f6e-9d7c-8b9a0b1c2d3e'})
    const decoded = await verifier.verifyTransaction(chain.signJws(payload))
    expect(decoded.originalTransactionId).toBe(payload.originalTransactionId)
    expect(decoded.productId).toBe('digital.modula.premium.horizon.monthly')
    expect(decoded.appAccountToken).toBe('2f1d2c3b-4a59-4f6e-9d7c-8b9a0b1c2d3e')
  })

  it('rejects a tampered payload', async () => {
    const [header, , signature] = chain.signJws(transactionPayload()).split('.')
    const forged = Buffer.from(JSON.stringify(transactionPayload({productId: 'digital.modula.premium.studio.yearly'}))).toString('base64url')
    expect(await rejection(verifier.verifyTransaction(`${header}.${forged}.${signature}`))).toBe('VERIFICATION_FAILURE')
  })

  it('rejects a tampered signature', async () => {
    const jws = chain.signJws(transactionPayload())
    const flipped = jws.slice(0, -4) + (jws.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect(await rejection(verifier.verifyTransaction(flipped))).toBe('VERIFICATION_FAILURE')
  })

  it('rejects the Production environment while Sandbox-only', async () => {
    expect(await rejection(verifier.verifyTransaction(chain.signJws(transactionPayload({environment: 'Production'}))))).toBe('INVALID_ENVIRONMENT')
  })

  it('rejects Xcode / local StoreKit testing environments', async () => {
    expect(await rejection(verifier.verifyTransaction(chain.signJws(transactionPayload({environment: 'Xcode'}))))).toBe('INVALID_ENVIRONMENT')
    expect(await rejection(verifier.verifyTransaction(chain.signJws(transactionPayload({environment: 'LocalTesting'}))))).toBe('INVALID_ENVIRONMENT')
  })

  it('rejects another app bundle', async () => {
    expect(await rejection(verifier.verifyTransaction(chain.signJws(transactionPayload({bundleId: 'com.example.other'}))))).toBe('INVALID_APP_IDENTIFIER')
  })

  it('rejects a chain that does not end at a trusted root', async () => {
    const appleOnly = new AppStoreJwsVerifier({bundleId: TEST_BUNDLE_ID, environment: 'Sandbox', enableOnlineChecks: false})
    expect(await rejection(appleOnly.verifyTransaction(chain.signJws(transactionPayload())))).toBe('VERIFICATION_FAILURE')
  })

  it('rejects a leaf without the Apple receipt-signing OID', async () => {
    const noOid = createTestChain({leafAppleOid: false, label: 'No OID'})
    const strict = new AppStoreJwsVerifier({bundleId: TEST_BUNDLE_ID, environment: 'Sandbox', enableOnlineChecks: false, rootCertificates: [noOid.rootDer]})
    expect(await rejection(strict.verifyTransaction(noOid.signJws(transactionPayload())))).toBe('VERIFICATION_FAILURE')
  })

  it('rejects a short certificate chain and malformed input', async () => {
    expect(await rejection(verifier.verifyTransaction(chain.signJws(transactionPayload(), {x5c: chain.x5c.slice(0, 2)})))).toBe('INVALID_CERTIFICATE')
    expect(await rejection(verifier.verifyTransaction('not-a-jws'))).toBe('MALFORMED_JWS')
  })

  it('refuses to construct a Production verifier in this phase', () => {
    expect(() => new AppStoreJwsVerifier({bundleId: TEST_BUNDLE_ID, environment: 'Production' as any, enableOnlineChecks: false})).toThrow(/Sandbox/)
  })

  it('verifies a Notifications V2 payload with nested transaction and renewal info', async () => {
    const transaction = transactionPayload()
    const decoded = await verifier.verifyNotification(notificationPayload(chain, {notificationType: 'DID_FAIL_TO_RENEW', subtype: 'GRACE_PERIOD', transaction, renewal: {originalTransactionId: transaction.originalTransactionId, autoRenewStatus: 1, gracePeriodExpiresDate: Date.now() + 86_400_000, environment: 'Sandbox', signedDate: Date.now()}}))
    expect(decoded.notificationType).toBe('DID_FAIL_TO_RENEW')
    expect(decoded.subtype).toBe('GRACE_PERIOD')
    expect(decoded.transaction?.originalTransactionId).toBe(transaction.originalTransactionId)
    expect(decoded.renewalInfo?.gracePeriodExpiresDate).toBeGreaterThan(Date.now())
  })

  it('rejects a Production notification', async () => {
    expect(await rejection(verifier.verifyNotification(notificationPayload(chain, {notificationType: 'DID_RENEW', transaction: transactionPayload(), environment: 'Production'})))).toBe('INVALID_ENVIRONMENT')
  })
})

describe('Modula Premium: status transitions', () => {
  const now = new Date()
  const tx = (overrides: Record<string, unknown> = {}) => transactionPayload(overrides) as any
  const notification = (notificationType: string, subtype?: string, renewalInfo: any = null) => ({notificationType, subtype, notificationUUID: 'x', environment: 'Sandbox', transaction: null, renewalInfo})
  const active = {status: 'active' as const, grace_expires_at: null, auto_renew: true}

  it.each([
    ['SUBSCRIBED', undefined, 'active'],
    ['DID_RENEW', undefined, 'active'],
    ['DID_FAIL_TO_RENEW', 'GRACE_PERIOD', 'grace'],
    ['DID_FAIL_TO_RENEW', undefined, 'billing_retry'],
    ['GRACE_PERIOD_EXPIRED', undefined, 'billing_retry'],
    ['EXPIRED', 'VOLUNTARY', 'expired'],
    ['REFUND', undefined, 'revoked'],
    ['REVOKE', undefined, 'revoked'],
    ['DID_CHANGE_RENEWAL_STATUS', 'AUTO_RENEW_DISABLED', 'active'],
    ['PRICE_INCREASE', undefined, 'active'],
  ])('%s %s -> %s', (type, subtype, expected) => {
    expect(nextState(active, tx(), notification(type, subtype) as any, now).status).toBe(expected)
  })

  it('client transactions follow Apple dates', () => {
    expect(nextState(undefined, tx(), null, now).status).toBe('active')
    expect(nextState(undefined, tx({expiresDate: now.getTime() - 1000}), null, now).status).toBe('expired')
    expect(nextState(undefined, tx({revocationDate: now.getTime() - 1000}), null, now).status).toBe('revoked')
  })

  it('a client post never undoes a grace or billing-retry state', () => {
    const expiredTx = tx({expiresDate: now.getTime() - 1000})
    expect(nextState({status: 'grace', grace_expires_at: new Date(now.getTime() + 1000), auto_renew: true}, expiredTx, null, now).status).toBe('grace')
    expect(nextState({status: 'billing_retry', grace_expires_at: null, auto_renew: true}, expiredTx, null, now).status).toBe('billing_retry')
  })

  it('records auto-renew from renewal info', () => {
    expect(nextState(active, tx(), notification('DID_CHANGE_RENEWAL_STATUS', 'AUTO_RENEW_DISABLED', {autoRenewStatus: 0}) as any, now).autoRenew).toBe(false)
  })
})
