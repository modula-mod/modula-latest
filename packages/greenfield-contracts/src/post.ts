import type {GreenfieldSocialCounts} from './social-counts.js'
import type {GreenfieldInteractionState} from './interaction-state.js'
import type {GreenfieldReactionSummary} from './reaction.js'

/**
 * Minimal post surface for thread / quote / feed contracts.
 * Full feed DTOs may extend this with media and author profiles.
 */
export type GreenfieldPostVisibility =
  | 'public'
  | 'followers'
  | 'private'
  | 'unavailable'

export type GreenfieldPost = {
  postId: string
  authorActorId: string
  text: string
  visibility: GreenfieldPostVisibility
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  version: number
  counts: GreenfieldSocialCounts
  reactionSummary: GreenfieldReactionSummary
  viewerState: GreenfieldInteractionState
  quotedPostId: string | null
  repostOfPostId: string | null
}
