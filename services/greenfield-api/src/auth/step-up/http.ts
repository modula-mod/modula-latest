import {failureEnvelope, statusForError} from '../../transport/envelope.js'
import {evaluateStepUpRequirement, type SensitiveAuthAction, type SessionAuthenticationContext} from './policy.js'

/**
 * Shared HTTP guard for sensitive actions. Recent authentication is taken only
 * from the server-side session (its `recent_authentication_at`, which login
 * and the `/v1/auth/step-up/*` endpoints refresh) and its authentication
 * strength, never from anything the client sends. Replies with
 * STEP_UP_REQUIRED and returns false when the policy for `action` is not met.
 */
export function requireStepUp(
  action: SensitiveAuthAction,
  auth: SessionAuthenticationContext | null | undefined,
  reply: {code(status: number): {send(payload: unknown): unknown}},
  requestId: string,
): boolean {
  if (!auth) return false
  const evaluation = evaluateStepUpRequirement(action, {
    recentAuthenticationAt: auth.recentAuthenticationAt,
    authenticationStrength: auth.authenticationStrength,
  })
  if (!evaluation.allowed) {
    reply.code(statusForError('STEP_UP_REQUIRED')).send(failureEnvelope('STEP_UP_REQUIRED', 'Recent stronger authentication required', requestId))
    return false
  }
  return true
}
