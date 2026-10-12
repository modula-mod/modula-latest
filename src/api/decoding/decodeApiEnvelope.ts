import {ModulaApiError, type ApiErrorCode} from '@/api/contracts/ApiError'
import type {ApiEnvelope} from '@/api/contracts/ApiEnvelope'
import {asBoolean, asRecord, asString, asIsoDate} from '@/api/decoding/validation'

const knownCodes = new Set<ApiErrorCode>([
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'CHALLENGE_EXPIRED',
  'CHALLENGE_INVALID',
  'CHALLENGE_REPLAYED',
  'SESSION_EXPIRED',
  'STEP_UP_REQUIRED',
  'PASSKEY_NOT_FOUND',
  'AUTH_METHOD_UNAVAILABLE',
  'ACCOUNT_SUSPENDED',
  'FORBIDDEN',
  'PERMISSION_REVIEW_REQUIRED',
  'MODULE_PERMISSION_DENIED',
  'INSTALLATION_DISABLED',
  'UNTRUSTED_RELEASE',
  'NOT_FOUND',
  'CONFLICT',
  'NOTE_REVISION_CONFLICT',
  'REVISION_CONFLICT',
  'MUTATION_REUSE_CONFLICT',
  'INVALID_CURSOR',
  'FUNCTION_NOT_AVAILABLE',
  'CAPABILITY_UNAVAILABLE',
  'AI_ACTION_NOT_DECLARED',
  'AI_ACTION_PERMISSION_REQUIRED',
  'AI_CONTEXT_PERMISSION_REQUIRED',
  'AI_RESULT_EXPIRED',
  'AI_RESULT_ALREADY_APPLIED',
  'AI_RESULT_NOT_APPLICABLE',
  'AI_RESULT_OWNERSHIP_MISMATCH',
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
  const details =
    error.details && typeof error.details === 'object' && !Array.isArray(error.details)
      ? error.details as Record<string, unknown>
      : undefined
  const errorRequestId =
    typeof error.requestId === 'string' && error.requestId.trim()
      ? error.requestId
      : meta.requestId

  return {
    ok: false,
    error: {
      code: decodeErrorCode(error.code),
      message: asString(error.message, 'error message'),
      requestId: errorRequestId,
      fieldErrors,
      retryable: asBoolean(error.retryable, 'error retryable'),
      details,
    },
    meta,
  }
}
