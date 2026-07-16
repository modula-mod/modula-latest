import {parsePostId} from '@/api/contracts'
import {ModulaApiError} from '@/api/contracts/ApiError'
import type {LocalApiDatabase} from '@/api/local/LocalApiDatabase'
import type {LocalApiRoute} from '@/api/local/LocalApiRouter'
import type {CreatePostInput} from '@/domain/social'
import {bodyRecord, limit, notFound, optionalCursor, requireSession} from '@/api/local/routes/routeHelpers'

function decodeCreatePost(value: unknown): CreatePostInput {
  const body = bodyRecord(value)
  if (typeof body.idempotencyKey !== 'string') {
    throw new ModulaApiError({
      message: 'A post idempotency key is required.',
      code: 'VALIDATION_FAILED',
      status: 400,
      retryable: false,
    })
  }
  return {
    text: typeof body.text === 'string' ? body.text : '',
    audience: body.audience === 'followers' ? 'followers' : 'public',
    replyPermission:
      body.replyPermission === 'followers' || body.replyPermission === 'mentioned'
        ? body.replyPermission
        : 'everyone',
    media: Array.isArray(body.media) ? body.media as CreatePostInput['media'] : [],
    linkPreview:
      body.linkPreview && typeof body.linkPreview === 'object'
        ? body.linkPreview as CreatePostInput['linkPreview']
        : undefined,
    poll: body.poll && typeof body.poll === 'object' ? body.poll as CreatePostInput['poll'] : undefined,
    idempotencyKey: body.idempotencyKey,
  }
}

export function createPostRoutes(database: LocalApiDatabase): LocalApiRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/posts',
      handler: ({request, accessToken, configuration}) => {
        requireSession({database, configuration, accessToken})
        const input = decodeCreatePost(request.body)
        if (!input.text.trim() && !input.media.length && !input.linkPreview && !input.poll) {
          throw new ModulaApiError({
            message: 'Add text, media, a link, or a poll before posting.',
            code: 'VALIDATION_FAILED',
            status: 400,
            retryable: false,
          })
        }
        return database.createPost(input)
      },
    },
    {
      method: 'GET',
      path: '/v1/posts/saved',
      handler: ({request}) =>
        database.listSavedPosts({
          cursor: optionalCursor(request.query?.cursor),
          limit: limit(request.query?.limit),
        }),
    },
    {
      method: 'GET',
      path: '/v1/posts/:postId',
      handler: ({params}) => database.getPost(parsePostId(params.postId)) ?? notFound('Post not found.'),
    },
    {
      method: 'POST',
      path: '/v1/posts/:postId/like',
      handler: ({params, accessToken, configuration}) => {
        requireSession({database, configuration, accessToken})
        return database.toggleLike(parsePostId(params.postId), true)
      },
    },
    {
      method: 'DELETE',
      path: '/v1/posts/:postId/like',
      handler: ({params, accessToken, configuration}) => {
        requireSession({database, configuration, accessToken})
        return database.toggleLike(parsePostId(params.postId), false)
      },
    },
    {
      method: 'POST',
      path: '/v1/posts/:postId/save',
      handler: ({params, accessToken, configuration}) => {
        requireSession({database, configuration, accessToken})
        return database.toggleSave(parsePostId(params.postId), true)
      },
    },
    {
      method: 'DELETE',
      path: '/v1/posts/:postId/save',
      handler: ({params, accessToken, configuration}) => {
        requireSession({database, configuration, accessToken})
        return database.toggleSave(parsePostId(params.postId), false)
      },
    },
    {
      method: 'POST',
      path: '/v1/posts/:postId/repost',
      handler: ({params, accessToken, configuration}) => {
        requireSession({database, configuration, accessToken})
        return database.toggleRepost(parsePostId(params.postId), true)
      },
    },
    {
      method: 'DELETE',
      path: '/v1/posts/:postId/repost',
      handler: ({params, accessToken, configuration}) => {
        requireSession({database, configuration, accessToken})
        return database.toggleRepost(parsePostId(params.postId), false)
      },
    },
  ]
}
