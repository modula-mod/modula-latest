import {ModulaApiError} from '@/api/contracts/ApiError'
import type {LocalApiRoute} from '@/api/local/LocalApiRouter'
import {bodyRecord, requireSession} from '@/api/local/routes/routeHelpers'

/**
 * Local AT Protocol stubs — capabilities remain disabled in /v1/meta for local.
 * Routes exist so remote-shaped clients fail closed with CAPABILITY_DISABLED rather
 * than opaque 404s if accidentally called.
 */
export function createAtprotoRoutes(): LocalApiRoute[] {
  const disabled = () => {
    throw new ModulaApiError({
      message: 'AT Protocol is unavailable in the local data source.',
      code: 'CAPABILITY_DISABLED',
      status: 403,
      retryable: false,
    })
  }

  return [
    {
      method: 'GET',
      path: '/v1/atproto/connections',
      handler: ({database, configuration, accessToken}) => {
        requireSession({database, configuration, accessToken})
        disabled()
      },
    },
    {
      method: 'POST',
      path: '/v1/atproto/oauth/start',
      handler: ({database, configuration, accessToken}) => {
        requireSession({database, configuration, accessToken})
        disabled()
      },
    },
    {
      method: 'GET',
      path: '/v1/atproto/oauth/callback',
      handler: ({database, configuration, accessToken}) => {
        requireSession({database, configuration, accessToken})
        disabled()
      },
    },
    {
      method: 'POST',
      path: '/v1/atproto/connections/:connectionId/disconnect',
      handler: ({database, configuration, accessToken}) => {
        requireSession({database, configuration, accessToken})
        disabled()
      },
    },
    {
      method: 'POST',
      path: '/v1/atproto/connections/:connectionId/refresh',
      handler: ({database, configuration, accessToken}) => {
        requireSession({database, configuration, accessToken})
        disabled()
      },
    },
    {
      method: 'GET',
      path: '/v1/atproto/connections/:connectionId/status',
      handler: ({database, configuration, accessToken}) => {
        requireSession({database, configuration, accessToken})
        disabled()
      },
    },
    {
      method: 'GET',
      path: '/v1/atproto/preferences',
      handler: ({database, configuration, accessToken}) => {
        requireSession({database, configuration, accessToken})
        disabled()
      },
    },
    {
      method: 'PATCH',
      path: '/v1/atproto/preferences',
      handler: ({database, configuration, accessToken, request}) => {
        requireSession({database, configuration, accessToken})
        bodyRecord(request.body)
        disabled()
      },
    },
    {
      method: 'GET',
      path: '/v1/atproto/feed',
      handler: () => ({
        label: 'Atmosphere Preview',
        mode: 'modula-network' as const,
        items: [],
      }),
    },
  ]
}
