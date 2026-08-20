import type {IdentityClaim} from '@/features/profile/contracts/identity'
import type {FocusStatus} from '@/features/profile/contracts/presence'

export type ProfileId = string
export type ProfileHandle = string

export type ProfileVisibility =
  | 'public'
  | 'followers'
  | 'teams'
  | 'private'

/** Product-default profile visibility until a profile-level field exists. */
export const DEFAULT_PROFILE_VISIBILITY: ProfileVisibility = 'public'

export const PROFILE_VISIBILITY_LABELS: Record<ProfileVisibility, string> = {
  public: 'Public',
  followers: 'Followers',
  teams: 'Teams',
  private: 'Private',
}

export type ProfileKind =
  | 'person'
  | 'creator'
  | 'professional'
  | 'organisation'
  | 'team'

export type ProfileLayoutId =
  | 'social'
  | 'creator'
  | 'professional'
  | 'minimal'

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

export type ModulaProfile = {
  id: ProfileId
  handle: ProfileHandle
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
  focusStatus: FocusStatus
  identityClaims: IdentityClaim[]
  links: ProfileLink[]
  featuredModuleIds: string[]
  isFollowing: boolean
  followsViewer: boolean
}

export type ProfileScreenMode =
  | 'owner'
  | 'public'
  | 'preview'

export type ProfileViewerRelationship =
  | 'owner'
  | 'follower'
  | 'following'
  | 'mutual'
  | 'visitor'

export type ProfileViewerContext = {
  mode: ProfileScreenMode
  relationship: ProfileViewerRelationship
  canEdit: boolean
  canCustomize: boolean
  canMessage: boolean
  canFollow: boolean
  canViewPrivateControls: boolean
}

export type UpdateProfileInput = {
  avatarUri?: string | null
  coverUri?: string | null
  displayName?: string
  handle?: string
  bio?: string
  pronouns?: string
  location?: ProfileLocation | null
  website?: ProfileLink | null
  focusStatus?: FocusStatus
}

export type ProfilePresentationPreferences = {
  schemaVersion: 1
  layoutId: ProfileLayoutId
  enabledTabIds: string[]
  tabOrder: string[]
  defaultTabId: string
  showFocusHalo: boolean
  showModuleCount: boolean
  showFollowerCount: boolean
  /** System metric ids in display order. Unknown ids are ignored. */
  orderedMetricIds: string[]
  /** Metrics omitted from the picker. Owner customize still lists them. */
  hiddenMetricIds: string[]
  /** Initially selected metric. Must be visible. */
  defaultMetricId: string
}

export const DEFAULT_PROFILE_PRESENTATION: ProfilePresentationPreferences = {
  schemaVersion: 1,
  layoutId: 'social',
  enabledTabIds: [
    'posts',
    'media',
    'about',
    'modules',
    'links',
  ],
  tabOrder: [
    'posts',
    'media',
    'about',
    'modules',
    'links',
    'shop',
    'agents',
  ],
  defaultTabId: 'posts',
  showFocusHalo: true,
  showModuleCount: true,
  showFollowerCount: true,
  orderedMetricIds: ['posts', 'followers', 'following', 'modules'],
  hiddenMetricIds: [],
  defaultMetricId: 'posts',
}

export function canViewerSeeProfileField(
  visibility: ProfileVisibility,
  viewerRelationship: ProfileViewerRelationship,
): boolean {
  if (visibility === 'public') return true
  if (visibility === 'private') return viewerRelationship === 'owner'
  if (visibility === 'teams') return viewerRelationship === 'owner'
  return (
    viewerRelationship === 'owner' ||
    viewerRelationship === 'follower' ||
    viewerRelationship === 'mutual'
  )
}

export function createViewerContext(
  mode: ProfileScreenMode,
  relationship: ProfileViewerRelationship,
): ProfileViewerContext {
  const isOwner = mode === 'owner' && relationship === 'owner'
  const isPreview = mode === 'preview'
  return {
    mode,
    relationship,
    canEdit: isOwner,
    canCustomize: isOwner,
    canMessage: !isOwner && !isPreview,
    canFollow: !isOwner && !isPreview,
    canViewPrivateControls: isOwner,
  }
}
