/**
 * Aggregate social counters for a post.
 * `saveCount` should generally remain private or omitted from public APIs.
 */
export type GreenfieldSocialCounts = {
  reactionCount: number
  commentCount: number
  repostCount: number
  quoteCount: number
  /** Private to the viewer / account analytics — omit from public payloads by default. */
  saveCount?: number
  viewCount?: number
}
