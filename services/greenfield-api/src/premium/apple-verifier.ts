import {readFileSync} from 'node:fs'
import {
  Environment,
  SignedDataVerifier,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library'
import type {AppConfig} from '../config/index.js'

export type AppleTransactionPayload = JWSTransactionDecodedPayload
export type AppleRenewalPayload = JWSRenewalInfoDecodedPayload
export type AppleNotificationPayload = ResponseBodyV2DecodedPayload

export interface PremiumAppleVerifier {
  verifyTransaction(signedTransaction: string): Promise<AppleTransactionPayload>
  verifyRenewal(signedRenewal: string): Promise<AppleRenewalPayload>
  verifyNotification(signedPayload: string): Promise<AppleNotificationPayload>
}

export function createPremiumAppleVerifier(config: AppConfig): PremiumAppleVerifier | null {
  if (!config.premium.appleSandbox.enabled) return null
  if (!config.premium.appleSandbox.bundleId || config.premium.appleSandbox.rootCaFiles.length === 0) {
    throw new Error('Apple sandbox verifier configuration is incomplete')
  }
  const roots = config.premium.appleSandbox.rootCaFiles.map(path => readFileSync(path))
  const verifier = new SignedDataVerifier(
    roots,
    config.premium.appleSandbox.onlineChecks,
    Environment.SANDBOX,
    config.premium.appleSandbox.bundleId,
  )
  return {
    verifyTransaction: signedTransaction => verifier.verifyAndDecodeTransaction(signedTransaction),
    verifyRenewal: signedRenewal => verifier.verifyAndDecodeRenewalInfo(signedRenewal),
    verifyNotification: signedPayload => verifier.verifyAndDecodeNotification(signedPayload),
  }
}
