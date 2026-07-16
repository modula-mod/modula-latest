import {useCallback, useState} from 'react'

import {
  developmentSocialProvider,
  getMockFeedSnapshot,
} from '@/social/adapters'
import type {SocialPost} from '@/social/contracts/SocialProvider'

export function useDevelopmentFeed() {
  const [posts, setPosts] = useState<SocialPost[]>(() => getMockFeedSnapshot())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await developmentSocialProvider.getFeed({limit: 40})
      setPosts(result.posts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feed')
    } finally {
      setLoading(false)
    }
  }, [])

  return {posts, loading, error, refresh}
}
