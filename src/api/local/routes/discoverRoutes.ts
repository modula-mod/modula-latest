import type {LocalApiDatabase} from '@/api/local/LocalApiDatabase'
import type {LocalApiRoute} from '@/api/local/LocalApiRouter'

export function createDiscoverRoutes(database: LocalApiDatabase): LocalApiRoute[] {
  return [
    {
      method: 'GET',
      path: '/v1/discover',
      handler: () => database.getDiscover(),
    },
    {
      method: 'GET',
      path: '/v1/search',
      handler: ({request}) => {
        const query = request.query ?? {}
        const type =
          query.type === 'profiles' ||
          query.type === 'posts' ||
          query.type === 'modules' ||
          query.type === 'all'
            ? query.type
            : 'all'
        return database.search({
          q: String(query.q ?? ''),
          type,
          cursor: typeof query.cursor === 'string' ? query.cursor : null,
          limit: Number(query.limit ?? 20),
        })
      },
    },
    {
      method: 'GET',
      path: '/v1/reels',
      handler: () => database.getReels(),
    },
  ]
}
