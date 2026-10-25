export type ProfileKind =
  | 'person'
  | 'creator'
  | 'professional'
  | 'organisation'
  | 'team'

export type ProfileVisibility = 'public' | 'followers' | 'teams' | 'private'

export type ProfileFocusStatus = {
  id: string
  label: string
  message: string
  updatedAt: string
}

export type ProfileLink = {
  id: string
  label: string
  url: string
  domain: string
  visibility: ProfileVisibility
}

export type ProfileLocation = {
  label: string
  visibility: ProfileVisibility
}

export type ModulaProfileDto = {
  id: string
  handle: string
  displayName: string
  kind: ProfileKind
  avatarUri?: string
  coverUri?: string
  coverColour?: string
  bio: string
  pronouns?: string
  location?: ProfileLocation
  website?: ProfileLink
  followerCount: number
  followingCount: number
  moduleCount: number
  postCount: number
  joinedAt: string
  focusStatus: ProfileFocusStatus
  identityClaims: Array<Record<string, unknown>>
  links: ProfileLink[]
  featuredModuleIds: string[]
  visibility: ProfileVisibility
  isFollowing: boolean
  followsViewer: boolean
  version?: number
  /** Modula Premium tier while entitled (active or grace); null for Core. */
  premiumTier?: 'plus' | 'horizon' | 'horizon_plus' | 'studio' | null
  /** Premium tenure start, never reset. Null unless premiumTier is set. */
  premiumSince?: string | null
  /** Verification mark, independent of billing and never purchasable. */
  verifiedType?: 'person' | 'organisation' | 'official' | null
  /** verifiedType !== null. */
  isVerified?: boolean
}

/**
 * Actor identity and ownership fields are never accepted here — the profile
 * to patch is always resolved from the authenticated session.
 */
export type PatchProfileInput = {
  displayName?: string
  bio?: string
  pronouns?: string
  avatarUri?: string
  coverUri?: string
  coverColour?: string
  location?: ProfileLocation
  website?: {label: string; url: string; domain: string; visibility: ProfileVisibility}
  visibility?: ProfileVisibility
  focusStatus?: {id: string; label: string; message: string}
  expectedVersion: number
}
