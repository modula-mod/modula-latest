import type {LocalApiDatabase} from '@/api/local/LocalApiDatabase'
import type {LocalApiRoute} from '@/api/local/LocalApiRouter'
import {bodyRecord, notFound, requireSession} from '@/api/local/routes/routeHelpers'
import type {CreateStoryInput} from '@/domain/stories'

export function createStoryRoutes(database: LocalApiDatabase): LocalApiRoute[] {
  return [
    {
      method: 'GET',
      path: '/v1/stories/rail',
      handler: ({accessToken, configuration}) => {
        let accountId = null as null | ReturnType<typeof requireSession>['account']['id']
        if (accessToken) {
          try {
            accountId = requireSession({database, configuration, accessToken}).account.id
          } catch {
            accountId = null
          }
        }
        return {items: database.listStoryRail(accountId)}
      },
    },
    {
      method: 'GET',
      path: '/v1/stories/:groupId',
      handler: ({params, accessToken, configuration}) => {
        let accountId = null as null | ReturnType<typeof requireSession>['account']['id']
        if (accessToken) {
          try {
            accountId = requireSession({database, configuration, accessToken}).account.id
          } catch {
            accountId = null
          }
        }
        const group = database.getStoryGroup(params.groupId, accountId)
        if (!group) return notFound('Story group not found.')
        return group
      },
    },
    {
      method: 'POST',
      path: '/v1/stories',
      handler: ({request, accessToken, configuration}) => {
        const session = requireSession({database, configuration, accessToken})
        const body = bodyRecord(request.body)
        const input: CreateStoryInput = {
          mediaKind: body.mediaKind === 'video' ? 'video' : 'image',
          base64: String(body.base64 ?? ''),
          contentType: String(body.contentType ?? 'image/jpeg'),
          caption: typeof body.caption === 'string' ? body.caption : null,
          visibility:
            body.visibility === 'public' || body.visibility === 'close'
              ? body.visibility
              : 'followers',
          durationMs: typeof body.durationMs === 'number' ? body.durationMs : undefined,
        }
        if (!input.base64) return notFound('Story media required.')
        return database.createStory(session.account.id, input)
      },
    },
    {
      method: 'POST',
      path: '/v1/stories/items/:itemId/viewed',
      handler: ({params, accessToken, configuration}) => {
        const session = requireSession({database, configuration, accessToken})
        database.markStoryViewed(session.account.id, params.itemId)
        return {ok: true}
      },
    },
    {
      method: 'DELETE',
      path: '/v1/stories/items/:itemId',
      handler: ({params, accessToken, configuration}) => {
        const session = requireSession({database, configuration, accessToken})
        database.deleteStoryItem(session.account.id, params.itemId)
        return {ok: true}
      },
    },
  ]
}
