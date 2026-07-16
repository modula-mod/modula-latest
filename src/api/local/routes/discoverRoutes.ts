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
      path: '/v1/reels',
      handler: () => database.getReels(),
    },
  ]
}
