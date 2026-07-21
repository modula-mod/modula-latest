import {
  useAnimatedScrollHandler,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'

export type PullProgress = {
  /** Overscroll distance in points (0 when not pulling). */
  pullDistance: SharedValue<number>
  onScroll: ReturnType<typeof useAnimatedScrollHandler>
}

/**
 * Tracks iOS-style rubber-band pull (negative contentOffset.y).
 */
export function useScrollPullProgress(): PullProgress {
  const pullDistance = useSharedValue(0)

  const onScroll = useAnimatedScrollHandler({
    onScroll: event => {
      const y = event.contentOffset.y
      pullDistance.value = y < 0 ? -y : 0
    },
  })

  return {pullDistance, onScroll}
}
