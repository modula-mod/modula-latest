import {parseProfileId} from '@/api/contracts'
import type {LocalApiDatabase} from '@/api/local/LocalApiDatabase'
import type {LocalApiRoute} from '@/api/local/LocalApiRouter'
import type {FeedMode} from '@/domain/social'
import {limit, optionalCursor} from '@/api/local/routes/routeHelpers'

function feedMode(value: unknown): FeedMode {
  if (value === 'forYou' || value === 'modules' || value === 'following') return value
  return 'following'
}

export function createFeedRoutes(database: LocalApiDatabase): LocalApiRoute[] {
  return [
    {
      method: 'GET',
      path: '/v1/feed/home',
      handler: ({request}) =>
        database.listFeed({
          mode: feedMode(request.query?.mode),
          cursor: optionalCursor(request.query?.cursor),
          limit: limit(request.query?.limit),
        }),
    },
    {
      method: 'GET',
      path: '/v1/feed/profile/:profileId',
      handler: ({params, request}) =>
        database.listProfilePosts({
          profileId: parseProfileId(params.profileId),
          cursor: optionalCursor(request.query?.cursor),
          limit: limit(request.query?.limit),
        }),
    },
  ]
}
