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
  isFollowing: boolean
  followsViewer: boolean
}
