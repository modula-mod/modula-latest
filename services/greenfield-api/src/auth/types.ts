import type {
  AuthenticationChallengePurpose,
  AuthenticationChallengeState,
  AuthenticationDeliveryChannel,
  AuthenticationMethodState,
  AuthenticationMethodType,
  AuthenticationStrength,
  SecurityEventSeverity,
} from '../database/types.js'

export type {
  AuthenticationChallengePurpose,
  AuthenticationChallengeState,
  AuthenticationDeliveryChannel,
  AuthenticationMethodState,
  AuthenticationMethodType,
  AuthenticationStrength,
  SecurityEventSeverity,
}

export const AUTHENTICATION_METHOD_TYPES: AuthenticationMethodType[] = [
  'passkey',
  'password',
  'email_otp',
  'totp',
  'recovery_code',
  'apple',
  'oidc',
]

export const AUTHENTICATION_CHALLENGE_PURPOSES: AuthenticationChallengePurpose[] = [
  'email_verification',
  'email_login',
  'password_reset',
  'email_change',
  'passkey_registration',
  'passkey_authentication',
  'totp_enrollment',
  'step_up',
  'account_recovery',
]

export const AUTHENTICATION_STRENGTH_RANK: Record<AuthenticationStrength, number> = {
  low: 10,
  recovery: 20,
  medium: 30,
  strong: 40,
  phishing_resistant: 50,
}

export type AuthenticationMethodSummary = {
  methodId: string
  accountId: string
  methodType: AuthenticationMethodType
  displayLabel: string | null
  state: AuthenticationMethodState
  strength: AuthenticationStrength
  verifiedAt: Date | null
  lastUsedAt: Date | null
  createdAt: Date
  revokedAt: Date | null
}

export function isAuthenticationStrengthAtLeast(
  actual: AuthenticationStrength | null | undefined,
  required: AuthenticationStrength,
): boolean {
  if (!actual) return false
  return AUTHENTICATION_STRENGTH_RANK[actual] >= AUTHENTICATION_STRENGTH_RANK[required]
}
