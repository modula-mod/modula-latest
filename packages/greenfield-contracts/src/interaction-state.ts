import type {GreenfieldReactionType} from './reaction.js'

/**
 * Viewer-specific interaction flags for a post.
 * Counts remain on `GreenfieldSocialCounts`; this is only the viewer's state.
 */
export type GreenfieldInteractionState = {
  reaction: GreenfieldReactionType | null
  saved: boolean
  reposted: boolean
  quoted: boolean
  followingAuthor: boolean
  mutedAuthor: boolean
  blockedAuthor: boolean
}
