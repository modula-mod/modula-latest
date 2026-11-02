import type {ModulaProfileDto} from './profiles.js'
import type {CreatePostContentInput, CreatePostMediaInput, SocialPostDto} from './posts.js'

export type CommunityVisibility = 'public' | 'private'
export type CommunityMembershipPolicy = 'open' | 'approval'
export type CommunityPostingPolicy = 'members' | 'moderators'
export type CommunityRole = 'owner' | 'admin' | 'moderator' | 'member' | 'restricted'
export type CommunityMembershipStatus = 'active' | 'pending' | 'banned' | 'left'
export type CommunityViewerMembership = 'none' | 'pending' | 'active' | 'banned'

export type CommunityArtworkDto = {
  iconAttachmentId: string | null
  iconUrl: string | null
  coverAttachmentId: string | null
  coverUrl: string | null
}

export type CommunitySummaryDto = {
  id: string
  slug: string
  name: string
  description: string
  category: string
  visibility: CommunityVisibility
  discoverable: boolean
  featured: boolean
  memberCount: number
  membership: CommunityViewerMembership
  viewerRole: CommunityRole | null
  recentActivityAt: string
  artwork: CommunityArtworkDto
  version: number
}

export type CommunityDto = CommunitySummaryDto & {
  ownerActorId: string
  membershipPolicy: CommunityMembershipPolicy
  postingPolicy: CommunityPostingPolicy
  createdAt: string
  updatedAt: string
}

export type CommunityMemberDto = {
  communityId: string
  actorId: string
  role: CommunityRole
  status: CommunityMembershipStatus
  joinedAt: string | null
  profile: ModulaProfileDto
}

export type CommunitySettingsDto = {
  communityId: string
  canManage: boolean
  membershipPolicy: CommunityMembershipPolicy
  postingPolicy: CommunityPostingPolicy
  inviteLinksEnabled: boolean
  allowAttachments: boolean
  reactionsEnabled: boolean
  featuredPostsEnabled: boolean
  blockedWords: string[] | null
  notificationPreferences: {
    notifyMentions: boolean
    weeklyDigest: boolean
    eventReminders: boolean
  }
  version: number
  updatedAt: string
}

export type CommunityPostDto = {
  communityId: string
  moderationState: 'visible' | 'hidden' | 'removed'
  featuredAt: string | null
  post: SocialPostDto
}

export type CreateCommunityPostInput = {
  text: string
  media?: CreatePostMediaInput[]
  content?: CreatePostContentInput[]
  idempotencyKey?: string
}

export type CommunityEventResponse = 'going' | 'interested'
export type CommunityEventStatus = 'scheduled' | 'cancelled'
export type CommunityEventLocationType = 'online' | 'inPerson' | 'tba'

export type CommunityEventDto = {
  id: string
  communityId: string
  creatorActorId: string
  title: string
  description: string
  startsAt: string
  endsAt: string
  timezone: string
  location: {
    type: CommunityEventLocationType
    name: string | null
    onlineUrl: string | null
  }
  coverAttachmentId: string | null
  coverUrl: string | null
  capacity: number | null
  status: CommunityEventStatus
  goingCount: number
  interestedCount: number
  viewerResponse: CommunityEventResponse | null
  version: number
  createdAt: string
  updatedAt: string
}

export type CommunityPollResultsVisibility = 'always' | 'afterVote' | 'afterClose'
export type CommunityPollStatus = 'open' | 'cancelled'

export type CommunityPollOptionDto = {
  id: string
  position: number
  text: string
  voteCount: number | null
}

export type CommunityPollDto = {
  id: string
  communityId: string
  creatorActorId: string
  question: string
  options: CommunityPollOptionDto[]
  closesAt: string
  allowVoteChanges: boolean
  resultsVisibility: CommunityPollResultsVisibility
  status: CommunityPollStatus
  closed: boolean
  viewerOptionId: string | null
  totalVotes: number | null
  version: number
  createdAt: string
  updatedAt: string
}
