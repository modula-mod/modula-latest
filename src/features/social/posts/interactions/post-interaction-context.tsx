import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import {useSharedValue} from 'react-native-reanimated'

import type {PostInteractionMode} from '@/features/social/posts/state/post-interaction-types'
import {POST_MOTION} from '@/features/social/posts/tokens/post-motion'

type PostInteractionContextValue = {
  mode: PostInteractionMode
  setMode: (mode: PostInteractionMode) => void
  railProgress: ReturnType<typeof useSharedValue<number>>
  commentsProgress: ReturnType<typeof useSharedValue<number>>
  reactionProgress: ReturnType<typeof useSharedValue<number>>
  mediaExpansionProgress: ReturnType<typeof useSharedValue<number>>
  shellHeight: ReturnType<typeof useSharedValue<number>>
  reduceMotion: boolean
}

const PostInteractionContext = createContext<PostInteractionContextValue | null>(null)

type ProviderProps = PropsWithChildren<{
  reduceMotion: boolean
}>

export function PostInteractionProvider({children, reduceMotion}: ProviderProps) {
  const [mode, setMode] = useState<PostInteractionMode>('idle')
  const railProgress = useSharedValue(0)
  const commentsProgress = useSharedValue(0)
  const reactionProgress = useSharedValue(0)
  const mediaExpansionProgress = useSharedValue(0)
  const shellHeight = useSharedValue(0)

  const value = useMemo(
    () => ({
      mode,
      setMode,
      railProgress,
      commentsProgress,
      reactionProgress,
      mediaExpansionProgress,
      shellHeight,
      reduceMotion,
    }),
    [
      commentsProgress,
      mediaExpansionProgress,
      mode,
      railProgress,
      reactionProgress,
      reduceMotion,
      shellHeight,
    ],
  )

  return (
    <PostInteractionContext.Provider value={value}>{children}</PostInteractionContext.Provider>
  )
}

export function usePostInteraction(): PostInteractionContextValue {
  const context = useContext(PostInteractionContext)
  if (!context) {
    throw new Error('usePostInteraction must be used within PostInteractionProvider')
  }
  return context
}

export function postSpringConfig(kind: 'rail' | 'comments' | 'player') {
  const config = POST_MOTION[`${kind}Snap`]
  return {
    damping: config.damping,
    stiffness: config.stiffness,
  }
}
