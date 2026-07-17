import {ModulaApiError, type ApiErrorCode} from '@/api/contracts/ApiError'
import type {ApiEnvelope} from '@/api/contracts/ApiEnvelope'
import {asBoolean, asRecord, asString, asIsoDate} from '@/api/decoding/validation'

const knownCodes = new Set<ApiErrorCode>([
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'OFFLINE',
  'TIMEOUT',
  'SERVER_ERROR',
  'INVALID_RESPONSE',
  'CANCELLED',
  'UNKNOWN',
  'AUTHENTICATION_NOT_AVAILABLE',
  'CAPABILITY_DISABLED',
])

function decodeMeta(value: unknown) {
  const meta = asRecord(value, 'envelope meta')
  return {
    requestId: asString(meta.requestId, 'request id'),
    serverTime: asIsoDate(meta.serverTime, 'server time'),
  }
}

function decodeErrorCode(value: unknown): ApiErrorCode {
  const code = asString(value, 'error code')
  if (!knownCodes.has(code as ApiErrorCode)) {
    throw new ModulaApiError({
      message: 'API returned an unknown error code.',
      code: 'INVALID_RESPONSE',
      status: 0,
      retryable: false,
    })
  }
  return code as ApiErrorCode
}

export function decodeApiEnvelope<T>(
  value: unknown,
  decodeData: (data: unknown) => T,
): ApiEnvelope<T> {
  const envelope = asRecord(value, 'API envelope')
  const ok = asBoolean(envelope.ok, 'envelope ok')
  const meta = decodeMeta(envelope.meta)
  if (ok) {
    return {
      ok: true,
      data: decodeData(envelope.data),
      meta,
    }
  }

  const error = asRecord(envelope.error, 'API error')
  const fieldErrors =
    error.fieldErrors && typeof error.fieldErrors === 'object' && !Array.isArray(error.fieldErrors)
      ? Object.fromEntries(
          Object.entries(error.fieldErrors).filter((entry): entry is [string, string] =>
            typeof entry[1] === 'string',
          ),
        )
      : undefined

  return {
    ok: false,
    error: {
      code: decodeErrorCode(error.code),
      message: asString(error.message, 'error message'),
      fieldErrors,
      retryable: asBoolean(error.retryable, 'error retryable'),
    },
    meta,
  }
}
