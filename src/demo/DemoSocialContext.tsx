import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

import {currentDemoProfile} from '@/demo/demoProfiles'
import {initialDemoPosts} from '@/demo/demoPosts'
import type {CreateDemoPostInput, DemoPost} from '@/types/social'

export type DemoSocialContextValue = {
  posts: DemoPost[]
  createPost: (input: CreateDemoPostInput) => void
  toggleLike: (postId: string) => void
  toggleSave: (postId: string) => void
  toggleRepost: (postId: string) => void
  followedProfileIds: Set<string>
  toggleFollow: (profileId: string) => void
}

const DemoSocialContext = createContext<DemoSocialContextValue | null>(null)

function createLocalPost(input: CreateDemoPostInput): DemoPost {
  const text = input.text?.trim()
  const base = {
    id: `post-local-${Date.now()}`,
    author: currentDemoProfile,
    createdAt: new Date().toISOString(),
    feed: 'following' as const,
    liked: false,
    saved: false,
    reposted: false,
    likeCount: 0,
    replyCount: 0,
    repostCount: 0,
  }

  if (input.media?.length) {
    return {
      ...base,
      kind: 'media',
      text,
      media: input.media,
      glowColour: input.media[0]?.colour ?? currentDemoProfile.avatarColour,
    }
  }

  if (input.link) {
    return {
      ...base,
      kind: 'link',
      text,
      link: input.link,
    }
  }

  return {
    ...base,
    kind: 'text',
    text: text ?? 'Shared a local Modula update.',
  }
}

export function DemoSocialProvider({children}: PropsWithChildren) {
  const [posts, setPosts] = useState<DemoPost[]>(initialDemoPosts)
  const [followedProfileIds, setFollowedProfileIds] = useState<Set<string>>(
    () => new Set(['profile-gaia']),
  )

  const createPost = useCallback((input: CreateDemoPostInput) => {
    const post = createLocalPost(input)
    setPosts(prev => [post, ...prev])
  }, [])

  const toggleLike = useCallback((postId: string) => {
    setPosts(prev =>
      prev.map(post =>
        post.id === postId
          ? {
              ...post,
              liked: !post.liked,
              likeCount: post.likeCount + (post.liked ? -1 : 1),
            }
          : post,
      ),
    )
  }, [])

  const toggleSave = useCallback((postId: string) => {
    setPosts(prev =>
      prev.map(post =>
        post.id === postId ? {...post, saved: !post.saved} : post,
      ),
    )
  }, [])

  const toggleRepost = useCallback((postId: string) => {
    setPosts(prev =>
      prev.map(post =>
        post.id === postId
          ? {
              ...post,
              reposted: !post.reposted,
              repostCount: post.repostCount + (post.reposted ? -1 : 1),
            }
          : post,
      ),
    )
  }, [])

  const toggleFollow = useCallback((profileId: string) => {
    setFollowedProfileIds(prev => {
      const next = new Set(prev)
      if (next.has(profileId)) {
        next.delete(profileId)
      } else {
        next.add(profileId)
      }
      return next
    })
  }, [])

  const value = useMemo<DemoSocialContextValue>(
    () => ({
      posts,
      createPost,
      toggleLike,
      toggleSave,
      toggleRepost,
      followedProfileIds,
      toggleFollow,
    }),
    [
      posts,
      createPost,
      toggleLike,
      toggleSave,
      toggleRepost,
      followedProfileIds,
      toggleFollow,
    ],
  )

  return (
    <DemoSocialContext.Provider value={value}>
      {children}
    </DemoSocialContext.Provider>
  )
}

export function useDemoSocial(): DemoSocialContextValue {
  const context = useContext(DemoSocialContext)
  if (!context) {
    throw new Error('useDemoSocial must be used within DemoSocialProvider')
  }
  return context
}
