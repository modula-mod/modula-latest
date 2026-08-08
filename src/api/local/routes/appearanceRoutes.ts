import type {LocalApiDatabase} from '@/api/local/LocalApiDatabase'
import type {LocalApiRoute} from '@/api/local/LocalApiRouter'
import {bodyRecord, requireSession} from '@/api/local/routes/routeHelpers'

export function createAppearanceRoutes(database: LocalApiDatabase): LocalApiRoute[] {
  return [
    {
      method: 'GET',
      path: '/v1/accounts/me/appearance',
      handler: ({accessToken, configuration}) => {
        const session = requireSession({database, configuration, accessToken})
        return database.getAppearancePreferences(session.account.id)
      },
    },
    {
      method: 'PATCH',
      path: '/v1/accounts/me/appearance',
      handler: ({request, accessToken, configuration}) => {
        const session = requireSession({database, configuration, accessToken})
        return database.updateAppearancePreferences(
          session.account.id,
          bodyRecord(request.body),
        )
      },
    },
  ]
}
