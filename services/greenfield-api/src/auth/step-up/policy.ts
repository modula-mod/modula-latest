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
  | 'delete_module_data'

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

// Recent medium-strength sign-in; shared by revoke_all_sessions (DELETE /v1/accounts/me/sessions)
// and delete_module_data (DELETE /v1/modules/:id/install with choice deleteData, #192).
type ActionPolicy = {requiredStrength: AuthenticationStrength; acceptableMethods: AuthenticationMethodType[][]; recentWindowSeconds: number}

const RECENT_MEDIUM_POLICY: ActionPolicy = {requiredStrength: 'medium', acceptableMethods: [['passkey'], ['password'], ['apple']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS}

const ACTION_POLICIES: Record<SensitiveAuthAction, ActionPolicy> = {
  add_passkey: {requiredStrength: 'medium', acceptableMethods: [['passkey'], ['password'], ['apple']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  remove_passkey: {requiredStrength: 'strong', acceptableMethods: [['passkey'], ['password', 'totp']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  change_password: {requiredStrength: 'medium', acceptableMethods: [['passkey'], ['password'], ['apple']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  change_contact_email: {requiredStrength: 'strong', acceptableMethods: [['passkey'], ['password', 'totp']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  enable_totp: {requiredStrength: 'medium', acceptableMethods: [['passkey'], ['password']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  disable_totp: {requiredStrength: 'strong', acceptableMethods: [['passkey'], ['password', 'totp']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  regenerate_recovery_codes: {requiredStrength: 'strong', acceptableMethods: [['passkey'], ['password', 'totp']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  revoke_all_sessions: RECENT_MEDIUM_POLICY,
  link_external_identity: {requiredStrength: 'medium', acceptableMethods: [['passkey'], ['password'], ['apple']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  change_mail_forwarding: {requiredStrength: 'strong', acceptableMethods: [['passkey'], ['password', 'totp']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  account_export: {requiredStrength: 'strong', acceptableMethods: [['passkey'], ['password', 'totp']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  account_delete: {requiredStrength: 'strong', acceptableMethods: [['passkey'], ['password', 'totp']], recentWindowSeconds: DEFAULT_RECENT_WINDOW_SECONDS},
  dimon_operation: {requiredStrength: 'phishing_resistant', acceptableMethods: [['passkey']], recentWindowSeconds: 5 * 60},
  // Deleting a module's data (uninstall choice deleteData, #192): the same policy as revoke_all_sessions.
  delete_module_data: RECENT_MEDIUM_POLICY,
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
