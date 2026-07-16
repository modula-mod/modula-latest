import type {LocalApiDatabase} from '@/api/local/LocalApiDatabase'
import type {LocalApiRoute} from '@/api/local/LocalApiRouter'
import {limit, optionalCursor} from '@/api/local/routes/routeHelpers'

export function createActivityRoutes(database: LocalApiDatabase): LocalApiRoute[] {
  return [
    {
      method: 'GET',
      path: '/v1/activity',
      handler: ({request}) =>
        database.listActivity({
          cursor: optionalCursor(request.query?.cursor),
          limit: limit(request.query?.limit),
        }),
    },
  ]
}
