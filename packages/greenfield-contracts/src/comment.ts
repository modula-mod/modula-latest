import type {GreenfieldReactionSummary} from './reaction.js'

/**
 * Threaded comment on a Greenfield post.
 * Maximum supported depth is 4; deeper replies flatten into the nearest level.
 */
export const GREENFIELD_COMMENT_MAX_DEPTH = 4

export type GreenfieldComment = {
  commentId: string
  postId: string
  authorActorId: string
  parentCommentId: string | null
  rootCommentId: string | null
  text: string
  depth: number
  replyCount: number
  reactionSummary: GreenfieldReactionSummary
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  version: number
}

export type GreenfieldCommentCreateInput = {
  text: string
  parentCommentId?: string | null
  idempotencyKey: string
}

export type GreenfieldCommentUpdateInput = {
  text: string
  expectedVersion: number
}
