import type {LocalApiDatabase} from '@/api/local/LocalApiDatabase'
import type {LocalApiRoute} from '@/api/local/LocalApiRouter'
import {bodyRecord, requireSession} from '@/api/local/routes/routeHelpers'

export function createNotificationRoutes(database: LocalApiDatabase): LocalApiRoute[] {
  return [
    {
      method: 'GET',
      path: '/v1/accounts/me/notification-preferences',
      handler: ({accessToken, configuration}) => {
        const session = requireSession({database, configuration, accessToken})
        return database.getNotificationPreferences(session.account.id)
      },
    },
    {
      method: 'PATCH',
      path: '/v1/accounts/me/notification-preferences',
      handler: ({request, accessToken, configuration}) => {
        const session = requireSession({database, configuration, accessToken})
        return database.updateNotificationPreferences(
          session.account.id,
          bodyRecord(request.body),
        )
      },
    },
  ]
}
