import type {AccountId, PostId, ProfileId} from '@/api/contracts'
import type {FeedMode} from '@/domain/social'

export const queryKeys = {
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
  },
  reels: {
    all: ['reels'] as const,
  },
}
