import {execFileSync} from 'node:child_process'
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createPrivateKey, randomUUID, sign as cryptoSign, X509Certificate} from 'node:crypto'

/**
 * Throwaway test-only certificate chain that mimics Apple's StoreKit chain shape
 * (root -> intermediate with OID 1.2.840.113635.100.6.2.1 -> leaf with OID
 * 1.2.840.113635.100.6.11.1). Generated fresh with openssl for every run; no key
 * material is committed. Never trusted outside tests / isolated QA.
 */
export type TestChain = {
  dir: string
  rootPemPath: string
  rootDer: Buffer
  x5c: string[]
  signJws(payload: Record<string, unknown>, options?: {x5c?: string[]}): string
}

export function createTestChain(options: {leafAppleOid?: boolean; label?: string} = {}): TestChain {
  const dir = mkdtempSync(join(tmpdir(), 'modula-storekit-chain-'))
  const run = (...args: string[]) => execFileSync('openssl', args, {cwd: dir, stdio: 'pipe'})
  const label = options.label ?? 'Modula QA'
  writeFileSync(join(dir, 'int.ext'), 'basicConstraints=critical,CA:true\nkeyUsage=critical,keyCertSign,cRLSign\n1.2.840.113635.100.6.2.1=ASN1:NULL\n')
  writeFileSync(join(dir, 'leaf.ext'), `basicConstraints=critical,CA:false\nkeyUsage=critical,digitalSignature\n${options.leafAppleOid === false ? '' : '1.2.840.113635.100.6.11.1=ASN1:NULL\n'}`)
  for (const name of ['root', 'int', 'leaf']) run('ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', `${name}.key`)
  run('req', '-x509', '-new', '-key', 'root.key', '-sha256', '-days', '3650', '-subj', `/CN=${label} Test Root/O=Modula QA`, '-addext', 'basicConstraints=critical,CA:true', '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-out', 'root.pem')
  run('req', '-new', '-key', 'int.key', '-subj', `/CN=${label} Test Intermediate/O=Modula QA`, '-out', 'int.csr')
  run('x509', '-req', '-in', 'int.csr', '-CA', 'root.pem', '-CAkey', 'root.key', '-CAcreateserial', '-days', '3650', '-sha256', '-extfile', 'int.ext', '-out', 'int.pem')
  run('req', '-new', '-key', 'leaf.key', '-subj', `/CN=${label} Test StoreKit Leaf/O=Modula QA`, '-out', 'leaf.csr')
  run('x509', '-req', '-in', 'leaf.csr', '-CA', 'int.pem', '-CAkey', 'int.key', '-CAcreateserial', '-days', '3650', '-sha256', '-extfile', 'leaf.ext', '-out', 'leaf.pem')
  const der = (name: string) => new X509Certificate(readFileSync(join(dir, `${name}.pem`))).raw
  const x5c = ['leaf', 'int', 'root'].map(name => der(name).toString('base64'))
  const leafKey = createPrivateKey(readFileSync(join(dir, 'leaf.key')))
  return {
    dir,
    rootPemPath: join(dir, 'root.pem'),
    rootDer: der('root'),
    x5c,
    signJws(payload, signOptions = {}) {
      const header = b64url(JSON.stringify({alg: 'ES256', x5c: signOptions.x5c ?? x5c}))
      const body = b64url(JSON.stringify(payload))
      const signature = cryptoSign('sha256', Buffer.from(`${header}.${body}`), {key: leafKey, dsaEncoding: 'ieee-p1363'})
      return `${header}.${body}.${signature.toString('base64url')}`
    },
  }
}

export function b64url(value: string) { return Buffer.from(value).toString('base64url') }

export const TEST_BUNDLE_ID = 'digital.modula.app.native'

export function transactionPayload(overrides: Record<string, unknown> = {}) {
  const now = Date.now()
  const originalTransactionId = String(overrides.originalTransactionId ?? `2000000${Math.floor(Math.random() * 1e9)}`)
  return {
    transactionId: String(overrides.transactionId ?? `${originalTransactionId}1`),
    originalTransactionId,
    bundleId: TEST_BUNDLE_ID,
    productId: 'digital.modula.premium.horizon.monthly',
    subscriptionGroupIdentifier: '21000001',
    purchaseDate: now - 60_000,
    originalPurchaseDate: now - 60_000,
    expiresDate: now + 30 * 24 * 3600_000,
    quantity: 1,
    type: 'Auto-Renewable Subscription',
    inAppOwnershipType: 'PURCHASED',
    signedDate: now,
    environment: 'Sandbox',
    transactionReason: 'PURCHASE',
    storefront: 'GBR',
    storefrontId: '143444',
    price: 9990,
    currency: 'GBP',
    ...overrides,
  }
}

export function renewalPayload(overrides: Record<string, unknown> = {}) {
  return {
    originalTransactionId: '0',
    autoRenewProductId: 'digital.modula.premium.horizon.monthly',
    productId: 'digital.modula.premium.horizon.monthly',
    autoRenewStatus: 1,
    signedDate: Date.now(),
    environment: 'Sandbox',
    recentSubscriptionStartDate: Date.now() - 60_000,
    renewalDate: Date.now() + 30 * 24 * 3600_000,
    ...overrides,
  }
}

export function notificationPayload(chain: TestChain, input: {notificationType: string; subtype?: string; transaction: Record<string, unknown>; renewal?: Record<string, unknown>; environment?: string; notificationUUID?: string; signedDate?: number}) {
  const environment = input.environment ?? 'Sandbox'
  return chain.signJws({
    notificationType: input.notificationType,
    ...(input.subtype ? {subtype: input.subtype} : {}),
    notificationUUID: input.notificationUUID ?? randomUUID(),
    version: '2.0',
    signedDate: input.signedDate ?? Date.now(),
    data: {
      bundleId: TEST_BUNDLE_ID,
      environment,
      status: 1,
      signedTransactionInfo: chain.signJws(input.transaction),
      signedRenewalInfo: chain.signJws(input.renewal ?? renewalPayload({originalTransactionId: input.transaction.originalTransactionId, environment})),
    },
  })
}
