export type StoryRingState =
  | 'unviewed'
  | 'partial'
  | 'viewed'
  | 'owner'
  | 'uploading'
  | 'failed'

export type StoryRailEntry = {
  groupId: string
  ownerActorId: string
  ownerProfileId: string
  displayName: string
  handle: string
  avatarUrl: string | null
  ringState: StoryRingState
  itemCount: number
  unviewedCount: number
  expiresAt: string
  isOwner: boolean
}

export type StoryItem = {
  itemId: string
  groupId: string
  mediaKind: 'image' | 'video'
  mediaUrl: string | null
  caption: string | null
  status: 'uploading' | 'ready' | 'failed'
  durationMs: number | null
  viewed: boolean
  createdAt: string
}

export type StoryGroup = {
  groupId: string
  ownerActorId: string
  ownerProfileId: string
  displayName: string
  handle: string
  avatarUrl: string | null
  visibility: 'public' | 'followers' | 'close'
  expiresAt: string
  items: StoryItem[]
  isOwner: boolean
}

export type CreateStoryInput = {
  mediaKind: 'image' | 'video'
  base64: string
  contentType: string
  caption?: string | null
  visibility?: 'public' | 'followers' | 'close'
  durationMs?: number
}
