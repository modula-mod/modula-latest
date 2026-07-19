import {useEffect, useMemo, useRef} from 'react'
import {Gesture} from 'react-native-gesture-handler'
import {
  Easing,
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import {selectionHaptic} from '@/lib/haptics'
import {
  releaseShellChromePullObscure,
  shellChromeHoldObscure,
  syncShellChromePullObscure,
} from '@/platform/ui/navigation/shell-chrome-obscure'
import {
  PULL_ACTION_ARM_DISTANCE,
  PULL_ACTION_ZONE_DISTANCE,
  type PullActionId,
} from '@/platform/ui/refresh/pull-action-types'

export type PullActionSelection = 0 | 1 | 2

export type UsePullActionGestureResult = {
  /** Content offset Y — shared so sticky chrome can react to the same scroll. */
  scrollY: SharedValue<number>
  pullDistance: SharedValue<number>
  swipeX: SharedValue<number>
  selectedIndex: SharedValue<PullActionSelection>
  armed: SharedValue<number>
  onScroll: ReturnType<typeof useAnimatedScrollHandler>
  listGesture: ReturnType<typeof Gesture.Simultaneous>
}

const SETTLE = Easing.bezier(0.22, 1, 0.36, 1)

function actionFromSelection(index: PullActionSelection): PullActionId {
  'worklet'
  if (index === 0) return 'search'
  if (index === 2) return 'close'
  return 'refresh'
}

function selectionFromSwipe(value: number): PullActionSelection {
  'worklet'
  if (value <= -PULL_ACTION_ZONE_DISTANCE) return 0
  if (value >= PULL_ACTION_ZONE_DISTANCE) return 2
  return 1
}

/**
 * Pull-down action chooser for feed surfaces.
 *
 * - Pull past the arm distance, release in the middle → refresh
 * - Pull, then swipe right → close (dismiss, no refresh)
 * - Pull, then swipe left → search
 *
 * Owns the gesture only while the list is at the top and the finger pulls down,
 * so normal scrolling is unaffected.
 */
export function usePullActionGesture(
  onCommit: (action: PullActionId) => void,
): UsePullActionGestureResult {
  const scrollY = useSharedValue(0)
  const pullDistance = useSharedValue(0)
  const swipeX = useSharedValue(0)
  const selectedIndex = useSharedValue<PullActionSelection>(1)
  const armed = useSharedValue(0)
  const touchStartY = useSharedValue(0)
  const onCommitRef = useRef(onCommit)

  useEffect(() => {
    onCommitRef.current = onCommit
  }, [onCommit])

  const dispatchCommit = (action: PullActionId) => {
    onCommitRef.current(action)
  }

  const onScroll = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = event.contentOffset.y
    },
  })

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .manualActivation(true)
        .onTouchesDown(event => {
          'worklet'
          touchStartY.value = event.allTouches[0]?.y ?? 0
        })
        .onTouchesMove((event, state) => {
          'worklet'
          if (scrollY.value > 2) {
            state.fail()
            return
          }
          const y = event.allTouches[0]?.y ?? touchStartY.value
          const dy = y - touchStartY.value
          if (dy >= 10) {
            state.activate()
            return
          }
          if (dy <= -8) {
            state.fail()
          }
        })
        .onUpdate(event => {
          'worklet'
          const pull = Math.max(0, event.translationY)
          pullDistance.value = pull
          syncShellChromePullObscure(pull)
          const isArmed = pull >= PULL_ACTION_ARM_DISTANCE ? 1 : 0
          armed.value = isArmed
          if (!isArmed) {
            swipeX.value = withTiming(0, {duration: 160, easing: SETTLE})
            selectedIndex.value = 1
            return
          }
          swipeX.value = event.translationX
          const next = selectionFromSwipe(event.translationX)
          if (next !== selectedIndex.value) {
            selectedIndex.value = next
            runOnJS(selectionHaptic)()
          }
        })
        .onEnd(() => {
          'worklet'
          if (armed.value || pullDistance.value >= PULL_ACTION_ARM_DISTANCE) {
            const action = actionFromSelection(selectedIndex.value)
            // Hold chrome immediately so tab bar doesn't flash before React state.
            if (action !== 'close') {
              shellChromeHoldObscure.value = 1
            }
            runOnJS(dispatchCommit)(action)
            // Keep the stage up briefly for refresh so the orb glow doesn't drop
            // a frame before `refreshing` lands from React.
            if (action === 'refresh') {
              pullDistance.value = Math.max(
                pullDistance.value,
                PULL_ACTION_ARM_DISTANCE,
              )
            } else {
              pullDistance.value = withTiming(0, {
                duration: 420,
                easing: SETTLE,
              })
            }
          } else {
            pullDistance.value = withTiming(0, {duration: 420, easing: SETTLE})
          }
          swipeX.value = withTiming(0, {duration: 360, easing: SETTLE})
          releaseShellChromePullObscure()
          armed.value = 0
          selectedIndex.value = 1
        })
        .onFinalize(() => {
          'worklet'
          if (
            pullDistance.value > 0 &&
            pullDistance.value < PULL_ACTION_ARM_DISTANCE
          ) {
            pullDistance.value = withTiming(0, {duration: 380, easing: SETTLE})
            swipeX.value = withTiming(0, {duration: 300, easing: SETTLE})
            releaseShellChromePullObscure()
            armed.value = 0
            selectedIndex.value = 1
          }
        }),
    // Shared values + dispatchCommit are stable for the lifetime of the hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const listGesture = useMemo(
    () => Gesture.Simultaneous(Gesture.Native(), pan),
    [pan],
  )

  return {
    scrollY,
    pullDistance,
    swipeX,
    selectedIndex,
    armed,
    onScroll,
    listGesture,
  }
}
