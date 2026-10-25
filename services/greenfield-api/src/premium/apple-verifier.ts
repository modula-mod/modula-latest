import {createHash, X509Certificate} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {Environment, SignedDataVerifier, VerificationException, VerificationStatus} from '@apple/app-store-server-library'
import {APPLE_ROOT_CA_G3_BASE64, APPLE_ROOT_CA_G3_SHA256} from './apple-root.js'

/** Decoded StoreKit 2 transaction fields Modula relies on. */
export type AppleTransaction = {
  transactionId: string
  originalTransactionId: string
  productId: string
  bundleId: string
  environment: string
  appAccountToken?: string
  purchaseDate?: number
  originalPurchaseDate?: number
  expiresDate?: number
  revocationDate?: number
  revocationReason?: number
  signedDate?: number
  type?: string
}

export type AppleRenewalInfo = {
  originalTransactionId?: string
  autoRenewStatus?: number
  gracePeriodExpiresDate?: number
  isInBillingRetryPeriod?: boolean
  environment?: string
}

export type AppleNotification = {
  notificationType: string
  subtype?: string
  notificationUUID: string
  signedDate?: number
  environment: string
  transaction: AppleTransaction | null
  renewalInfo: AppleRenewalInfo | null
}

export interface AppleJwsVerifier {
  readonly environment: string
  verifyTransaction(jws: string): Promise<AppleTransaction>
  verifyNotification(signedPayload: string): Promise<AppleNotification>
}

export class AppleVerificationError extends Error {
  readonly code = 'VALIDATION_FAILED'
  constructor(readonly reason: string) {
    super(`Apple signed data rejected: ${reason}`)
  }
}

export type AppleVerifierOptions = {
  bundleId: string
  /** Only 'Sandbox' is accepted while payments are in QA. */
  environment: 'Sandbox'
  enableOnlineChecks: boolean
  /** DER root certificates. Defaults to the pinned Apple Root CA - G3. */
  rootCertificates?: Buffer[]
}

const STATUS_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(VerificationStatus).filter(([, value]) => typeof value === 'number').map(([key, value]) => [value as number, key]),
)

/**
 * Verifies StoreKit 2 JWS values with Apple's App Store Server Library:
 * x5c chain to a pinned Apple root, Apple OID markers on leaf and
 * intermediate, certificate dates (and OCSP when online checks are on),
 * the ES256 signature, the bundle ID and the configured environment.
 */
export class AppStoreJwsVerifier implements AppleJwsVerifier {
  private readonly verifier: SignedDataVerifier
  readonly environment: string

  constructor(options: AppleVerifierOptions) {
    if (options.environment !== 'Sandbox') throw new Error('Only the App Store Sandbox environment is enabled for Modula Premium')
    const roots = options.rootCertificates ?? [appleRootCertificate()]
    this.environment = options.environment
    this.verifier = new SignedDataVerifier(roots, options.enableOnlineChecks, Environment.SANDBOX, options.bundleId)
  }

  async verifyTransaction(jws: string): Promise<AppleTransaction> {
    const decoded = await this.run(() => this.verifier.verifyAndDecodeTransaction(boundedJws(jws)))
    return normaliseTransaction(decoded)
  }

  async verifyNotification(signedPayload: string): Promise<AppleNotification> {
    const decoded: any = await this.run(() => this.verifier.verifyAndDecodeNotification(boundedJws(signedPayload)))
    const data = decoded.data ?? {}
    const transaction = typeof data.signedTransactionInfo === 'string' ? await this.verifyTransaction(data.signedTransactionInfo) : null
    const renewalInfo = typeof data.signedRenewalInfo === 'string'
      ? normaliseRenewal(await this.run(() => this.verifier.verifyAndDecodeRenewalInfo(boundedJws(data.signedRenewalInfo))))
      : null
    if (typeof decoded.notificationType !== 'string' || typeof decoded.notificationUUID !== 'string') throw new AppleVerificationError('MALFORMED_NOTIFICATION')
    return {
      notificationType: decoded.notificationType,
      subtype: typeof decoded.subtype === 'string' ? decoded.subtype : undefined,
      notificationUUID: decoded.notificationUUID,
      signedDate: numberOrUndefined(decoded.signedDate),
      environment: String(data.environment ?? ''),
      transaction,
      renewalInfo,
    }
  }

  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work()
    } catch (error) {
      if (error instanceof AppleVerificationError) throw error
      if (error instanceof VerificationException) throw new AppleVerificationError(STATUS_NAMES[error.status] ?? 'VERIFICATION_FAILURE')
      throw new AppleVerificationError('VERIFICATION_FAILURE')
    }
  }
}

export function appleRootCertificate(): Buffer {
  const der = Buffer.from(APPLE_ROOT_CA_G3_BASE64, 'base64')
  const digest = createHash('sha256').update(der).digest('hex')
  if (digest !== APPLE_ROOT_CA_G3_SHA256) throw new Error('Pinned Apple root certificate does not match its fingerprint')
  return der
}

/** QA only: load extra PEM/DER roots so mock transactions can be verified end to end. Refused in production. */
export function loadQaRootCertificates(path: string, modulaEnvironment: string): Buffer[] {
  if (modulaEnvironment === 'production') throw new Error('Custom App Store root certificates are refused in production')
  return [new X509Certificate(readFileSync(path)).raw]
}

function boundedJws(value: unknown): string {
  if (typeof value !== 'string' || value.length < 20 || value.length > 64_000 || value.split('.').length !== 3) throw new AppleVerificationError('MALFORMED_JWS')
  return value
}

function normaliseTransaction(decoded: any): AppleTransaction {
  const transactionId = stringOrUndefined(decoded?.transactionId)
  const originalTransactionId = stringOrUndefined(decoded?.originalTransactionId)
  const productId = stringOrUndefined(decoded?.productId)
  if (!transactionId || !originalTransactionId || !productId) throw new AppleVerificationError('MALFORMED_TRANSACTION')
  return {
    transactionId,
    originalTransactionId,
    productId,
    bundleId: String(decoded.bundleId ?? ''),
    environment: String(decoded.environment ?? ''),
    appAccountToken: stringOrUndefined(decoded.appAccountToken)?.toLowerCase(),
    purchaseDate: numberOrUndefined(decoded.purchaseDate),
    originalPurchaseDate: numberOrUndefined(decoded.originalPurchaseDate),
    expiresDate: numberOrUndefined(decoded.expiresDate),
    revocationDate: numberOrUndefined(decoded.revocationDate),
    revocationReason: numberOrUndefined(decoded.revocationReason),
    signedDate: numberOrUndefined(decoded.signedDate),
    type: stringOrUndefined(decoded.type),
  }
}

function normaliseRenewal(decoded: any): AppleRenewalInfo {
  return {
    originalTransactionId: stringOrUndefined(decoded?.originalTransactionId),
    autoRenewStatus: numberOrUndefined(decoded?.autoRenewStatus),
    gracePeriodExpiresDate: numberOrUndefined(decoded?.gracePeriodExpiresDate),
    isInBillingRetryPeriod: typeof decoded?.isInBillingRetryPeriod === 'boolean' ? decoded.isInBillingRetryPeriod : undefined,
    environment: stringOrUndefined(decoded?.environment),
  }
}

function stringOrUndefined(value: unknown) { return typeof value === 'string' && value ? value : undefined }
function numberOrUndefined(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? value : undefined }
