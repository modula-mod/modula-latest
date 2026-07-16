import {ModulaApiError} from '@/api/contracts'
import type {LocalApiDatabase} from '@/api/local/LocalApiDatabase'
import type {MutableLocalApiConfiguration} from '@/api/local/LocalApiConfiguration'

export function bodyRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ModulaApiError({
      message: `${label} is required.`,
      code: 'VALIDATION_FAILED',
      status: 400,
      retryable: false,
      fieldErrors: {[label]: `${label} is required.`},
    })
  }
  return value.trim()
}

export function optionalCursor(value: unknown): string | null {
  return typeof value === 'string' && value.length ? value : null
}

export function limit(value: unknown, fallback = 8): number {
  const next = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(next) && next > 0 ? Math.min(30, Math.floor(next)) : fallback
}

export function requireSession(input: {
  database: LocalApiDatabase
  configuration: MutableLocalApiConfiguration
  accessToken: string | null
}) {
  if (!input.accessToken) {
    throw new ModulaApiError({
      message: 'Sign in to continue.',
      code: 'UNAUTHENTICATED',
      status: 401,
      retryable: false,
    })
  }
  const session = input.database.getSessionByAccessToken(
    input.accessToken,
    input.configuration.get().sessionExpiryEnabled,
  )
  if (!session) {
    throw new ModulaApiError({
      message: 'Session expired.',
      code: 'SESSION_EXPIRED',
      status: 401,
      retryable: false,
    })
  }
  return session
}

export function notFound(message = 'Content not found.'): never {
  throw new ModulaApiError({
    message,
    code: 'NOT_FOUND',
    status: 404,
    retryable: false,
  })
}
