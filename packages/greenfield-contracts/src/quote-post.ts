import type {GreenfieldPostVisibility} from './post.js'

/**
 * A quote is a new Greenfield post that references another post.
 * When the quoted post is unavailable or private to the viewer, clients must
 * render "This post is no longer available." and must not expose private body.
 */
export type GreenfieldQuotePost = {
  postId: string
  quotedPostId: string
  commentary: string
  createdAt: string
}

export type GreenfieldQuotedPostPreview = {
  postId: string
  authorActorId: string | null
  authorHandle: string | null
  authorDisplayName: string | null
  shortBody: string | null
  mediaPreviewUrl: string | null
  visibility: GreenfieldPostVisibility
  deletedAt: string | null
  available: boolean
}

export type GreenfieldQuotePostCreateInput = {
  commentary: string
  idempotencyKey: string
}
