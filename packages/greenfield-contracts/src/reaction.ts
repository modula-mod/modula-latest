/**
 * Multi-reaction contract for Greenfield posts and comments.
 *
 * Rules:
 * - one active reaction per actor/post (or actor/comment)
 * - changing reaction updates the existing row atomically
 * - selecting the current reaction removes it
 * - counters are server-authoritative
 * - duplicate requests remain idempotent
 */
export type GreenfieldReactionType =
  | 'like'
  | 'celebrate'
  | 'insightful'
  | 'support'
  | 'curious'

export type GreenfieldReaction = {
  reactionId: string
  actorId: string
  postId: string
  type: GreenfieldReactionType
  createdAt: string
}

export type GreenfieldCommentReaction = {
  reactionId: string
  actorId: string
  commentId: string
  type: GreenfieldReactionType
  createdAt: string
}

export type GreenfieldReactionSummary = {
  total: number
  viewerReaction: GreenfieldReactionType | null
  byType: Partial<Record<GreenfieldReactionType, number>>
}

export const GREENFIELD_REACTION_TYPES: readonly GreenfieldReactionType[] = [
  'like',
  'celebrate',
  'insightful',
  'support',
  'curious',
] as const
