import {useMemo, type PropsWithChildren} from 'react'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'
import {scheduleOnRN} from 'react-native-worklets'
import {withSpring} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

import {
  postSpringConfig,
  usePostInteraction,
} from '@/features/social/posts/interactions/post-interaction-context'
import {
  commentsModeForSnap,
  commentsSnapTarget,
} from '@/features/social/posts/state/post-interaction-machine'
import {POST_MOTION} from '@/features/social/posts/tokens/post-motion'

const COMMENTS_DRAG = 280

type PostGestureControllerProps = PropsWithChildren<{
  enabled?: boolean
}>

export function PostGestureController({children, enabled = true}: PostGestureControllerProps) {
  const {commentsProgress, setMode, reduceMotion} = usePostInteraction()

  const bottomPan = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .onTouchesDown((event, state) => {
          const touch = event.allTouches[0]
          if (!touch) {
            state.fail()
            return
          }
          if (touch.y < event.handlerTag) {
            state.fail()
            return
          }
          state.activate()
        })
        .activeOffsetY([-9999, -8])
        .failOffsetX([-20, 20])
        .onUpdate(event => {
          const next = Math.min(
            1,
            Math.max(0, -event.translationY / COMMENTS_DRAG),
          )
          commentsProgress.set(next)
        })
        .onEnd(event => {
          const snap = commentsSnapTarget(commentsProgress.get(), event.velocityY)
          const value = POST_MOTION.commentsSnapPoints[snap]
          commentsProgress.set(
            withSpring(value, {
              ...postSpringConfig('comments'),
              velocity: event.velocityY,
            }),
          )
          scheduleOnRN(setMode, commentsModeForSnap(snap))
          if (snap !== 'closed') {
            scheduleOnRN(() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
            })
          }
        }),
    [commentsProgress, setMode],
  )

  if (!enabled || reduceMotion) {
    return children
  }

  return <GestureDetector gesture={bottomPan}>{children}</GestureDetector>
}
