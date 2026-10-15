import {randomUUID} from 'node:crypto'
import {API_ERROR_HTTP_STATUS, type ApiEnvelope, type ApiErrorCode} from '@modula/api-contracts'

export function createRequestId(existing?: string): string {
  if (existing && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(existing.trim())) return existing.trim()
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
  return API_ERROR_HTTP_STATUS[code]
}
