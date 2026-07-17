import {isModulaApiError} from '@/api/contracts'

export function queryRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false
  if (!isModulaApiError(error)) return failureCount < 2
  if (!error.retryable) return false
  if (
    error.code === 'VALIDATION_FAILED' ||
    error.code === 'UNAUTHENTICATED' ||
    error.code === 'SESSION_EXPIRED' ||
    error.code === 'FORBIDDEN' ||
    error.code === 'NOT_FOUND' ||
    error.code === 'CONFLICT' ||
    error.code === 'CANCELLED' ||
    error.code === 'INVALID_RESPONSE' ||
    error.code === 'AUTHENTICATION_NOT_AVAILABLE' ||
    error.code === 'CAPABILITY_DISABLED'
  ) {
    return false
  }
  return (
    error.code === 'OFFLINE' ||
    error.code === 'TIMEOUT' ||
    error.code === 'SERVER_ERROR' ||
    error.code === 'RATE_LIMITED'
  )
}
