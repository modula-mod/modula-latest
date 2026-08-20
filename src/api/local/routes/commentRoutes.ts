import {parsePostId} from '@/api/contracts'
import type {LocalApiDatabase} from '@/api/local/LocalApiDatabase'
import type {LocalApiRoute} from '@/api/local/LocalApiRouter'
import type {SocialComment} from '@/domain/social'
import {bodyRecord, requireSession, requireString} from '@/api/local/routes/routeHelpers'

function dto(comment: SocialComment) {
  return {
    comment_id: comment.id,
    post_id: comment.postId,
    author_actor_id: comment.authorId,
    parent_comment_id: comment.parentCommentId,
    root_comment_id: comment.rootCommentId,
    text: comment.text,
    depth: comment.depth,
    reply_count: comment.replyCount,
    version: comment.version,
    created_at: comment.createdAt,
    updated_at: comment.updatedAt,
    deleted_at: comment.deletedAt,
  }
}

export function createCommentRoutes(database: LocalApiDatabase): LocalApiRoute[] {
  return [
    {
      method: 'GET',
      path: '/v1/posts/:postId/comments',
      handler: ({params}) => ({
        items: database.listComments(parsePostId(params.postId)).map(dto),
      }),
    },
    {
      method: 'POST',
      path: '/v1/posts/:postId/comments',
      handler: ({params, request, accessToken, configuration}) => {
        const session = requireSession({database, configuration, accessToken})
        const profile = database.getOwnerProfile(session.account.id)
        const body = bodyRecord(request.body)
        return dto(
          database.createComment(
            parsePostId(params.postId),
            profile.id,
            requireString(body.text, 'text'),
          ),
        )
      },
    },
    {
      method: 'GET',
      path: '/v1/comments/:commentId/replies',
      handler: ({params}) => ({items: database.listCommentReplies(params.commentId).map(dto)}),
    },
    {
      method: 'POST',
      path: '/v1/comments/:commentId/replies',
      handler: ({params, request, accessToken, configuration}) => {
        const session = requireSession({database, configuration, accessToken})
        const profile = database.getOwnerProfile(session.account.id)
        const body = bodyRecord(request.body)
        return dto(
          database.createCommentReply(
            params.commentId,
            profile.id,
            requireString(body.text, 'text'),
          ),
        )
      },
    },
  ]
}
