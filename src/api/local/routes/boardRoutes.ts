import type {LocalApiDatabase} from '@/api/local/LocalApiDatabase'
import type {LocalApiRoute} from '@/api/local/LocalApiRouter'
import {bodyRecord, requireSession} from '@/api/local/routes/routeHelpers'

export function createBoardRoutes(database: LocalApiDatabase): LocalApiRoute[] {
  return [
    {
      method: 'GET',
      path: '/v1/board/layout',
      handler: ({accessToken, configuration}) => {
        const session = requireSession({database, configuration, accessToken})
        return database.getBoardLayout(session.account.id)
      },
    },
    {
      method: 'PATCH',
      path: '/v1/board/layout',
      handler: ({request, accessToken, configuration}) => {
        const session = requireSession({database, configuration, accessToken})
        return database.updateBoardLayout(session.account.id, bodyRecord(request.body))
      },
    },
  ]
}
