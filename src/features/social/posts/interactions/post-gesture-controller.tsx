import {useMemo, type PropsWithChildren} from 'react'
import {GestureDetector} from 'react-native-gesture-handler'

import {usePostInteraction} from '@/features/social/posts/interactions/post-interaction-context'
import {createControllerCommentsPan} from '@/features/social/posts/interactions/post-ui-worklets'

type PostGestureControllerProps = PropsWithChildren<{
  enabled?: boolean
}>

export function PostGestureController({children, enabled = true}: PostGestureControllerProps) {
  const {commentsProgress, setMode, reduceMotion} = usePostInteraction()

  const bottomPan = useMemo(
    () =>
      createControllerCommentsPan({
        commentsProgress,
        setMode,
      }),
    [commentsProgress, setMode],
  )

  if (!enabled || reduceMotion) {
    return children
  }

  return <GestureDetector gesture={bottomPan}>{children}</GestureDetector>
}
