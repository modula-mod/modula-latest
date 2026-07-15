export type SocialAccountId = string
export type SocialPostId = string

export type SocialProfile = {
  id: SocialAccountId
  handle: string
  displayName: string
  avatarUrl?: string
}

export type SocialPost = {
  id: SocialPostId
  author: SocialProfile
  text: string
  createdAt: string
}

export type FeedRequest = {
  cursor?: string
  limit?: number
}

export type FeedResult = {
  posts: SocialPost[]
  cursor?: string
}

export interface SocialProvider {
  getFeed(request: FeedRequest): Promise<FeedResult>
  getProfile(identifier: string): Promise<SocialProfile>
  createPost(input: {text: string}): Promise<SocialPost>
  follow(accountId: SocialAccountId): Promise<void>
  unfollow(accountId: SocialAccountId): Promise<void>
}
