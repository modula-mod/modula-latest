import type {AccountId, PostId, ProfileId} from '@/api/contracts'
import type {AtmosphereFeedMode} from '@modula/api-contracts'
import type {FeedMode} from '@/domain/social'

export const queryKeys = {
  stories: {
    rail: (accountId: string) => ['stories', 'rail', accountId] as const,
    group: (groupId: string) => ['stories', 'group', groupId] as const,
  },
  session: {
    all: ['session'] as const,
    current: () => ['session', 'current'] as const,
  },
  feed: {
    all: ['feed'] as const,
    home: (mode: FeedMode, accountId?: AccountId | 'guest' | 'signedOut') =>
      ['feed', 'home', mode, accountId ?? 'public'] as const,
    profile: (profileId: ProfileId) =>
      ['feed', 'profile', profileId] as const,
  },
  posts: {
    all: ['posts'] as const,
    detail: (postId: PostId) => ['posts', 'detail', postId] as const,
    saved: (accountId?: AccountId | 'guest' | 'signedOut') =>
      ['posts', 'saved', accountId ?? 'public'] as const,
  },
  comments: {
    all: ['comments'] as const,
    post: (postId: PostId) => ['comments', 'post', postId] as const,
    replies: (commentId: string) => ['comments', 'replies', commentId] as const,
  },
  profiles: {
    all: ['profiles'] as const,
    byHandle: (handle: string) => ['profiles', 'handle', handle] as const,
    followers: (handle: string) => ['profiles', handle, 'followers'] as const,
    following: (handle: string) => ['profiles', handle, 'following'] as const,
  },
  activity: {
    all: ['activity'] as const,
    pages: (accountId?: AccountId | 'guest' | 'signedOut') =>
      ['activity', 'pages', accountId ?? 'public'] as const,
  },
  discover: {
    all: ['discover'] as const,
    search: (q: string, type: string, limit: number) =>
      ['discover', 'search', q, type, limit] as const,
  },
  search: {
    results: (q: string, type: string, limit: number) =>
      ['search', 'results', q, type, limit] as const,
    recent: (accountId?: AccountId | 'guest' | 'signedOut') =>
      ['search', 'recent', accountId ?? 'public'] as const,
    saved: (accountId?: AccountId | 'guest' | 'signedOut') =>
      ['search', 'saved', accountId ?? 'public'] as const,
  },
  reels: {
    all: ['reels'] as const,
  },
  metadata: {
    all: ['metadata'] as const,
    current: () => ['metadata', 'current'] as const,
  },
  atproto: {
    all: ['atproto'] as const,
    connections: (accountId?: AccountId | 'guest' | 'signedOut') =>
      ['atproto', 'connections', accountId ?? 'public'] as const,
    connection: (connectionId: string) => ['atproto', 'connection', connectionId] as const,
    preferences: (accountId?: AccountId | 'guest' | 'signedOut') =>
      ['atproto', 'preferences', accountId ?? 'public'] as const,
    atmosphere: (mode: AtmosphereFeedMode) => ['atproto', 'atmosphere', mode] as const,
  },
}
