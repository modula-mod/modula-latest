import {randomUUID} from 'node:crypto'
import type {ApiEnvelope, ApiErrorCode} from '@modula/api-contracts'

export function createRequestId(existing?: string): string {
  if (existing && existing.trim()) return existing.trim().slice(0, 128)
  return randomUUID()
}

export function successEnvelope<T>(data: T, requestId: string): ApiEnvelope<T> {
  return {
    ok: true,
    data,
    meta: {
      requestId,
      serverTime: new Date().toISOString(),
    },
  }
}

export function failureEnvelope(
  code: ApiErrorCode,
  message: string,
  requestId: string,
  options?: {
    retryable?: boolean
    fieldErrors?: Record<string, string>
    details?: Record<string, unknown>
  },
): ApiEnvelope<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      requestId,
      retryable: options?.retryable ?? false,
      fieldErrors: options?.fieldErrors,
      details: options?.details,
    },
    meta: {
      requestId,
      serverTime: new Date().toISOString(),
    },
  }
}

export function statusForError(code: ApiErrorCode): number {
  switch (code) {
    case 'BAD_REQUEST':
    case 'VALIDATION_FAILED':
      return 400
    case 'UNAUTHENTICATED':
    case 'INVALID_CREDENTIALS':
    case 'CHALLENGE_EXPIRED':
    case 'CHALLENGE_INVALID':
    case 'CHALLENGE_REPLAYED':
    case 'SESSION_EXPIRED':
    case 'STEP_UP_REQUIRED':
    case 'PASSKEY_NOT_FOUND':
    case 'AUTH_METHOD_UNAVAILABLE':
    case 'AUTHENTICATION_NOT_AVAILABLE':
      return 401
    case 'FORBIDDEN':
    case 'ACCOUNT_SUSPENDED':
    case 'CAPABILITY_DISABLED':
    case 'AI_ACTION_PERMISSION_REQUIRED':
    case 'AI_CONTEXT_PERMISSION_REQUIRED':
    case 'AI_RESULT_OWNERSHIP_MISMATCH':
      return 403
    case 'NOT_FOUND':
    case 'AI_ACTION_NOT_DECLARED':
      return 404
    case 'CONFLICT':
    case 'NOTE_REVISION_CONFLICT':
    case 'AI_RESULT_ALREADY_APPLIED':
      return 409
    case 'AI_RESULT_EXPIRED':
    case 'AI_RESULT_NOT_APPLICABLE':
      return 400
    case 'RATE_LIMITED':
      return 429
    default:
      return 500
  }
}
