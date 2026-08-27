import type {AuthenticationMethodType, AuthenticationStrength} from '../types.js'
import {isAuthenticationStrengthAtLeast} from '../types.js'

export type SensitiveAuthAction =
  | 'add_passkey'
  | 'remove_passkey'
  | 'change_password'
  | 'change_contact_email'
  | 'enable_totp'
  | 'disable_totp'
  | 'regenerate_recovery_codes'
  | 'revoke_all_sessions'
  | 'link_external_identity'
  | 'change_mail_forwarding'
  | 'account_export'
  | 'account_delete'
  | 'dimon_operation'

export type StepUpEvaluation = {
  allowed: boolean
  code: 'ALLOWED' | 'STEP_UP_REQUIRED'
  requiredStrength: AuthenticationStrength
  acceptableMethods: AuthenticationMethodType[][]
  recentWindowSeconds: number
  reason?: string
}

export type SessionAuthenticationContext = {
  recentAuthenticationAt?: Date | null
  authenticationStrength?: AuthenticationStrength | null
}

const DEFAULT_RECENT_WINDOW_SECONDS = 15 * 60

const ACTION_POLICIES: Record<
  SensitiveAuthAction,
  {requiredStrength: AuthenticationStrength; acceptableMethods: AuthenticationMethodType[][]; recentWindowSeconds: number}
> = {
  add_passkey: {requiredStrength: 'medium', acceptableMethods: [['passkey'], ['password'], ['apple']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  remove_passkey: {requiredStrength: 'strong', acceptableMethods: [['passkey'], ['password', 'totp']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  change_password: {requiredStrength: 'medium', acceptableMethods: [['passkey'], ['password'], ['apple']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  change_contact_email: {requiredStrength: 'strong', acceptableMethods: [['passkey'], ['password', 'totp']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  enable_totp: {requiredStrength: 'medium', acceptableMethods: [['passkey'], ['password']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  disable_totp: {requiredStrength: 'strong', acceptableMethods: [['passkey'], ['password', 'totp']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  regenerate_recovery_codes: {requiredStrength: 'strong', acceptableMethods: [['passkey'], ['password', 'totp']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  revoke_all_sessions: {requiredStrength: 'medium', acceptableMethods: [['passkey'], ['password'], ['apple']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  link_external_identity: {requiredStrength: 'medium', acceptableMethods: [['passkey'], ['password'], ['apple']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  change_mail_forwarding: {requiredStrength: 'strong', acceptableMethods: [['passkey'], ['password', 'totp']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  account_export: {requiredStrength: 'strong', acceptableMethods: [['passkey'], ['password', 'totp']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  account_delete: {requiredStrength: 'strong', acceptableMethods: [['passkey'], ['password', 'totp']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  dimon_operation: {requiredStrength: 'phishing_resistant', acceptableMethods: [['passkey']], recentWindowSeconds: 5 * 60},
}

export function evaluateStepUpRequirement(
  action: SensitiveAuthAction,
  session: SessionAuthenticationContext,
  now = new Date(),
): StepUpEvaluation {
  const policy = ACTION_POLICIES[action]
  const recentAt = session.recentAuthenticationAt
  if (!recentAt) {
    return {...policy, allowed: false, code: 'STEP_UP_REQUIRED', reason: 'missing_recent_authentication'}
  }
  const ageMs = now.getTime() - recentAt.getTime()
  if (ageMs < 0 || ageMs > policy.recentWindowSeconds * 1000) {
    return {...policy, allowed: false, code: 'STEP_UP_REQUIRED', reason: 'recent_authentication_expired'}
  }
  if (!isAuthenticationStrengthAtLeast(session.authenticationStrength, policy.requiredStrength)) {
    return {...policy, allowed: false, code: 'STEP_UP_REQUIRED', reason: 'authentication_strength_insufficient'}
  }
  return {...policy, allowed: true, code: 'ALLOWED'}
}
