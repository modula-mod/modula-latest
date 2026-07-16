import type {
  FeedRequest,
  FeedResult,
  SocialAccountId,
  SocialPost,
  SocialProfile,
  SocialProvider,
} from '@/social/contracts/SocialProvider'

const NOW = Date.now()

const profiles: Record<string, SocialProfile> = {
  'user-modula': {
    id: 'user-modula',
    handle: 'modula.digital',
    displayName: 'Modula',
  },
  'user-ada': {
    id: 'user-ada',
    handle: 'ada.design',
    displayName: 'Ada Chen',
  },
  'user-leo': {
    id: 'user-leo',
    handle: 'leo.build',
    displayName: 'Leo Martins',
  },
  'user-mira': {
    id: 'user-mira',
    handle: 'mira.notes',
    displayName: 'Mira Okonkwo',
  },
}

let posts: SocialPost[] = [
  {
    id: 'post-1',
    author: profiles['user-modula'],
    text: 'Welcome to Modula — one identity, one environment, infinite configurations.',
    createdAt: new Date(NOW - 1000 * 60 * 12).toISOString(),
  },
  {
    id: 'post-2',
    author: profiles['user-ada'],
    text: 'Board cards should feel like a personal OS surface, not an admin dashboard.',
    createdAt: new Date(NOW - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'post-3',
    author: profiles['user-leo'],
    text: 'Media glows. Text breathes. Links contain. — post presentation principle.',
    createdAt: new Date(NOW - 1000 * 60 * 90).toISOString(),
  },
  {
    id: 'post-4',
    author: profiles['user-mira'],
    text: 'Modules register settings through manifests. The host stays launchable with zero modules installed.',
    createdAt: new Date(NOW - 1000 * 60 * 180).toISOString(),
  },
  {
    id: 'post-5',
    author: profiles['user-ada'],
    text: 'Exploring discovery patterns without pulling AT Protocol into the UI layer.',
    createdAt: new Date(NOW - 1000 * 60 * 240).toISOString(),
  },
  {
    id: 'post-6',
    author: profiles['user-leo'],
    text: 'Settings IA should feel complete even when actions are stubs — navigable Account, Privacy, Moderation.',
    createdAt: new Date(NOW - 1000 * 60 * 300).toISOString(),
  },
]

const follows = new Set<SocialAccountId>()

function delay<T>(value: T, ms = 16): Promise<T> {
  return new Promise(resolve => {
    setTimeout(() => resolve(value), ms)
  })
}

/**
 * In-memory SocialProvider for Phase 1 shell.
 * Sync-local mock data — no network required for first frame.
 */
export class DevelopmentSocialProvider implements SocialProvider {
  async getFeed(request: FeedRequest): Promise<FeedResult> {
    const limit = request.limit ?? 20
    const start = request.cursor ? Number(request.cursor) : 0
    const slice = posts.slice(start, start + limit)
    const next = start + limit
    return delay({
      posts: slice,
      cursor: next < posts.length ? String(next) : undefined,
    })
  }

  async getProfile(identifier: string): Promise<SocialProfile> {
    const byId = profiles[identifier]
    if (byId) return delay(byId)
    const byHandle = Object.values(profiles).find(p => p.handle === identifier)
    if (byHandle) return delay(byHandle)
    return delay({
      id: 'unknown',
      handle: identifier,
      displayName: identifier,
    })
  }

  async createPost(input: {text: string}): Promise<SocialPost> {
    const post: SocialPost = {
      id: `post-${Date.now()}`,
      author: profiles['user-modula'],
      text: input.text,
      createdAt: new Date().toISOString(),
    }
    posts = [post, ...posts]
    return delay(post)
  }

  async follow(accountId: SocialAccountId): Promise<void> {
    follows.add(accountId)
    return delay(undefined)
  }

  async unfollow(accountId: SocialAccountId): Promise<void> {
    follows.delete(accountId)
    return delay(undefined)
  }
}

export const developmentSocialProvider = new DevelopmentSocialProvider()

export const MOCK_TOPICS = [
  {id: 'topic-os', label: 'Social OS'},
  {id: 'topic-modules', label: 'Modules'},
  {id: 'topic-design', label: 'Appearance'},
  {id: 'topic-board', label: 'Board layouts'},
  {id: 'topic-privacy', label: 'Privacy'},
] as const

export const MOCK_SUGGESTED_ACCOUNTS: SocialProfile[] = [
  profiles['user-ada'],
  profiles['user-leo'],
  profiles['user-mira'],
]

export type MockNotification = {
  id: string
  actor: SocialProfile
  text: string
  createdAtLabel: string
}

export const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: 'n1',
    actor: profiles['user-ada'],
    text: 'liked your post',
    createdAtLabel: '2h',
  },
  {
    id: 'n2',
    actor: profiles['user-leo'],
    text: 'started following you',
    createdAtLabel: '5h',
  },
  {
    id: 'n3',
    actor: profiles['user-mira'],
    text: 'replied to your post',
    createdAtLabel: '1d',
  },
]


/** Synchronous snapshot for first paint (startup contract — no await). */
export function getMockFeedSnapshot(): SocialPost[] {
  return posts.slice()
}
