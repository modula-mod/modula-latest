import {Gesture} from 'react-native-gesture-handler'
import {
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import {scheduleOnRN} from 'react-native-worklets'
import * as Haptics from 'expo-haptics'

import type {PostInteractionMode} from '@/features/social/posts/state/post-interaction-types'
import {POST_MOTION} from '@/features/social/posts/tokens/post-motion'

type CommentsSnap = keyof typeof POST_MOTION.commentsSnapPoints

const SNAP = POST_MOTION.commentsSnapPoints
const RAIL_COMMIT = POST_MOTION.railThresholds.commit
const COMMENTS_SPRING = POST_MOTION.commentsSnap
const RAIL_SPRING = POST_MOTION.railSnap
const PLAYER_SPRING = POST_MOTION.playerSnap
const POST_COMMENTS_DRAG = 280
const SHEET_COMMENTS_DRAG = 360
const RAIL_DRAG_DISTANCE = 140

function hapticLight() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
}

export function postSpringConfig(kind: 'rail' | 'comments' | 'player') {
  'worklet'
  if (kind === 'rail') {
    return {damping: RAIL_SPRING.damping, stiffness: RAIL_SPRING.stiffness}
  }
  if (kind === 'player') {
    return {damping: PLAYER_SPRING.damping, stiffness: PLAYER_SPRING.stiffness}
  }
  return {damping: COMMENTS_SPRING.damping, stiffness: COMMENTS_SPRING.stiffness}
}

export function railReleaseTarget(
  progress: number,
  velocityY: number,
): 'rest' | 'open' {
  'worklet'
  if (velocityY > 900) return 'open'
  if (velocityY < -400 && progress < RAIL_COMMIT) return 'rest'
  return progress >= RAIL_COMMIT ? 'open' : 'rest'
}

export function commentsSnapTarget(
  progress: number,
  velocityY: number,
): CommentsSnap {
  'worklet'
  const projected = progress - velocityY / 4200
  if (projected <= 0.12) return 'closed'
  if (velocityY < -900) {
    if (progress < SNAP.peek) return 'peek'
    if (progress < SNAP.partial) return 'partial'
    return 'full'
  }
  const candidates: CommentsSnap[] = ['closed', 'peek', 'partial', 'full']
  let nearest: CommentsSnap = 'closed'
  let best = Number.POSITIVE_INFINITY
  for (const key of candidates) {
    const delta = Math.abs(projected - SNAP[key])
    if (delta < best) {
      best = delta
      nearest = key
    }
  }
  return nearest
}

export function commentsModeForSnap(snap: CommentsSnap): PostInteractionMode {
  'worklet'
  switch (snap) {
    case 'closed':
      return 'idle'
    case 'peek':
      return 'commentsPeek'
    case 'partial':
      return 'commentsPartial'
    case 'full':
      return 'commentsFull'
    default:
      return 'idle'
  }
}

export function reactionIndexFromX(
  x: number,
  slotWidth: number,
  count: number,
): number {
  'worklet'
  if (slotWidth <= 0 || count <= 0) return 0
  return Math.min(count - 1, Math.max(0, Math.floor(x / slotWidth)))
}

function settleComments(
  commentsProgress: SharedValue<number>,
  velocityY: number,
  reduceMotion: boolean,
): CommentsSnap {
  'worklet'
  const snap = commentsSnapTarget(commentsProgress.get(), velocityY)
  const value = SNAP[snap]
  commentsProgress.set(
    reduceMotion
      ? withTiming(value, {duration: 120})
      : withSpring(value, {
          damping: COMMENTS_SPRING.damping,
          stiffness: COMMENTS_SPRING.stiffness,
          velocity: velocityY,
        }),
  )
  return snap
}

export function createCommentsSheetPan(args: {
  commentsProgress: SharedValue<number>
  dragStart: SharedValue<number>
  reduceMotion: boolean
  setMode: (mode: PostInteractionMode) => void
}) {
  const {commentsProgress, dragStart, reduceMotion, setMode} = args
  return Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-24, 24])
    .onBegin(() => {
      'worklet'
      dragStart.set(commentsProgress.get())
      scheduleOnRN(setMode, 'commentsDragging')
    })
    .onUpdate(event => {
      'worklet'
      const next = Math.min(
        1,
        Math.max(0, dragStart.get() - event.translationY / SHEET_COMMENTS_DRAG),
      )
      commentsProgress.set(next)
    })
    .onEnd(event => {
      'worklet'
      const snap = settleComments(
        commentsProgress,
        event.velocityY,
        reduceMotion,
      )
      scheduleOnRN(setMode, commentsModeForSnap(snap))
    })
}

export function createPostCommentsPan(args: {
  commentsProgress: SharedValue<number>
  enabled: boolean
  setMode: (mode: PostInteractionMode) => void
}) {
  const {commentsProgress, enabled, setMode} = args
  return Gesture.Pan()
    .enabled(enabled)
    .activeOffsetY([-9999, -10])
    .failOffsetX([-24, 24])
    .onBegin(() => {
      'worklet'
      scheduleOnRN(setMode, 'commentsDragging')
    })
    .onUpdate(event => {
      'worklet'
      const next = Math.min(1, Math.max(0, -event.translationY / POST_COMMENTS_DRAG))
      commentsProgress.set(next)
    })
    .onEnd(event => {
      'worklet'
      const snap = settleComments(commentsProgress, event.velocityY, false)
      scheduleOnRN(setMode, commentsModeForSnap(snap))
      if (snap !== 'closed') {
        scheduleOnRN(hapticLight)
      }
    })
}

export function createControllerCommentsPan(args: {
  commentsProgress: SharedValue<number>
  setMode: (mode: PostInteractionMode) => void
}) {
  const {commentsProgress, setMode} = args
  return Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((event, state) => {
      'worklet'
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
      'worklet'
      const next = Math.min(1, Math.max(0, -event.translationY / POST_COMMENTS_DRAG))
      commentsProgress.set(next)
    })
    .onEnd(event => {
      'worklet'
      const snap = settleComments(commentsProgress, event.velocityY, false)
      scheduleOnRN(setMode, commentsModeForSnap(snap))
      if (snap !== 'closed') {
        scheduleOnRN(hapticLight)
      }
    })
}

export function createRailPan(args: {
  railProgress: SharedValue<number>
  enabled: boolean
  setMode: (mode: PostInteractionMode) => void
  onCommitHaptic: () => void
  onOpenHaptic: () => void
}) {
  const {railProgress, enabled, setMode, onCommitHaptic, onOpenHaptic} = args
  return Gesture.Pan()
    .enabled(enabled)
    .activeOffsetY([8, 9999])
    .failOffsetX([-24, 24])
    .onBegin(() => {
      'worklet'
      scheduleOnRN(setMode, 'railDragging')
    })
    .onUpdate(event => {
      'worklet'
      const next = Math.min(1, Math.max(0, event.translationY / RAIL_DRAG_DISTANCE))
      railProgress.set(next)
      if (next >= RAIL_COMMIT) {
        scheduleOnRN(onCommitHaptic)
      }
    })
    .onEnd(event => {
      'worklet'
      const target = railReleaseTarget(railProgress.get(), event.velocityY)
      if (target === 'open') {
        railProgress.set(
          withSpring(1, {
            damping: RAIL_SPRING.damping,
            stiffness: RAIL_SPRING.stiffness,
          }),
        )
        scheduleOnRN(setMode, 'contextOpen')
        scheduleOnRN(onOpenHaptic)
      } else {
        railProgress.set(
          withSpring(0, {
            damping: RAIL_SPRING.damping,
            stiffness: RAIL_SPRING.stiffness,
          }),
        )
        scheduleOnRN(setMode, 'idle')
      }
    })
}
