import {ModulaApiError} from '@/api/contracts'
import type {LocalApiDatabase} from '@/api/local/LocalApiDatabase'
import type {MutableLocalApiConfiguration} from '@/api/local/LocalApiConfiguration'
import type {LocalApiRoute} from '@/api/local/LocalApiRouter'
import {parseRefreshToken} from '@/auth/contracts'
import {bodyRecord, requireSession, requireString} from '@/api/local/routes/routeHelpers'

function normaliseEmail(value: string): string {
  return value.trim().toLowerCase()
}

function unauthenticated(message = 'Use an approved Modula Account.') {
  return new ModulaApiError({
    message,
    code: 'UNAUTHENTICATED',
    status: 401,
    retryable: false,
  })
}

export function createAuthRoutes(
  database: LocalApiDatabase,
  configuration: MutableLocalApiConfiguration,
): LocalApiRoute[] {
  return [
    // —— Greenfield sovereign account routes ——
    {
      method: 'POST',
      path: '/v1/accounts/register',
      handler: ({request}) => {
        const body = bodyRecord(request.body)
        const email = normaliseEmail(requireString(body.email, 'email'))
        const displayName = requireString(body.displayName ?? body.handle, 'displayName')
        const handle = requireString(body.handle, 'handle').toLowerCase()
        const password = requireString(body.password, 'password')
        if (password.length < 10) {
          throw new ModulaApiError({
            message: 'Password must be at least 10 characters.',
            code: 'VALIDATION_FAILED',
            status: 400,
            fieldErrors: {password: 'Password must be at least 10 characters.'},
          })
        }
        try {
          return database.registerPending({email, displayName, handle, password})
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
      path: '/v1/accounts/verify-email',
      handler: ({request}) => {
        const body = bodyRecord(request.body)
        const token = requireString(body.token, 'token')
        try {
          const verified = database.verifyEmail(token)
          const account = database.snapshot().accounts.find(item => item.accountId === verified.accountId)
          if (!account) throw new Error('Account not found.')
          const session = database.createSession({email: account.email, password: account.password})
          return {
            verified: true,
            account: database.toPublicAccount(account),
            ...database.toSessionTokenResponse(session),
          }
        } catch (error) {
          throw new ModulaApiError({
            message: error instanceof Error ? error.message : 'Verification failed.',
            code: 'UNAUTHENTICATED',
            status: 401,
            retryable: false,
          })
        }
      },
    },
    {
      method: 'POST',
      path: '/v1/accounts/resend-verification',
      handler: () => ({resent: true}),
    },
    {
      method: 'GET',
      path: '/v1/accounts/handles/:handle/availability',
      handler: ({params}) => {
        const handle = params.handle.toLowerCase()
        const taken = database.snapshot().profiles.some(profile => profile.handle === handle)
        return {handle, available: !taken, reason: taken ? 'taken' : undefined}
      },
    },
    {
      method: 'GET',
      path: '/v1/accounts/me',
      handler: ({accessToken}) => {
        const account = database.getAccountByAccessToken(
          accessToken ?? '',
          configuration.get().sessionExpiryEnabled,
        )
        if (!account) throw unauthenticated()
        return database.toPublicAccount(account)
      },
    },
    {
      method: 'PATCH',
      path: '/v1/accounts/me',
      handler: ({accessToken}) => {
        const account = database.getAccountByAccessToken(
          accessToken ?? '',
          configuration.get().sessionExpiryEnabled,
        )
        if (!account) throw unauthenticated()
        return database.toPublicAccount(account)
      },
    },
    {
      method: 'POST',
      path: '/v1/accounts/me/handle',
      handler: ({request, accessToken}) => {
        const account = database.getAccountByAccessToken(
          accessToken ?? '',
          configuration.get().sessionExpiryEnabled,
        )
        if (!account) throw unauthenticated()
        const body = bodyRecord(request.body)
        const handle = requireString(body.handle, 'handle').toLowerCase()
        try {
          return database.changeHandle(account.id, handle)
        } catch (error) {
          throw new ModulaApiError({
            message: error instanceof Error ? error.message : 'Handle change failed.',
            code: 'CONFLICT',
            status: 409,
            retryable: false,
          })
        }
      },
    },
    {
      method: 'GET',
      path: '/v1/accounts/me/sessions',
      handler: ({accessToken}) => {
        const account = database.getAccountByAccessToken(
          accessToken ?? '',
          configuration.get().sessionExpiryEnabled,
        )
        if (!account) throw unauthenticated()
        return database.listSessionsForAccount(account.id)
      },
    },
    {
      method: 'DELETE',
      path: '/v1/accounts/me/sessions',
      handler: ({accessToken}) => {
        const account = database.getAccountByAccessToken(
          accessToken ?? '',
          configuration.get().sessionExpiryEnabled,
        )
        if (!account) throw unauthenticated()
        database.revokeAllSessions(account.id)
        return {revoked: true}
      },
    },
    {
      method: 'POST',
      path: '/v1/accounts/me/password',
      handler: ({accessToken}) => {
        const account = database.getAccountByAccessToken(
          accessToken ?? '',
          configuration.get().sessionExpiryEnabled,
        )
        if (!account) throw unauthenticated()
        return {updated: true}
      },
    },
    {
      method: 'POST',
      path: '/v1/accounts/forgot-password',
      handler: () => ({accepted: true}),
    },
    {
      method: 'POST',
      path: '/v1/accounts/reset-password',
      handler: () => ({reset: true}),
    },
    {
      method: 'POST',
      path: '/v1/sessions',
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
          return database.toSessionTokenResponse(database.createSession({email, password}))
        } catch (error) {
          const code =
            error && typeof error === 'object' && 'code' in error
              ? String((error as {code: string}).code)
              : 'UNAUTHENTICATED'
          throw new ModulaApiError({
            message: error instanceof Error ? error.message : 'Sign-in failed.',
            code: code === 'pendingVerification' ? 'FORBIDDEN' : 'UNAUTHENTICATED',
            status: code === 'pendingVerification' ? 403 : 401,
            retryable: false,
          })
        }
      },
    },
    {
      method: 'POST',
      path: '/v1/sessions/refresh',
      handler: ({request}) => {
        const body = bodyRecord(request.body)
        const refreshToken = parseRefreshToken(requireString(body.refreshToken, 'refreshToken'))
        const result = database.refreshSession(refreshToken)
        if (!result) {
          throw new ModulaApiError({
            message: 'Your session was revoked for security. Sign in again.',
            code: 'SESSION_EXPIRED',
            status: 401,
            retryable: false,
          })
        }
        return database.toSessionTokenResponse(result)
      },
    },
    {
      method: 'DELETE',
      path: '/v1/sessions/current',
      handler: ({accessToken}) => {
        const session = database.getSessionByAccessToken(
          accessToken ?? '',
          configuration.get().sessionExpiryEnabled,
        )
        if (session) {
          const refresh = database
            .snapshot()
            .sessions.find(item => item.id === session.sessionId)?.refreshToken
          database.revokeSession(refresh ?? null)
        }
        return {revoked: true}
      },
    },
    {
      method: 'DELETE',
      path: '/v1/sessions/:sessionId',
      handler: ({params, accessToken}) => {
        const account = database.getAccountByAccessToken(
          accessToken ?? '',
          configuration.get().sessionExpiryEnabled,
        )
        if (!account) throw unauthenticated()
        database.revokeSessionById(params.sessionId as never, account.id)
        return {revoked: true}
      },
    },
    {
      method: 'POST',
      path: '/v1/repositories/me/exports',
      handler: ({accessToken}) => {
        const account = database.getAccountByAccessToken(
          accessToken ?? '',
          configuration.get().sessionExpiryEnabled,
        )
        if (!account) throw unauthenticated()
        return database.createExport(account.id)
      },
    },
    {
      method: 'GET',
      path: '/v1/repositories/me/exports/:exportId',
      handler: ({params, accessToken}) => {
        const account = database.getAccountByAccessToken(
          accessToken ?? '',
          configuration.get().sessionExpiryEnabled,
        )
        if (!account) throw unauthenticated()
        return {
          ...database.createExport(account.id),
          exportId: params.exportId,
        }
      },
    },
    {
      method: 'GET',
      path: '/v1/tools',
      handler: () => [
        {
          tool_id: 'tool-photo',
          slug: 'modula.tool.photo',
          display_name: 'Photo',
          availability: 'active',
          section: 'Media',
          manifest: {toolId: 'modula.tool.photo', name: 'Photo', surfaces: ['composer']},
        },
        {
          tool_id: 'tool-camera',
          slug: 'modula.tool.camera',
          display_name: 'Camera',
          availability: 'active',
          section: 'Media',
          manifest: {toolId: 'modula.tool.camera', name: 'Camera', surfaces: ['composer']},
        },
        {
          tool_id: 'tool-poll',
          slug: 'modula.tool.poll',
          display_name: 'Poll',
          availability: 'preview',
          section: 'Create',
          manifest: {toolId: 'modula.tool.poll', name: 'Poll', surfaces: ['composer']},
        },
        {
          tool_id: 'tool-link',
          slug: 'modula.tool.link',
          display_name: 'Link',
          availability: 'active',
          section: 'Create',
          manifest: {toolId: 'modula.tool.link', name: 'Link', surfaces: ['composer']},
        },
        {
          tool_id: 'tool-vault',
          slug: 'modula.tool.saveToVault',
          display_name: 'Save to Vault',
          availability: 'unavailable',
          section: 'Modules',
          requiresModule: 'Vault Notes',
          manifest: {
            toolId: 'modula.tool.saveToVault',
            name: 'Save to Vault',
            surfaces: ['composer'],
          },
        },
        {
          tool_id: 'tool-task',
          slug: 'modula.tool.createTask',
          display_name: 'Create Task',
          availability: 'unavailable',
          section: 'Modules',
          requiresModule: 'Tasks',
          manifest: {
            toolId: 'modula.tool.createTask',
            name: 'Create Task',
            surfaces: ['composer'],
          },
        },
        {
          tool_id: 'tool-automation',
          slug: 'modula.tool.automation',
          display_name: 'Automation',
          availability: 'preview',
          section: 'Automation',
          manifest: {toolId: 'modula.tool.automation', name: 'Automation', surfaces: ['composer']},
        },
        {
          tool_id: 'tool-ai',
          slug: 'modula.tool.aiAssist',
          display_name: 'AI Assist',
          availability: 'preview',
          section: 'AI',
          manifest: {toolId: 'modula.tool.aiAssist', name: 'AI Assist', surfaces: ['composer']},
        },
      ],
    },
    {
      method: 'GET',
      path: '/v1/extensions',
      handler: () => [
        {
          extension_id: 'ext-composer-media',
          slug: 'modula.extension.composerMedia',
          name: 'Composer Media',
          description: 'First-party photo and camera tools for Modula Composer.',
          publisher: 'Modula',
          version: '1.0.0',
          kind: 'tool',
          status: 'available',
          permissions: ['composer:attach'],
          compatibility: 'Modula 0.1+',
        },
        {
          extension_id: 'ext-vault-bridge',
          slug: 'modula.extension.vaultNotes',
          name: 'Vault Notes bridge',
          description: 'Requires the Vault Notes module (separate repository).',
          publisher: 'Modula',
          version: '0.1.0',
          kind: 'module',
          status: 'unavailable',
          permissions: ['module:vault'],
          compatibility: 'Requires Vault Notes',
        },
      ],
    },
    {
      method: 'GET',
      path: '/v1/extensions/installed',
      handler: () => [],
    },
    {
      method: 'GET',
      path: '/v1/extensions/:extensionId',
      handler: ({params}) => {
        const items = [
          {
            extension_id: 'ext-composer-media',
            slug: 'modula.extension.composerMedia',
            name: 'Composer Media',
            description: 'First-party photo and camera tools for Modula Composer.',
            publisher: 'Modula',
            version: '1.0.0',
            kind: 'tool',
            status: 'available',
            permissions: ['composer:attach'],
            compatibility: 'Modula 0.1+',
          },
        ]
        const match = items.find(
          item => item.slug === params.extensionId || item.extension_id === params.extensionId,
        )
        if (!match) {
          throw new ModulaApiError({
            message: 'Extension not found.',
            code: 'NOT_FOUND',
            status: 404,
            retryable: false,
          })
        }
        return match
      },
    },
    {
      method: 'GET',
      path: '/v1/functions',
      handler: () => [],
    },
    {
      method: 'GET',
      path: '/v1/plugins',
      handler: () => [
        {
          plugin_id: 'plugin-atproto',
          name: 'AT Protocol bridge',
          status: 'needs_configuration',
          description: 'Optional External Network under Settings → Connections.',
        },
      ],
    },
    {
      method: 'GET',
      path: '/v1/connectors',
      handler: () => [
        {connector_id: 'atproto', name: 'AT Protocol', status: 'optional'},
        {connector_id: 'github', name: 'GitHub', status: 'future'},
        {connector_id: 'drive', name: 'Drive', status: 'future'},
        {connector_id: 'nextcloud', name: 'Nextcloud', status: 'future'},
      ],
    },

    // —— Legacy Phase 4 routes (kept for local labs / verifier compatibility) ——
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
          return database.createSession({email, password})
        } catch {
          throw unauthenticated()
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
        const token =
          typeof body.refreshToken === 'string' ? parseRefreshToken(body.refreshToken) : null
        database.revokeSession(token)
        return {signedOut: true}
      },
    },
    {
      method: 'GET',
      path: '/v1/auth/session',
      handler: ({accessToken}) => requireSession({database, configuration, accessToken}),
    },
  ]
}
