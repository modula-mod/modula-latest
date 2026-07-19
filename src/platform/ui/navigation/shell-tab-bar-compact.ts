import {
  Easing,
  makeMutable,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

/**
 * 0 = full tab bar, 1 = minimised (~25% smaller) while scrolling down a feed.
 */
export const shellTabBarCompact: SharedValue<number> = makeMutable(0)

const SETTLE = Easing.bezier(0.22, 1, 0.36, 1)
const COMPACT_IN = {duration: 240, easing: SETTLE}
const COMPACT_OUT = {duration: 280, easing: SETTLE}

/**
 * Drive tab-bar compact from scroll direction.
 * Call from an animated scroll handler / reaction.
 */
export function syncShellTabBarCompactFromScroll(
  scrollY: number,
  lastScrollY: SharedValue<number>,
): void {
  'worklet'
  const y = Math.max(0, scrollY)
  const prev = lastScrollY.value
  const dy = y - prev
  lastScrollY.value = y

  if (y < 28) {
    if (shellTabBarCompact.value > 0.01) {
      shellTabBarCompact.value = withTiming(0, COMPACT_OUT)
    }
    return
  }

  if (dy > 4 && shellTabBarCompact.value < 0.99) {
    shellTabBarCompact.value = withTiming(1, COMPACT_IN)
    return
  }

  if (dy < -4 && shellTabBarCompact.value > 0.01) {
    shellTabBarCompact.value = withTiming(0, COMPACT_OUT)
  }
}
