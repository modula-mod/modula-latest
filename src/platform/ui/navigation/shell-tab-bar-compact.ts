import {
  Easing,
  makeMutable,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

/**
 * 0 = full tab bar, 1 = minimised (~20% smaller) while scrolling down a feed.
 */
export const shellTabBarCompact: SharedValue<number> = makeMutable(0)

const SETTLE = Easing.bezier(0.25, 0.1, 0.25, 1)
/** Slow ease — not snappy. */
const COMPACT_IN = {duration: 480, easing: SETTLE}
const COMPACT_OUT = {duration: 520, easing: SETTLE}

/** Expand back to full size (e.g. when the user presses the tab bar). */
export function expandShellTabBar(): void {
  if (shellTabBarCompact.value < 0.01) return
  shellTabBarCompact.value = withTiming(0, COMPACT_OUT)
}

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

  if (y < 40) {
    if (shellTabBarCompact.value > 0.01) {
      shellTabBarCompact.value = withTiming(0, COMPACT_OUT)
    }
    return
  }

  // Slightly larger dy threshold so tiny jitter doesn’t flip state.
  if (dy > 8 && shellTabBarCompact.value < 0.99) {
    shellTabBarCompact.value = withTiming(1, COMPACT_IN)
    return
  }

  if (dy < -8 && shellTabBarCompact.value > 0.01) {
    shellTabBarCompact.value = withTiming(0, COMPACT_OUT)
  }
}
