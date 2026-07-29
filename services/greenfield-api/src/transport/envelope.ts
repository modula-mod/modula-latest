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
    case 'SESSION_EXPIRED':
    case 'AUTHENTICATION_NOT_AVAILABLE':
      return 401
    case 'FORBIDDEN':
    case 'CAPABILITY_DISABLED':
      return 403
    case 'NOT_FOUND':
      return 404
    case 'CONFLICT':
    case 'NOTE_REVISION_CONFLICT':
      return 409
    case 'RATE_LIMITED':
      return 429
    default:
      return 500
  }
}
