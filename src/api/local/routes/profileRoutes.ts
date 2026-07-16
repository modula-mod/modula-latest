import {parseProfileId} from '@/api/contracts'
import type {LocalApiDatabase} from '@/api/local/LocalApiDatabase'
import type {LocalApiRoute} from '@/api/local/LocalApiRouter'
import type {UpdateProfileInput} from '@/features/profile/contracts'
import {bodyRecord, limit, notFound, optionalCursor, requireSession} from '@/api/local/routes/routeHelpers'

export function createProfileRoutes(database: LocalApiDatabase): LocalApiRoute[] {
  return [
    {
      method: 'GET',
      path: '/v1/profiles/:handle',
      handler: ({params}) => database.getProfileByHandle(params.handle) ?? notFound('Profile not found.'),
    },
    {
      method: 'PATCH',
      path: '/v1/profiles/me',
      handler: ({request, accessToken, configuration}) => {
        requireSession({database, configuration, accessToken})
        return database.updateOwnerProfile(bodyRecord(request.body) as UpdateProfileInput)
      },
    },
    {
      method: 'GET',
      path: '/v1/profiles/:handle/followers',
      handler: ({params, request}) =>
        database.listFollowers({
          handle: params.handle,
          cursor: optionalCursor(request.query?.cursor),
          limit: limit(request.query?.limit),
        }),
    },
    {
      method: 'GET',
      path: '/v1/profiles/:handle/following',
      handler: ({params, request}) =>
        database.listFollowing({
          handle: params.handle,
          cursor: optionalCursor(request.query?.cursor),
          limit: limit(request.query?.limit),
        }),
    },
    {
      method: 'POST',
      path: '/v1/profiles/:profileId/follow',
      handler: ({params, accessToken, configuration}) => {
        requireSession({database, configuration, accessToken})
        return database.followProfile(parseProfileId(params.profileId))
      },
    },
    {
      method: 'DELETE',
      path: '/v1/profiles/:profileId/follow',
      handler: ({params, accessToken, configuration}) => {
        requireSession({database, configuration, accessToken})
        return database.unfollowProfile(parseProfileId(params.profileId))
      },
    },
  ]
}
