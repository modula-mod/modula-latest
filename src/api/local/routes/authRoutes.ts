import {ModulaApiError} from '@/api/contracts'
import type {LocalApiDatabase} from '@/api/local/LocalApiDatabase'
import type {MutableLocalApiConfiguration} from '@/api/local/LocalApiConfiguration'
import type {LocalApiRoute} from '@/api/local/LocalApiRouter'
import {parseRefreshToken} from '@/auth/contracts'
import {bodyRecord, requireSession, requireString} from '@/api/local/routes/routeHelpers'

function normaliseEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function createAuthRoutes(
  database: LocalApiDatabase,
  configuration: MutableLocalApiConfiguration,
): LocalApiRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/auth/sign-in',
      handler: ({request}) => {
        const body = bodyRecord(request.body)
        const email = normaliseEmail(requireString(body.email, 'email'))
        const password = requireString(body.password, 'password')
        if (password.length < 8) {
          throw new ModulaApiError({
            message: 'Password must be at least eight characters.',
            code: 'VALIDATION_FAILED',
            status: 400,
            fieldErrors: {password: 'Password must be at least eight characters.'},
          })
        }
        try {
          return database.createSession({email})
        } catch {
          throw new ModulaApiError({
            message: 'Use an approved Modula Account.',
            code: 'UNAUTHENTICATED',
            status: 401,
            retryable: false,
          })
        }
      },
    },
    {
      method: 'POST',
      path: '/v1/auth/register',
      handler: ({request}) => {
        const body = bodyRecord(request.body)
        const email = normaliseEmail(requireString(body.email, 'email'))
        const displayName = requireString(body.displayName, 'displayName')
        const handle = requireString(body.handle, 'handle').toLowerCase()
        const password = requireString(body.password, 'password')
        if (password.length < 8) {
          throw new ModulaApiError({
            message: 'Password must be at least eight characters.',
            code: 'VALIDATION_FAILED',
            status: 400,
            fieldErrors: {password: 'Password must be at least eight characters.'},
          })
        }
        try {
          return database.register({email, displayName, handle})
        } catch (error) {
          throw new ModulaApiError({
            message: error instanceof Error ? error.message : 'Registration failed.',
            code: 'CONFLICT',
            status: 409,
            retryable: false,
          })
        }
      },
    },
    {
      method: 'POST',
      path: '/v1/auth/refresh',
      handler: ({request}) => {
        const body = bodyRecord(request.body)
        const refreshToken = parseRefreshToken(requireString(body.refreshToken, 'refreshToken'))
        const result = database.refreshSession(refreshToken)
        if (!result) {
          throw new ModulaApiError({
            message: 'Session expired.',
            code: 'SESSION_EXPIRED',
            status: 401,
            retryable: false,
          })
        }
        return result
      },
    },
    {
      method: 'POST',
      path: '/v1/auth/sign-out',
      handler: ({request}) => {
        const body = bodyRecord(request.body)
        const token = typeof body.refreshToken === 'string'
          ? parseRefreshToken(body.refreshToken)
          : null
        database.revokeSession(token)
        return {signedOut: true}
      },
    },
    {
      method: 'GET',
      path: '/v1/auth/session',
      handler: ({accessToken}) =>
        requireSession({database, configuration, accessToken}),
    },
  ]
}
