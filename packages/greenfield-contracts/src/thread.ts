import type {GreenfieldComment} from './comment.js'
import type {GreenfieldPost} from './post.js'

export type GreenfieldCommentNode = {
  comment: GreenfieldComment
  replies: GreenfieldCommentNode[]
}

/**
 * Post detail thread payload.
 * Supports initial top-level comments, paginated/lazy replies,
 * deleted-comment placeholders, and block/mute filtering on the server.
 */
export type GreenfieldThread = {
  post: GreenfieldPost
  comments: GreenfieldCommentNode[]
  nextCursor: string | null
}

export type GreenfieldCommentRepliesPage = {
  commentId: string
  replies: GreenfieldCommentNode[]
  nextCursor: string | null
}
