import {useSafeAreaInsets} from 'react-native-safe-area-context'

/**
 * Shared bottom content padding for screens under the floating
 * ModulaLiquidGlassTabBar. React Navigation does not auto-inset custom tabBars.
 *
 * Geometry mirrors modula-liquid-glass-tab-bar:
 * segment row 60 + bottom offset (safe area) + breathing room.
 */
export const FLOATING_TAB_BAR_SEGMENT_HEIGHT = 60
export const FLOATING_TAB_BAR_EXTRA_GAP = 28

export function useFloatingTabBarContentPadding(): number {
  const insets = useSafeAreaInsets()
  return (
    FLOATING_TAB_BAR_SEGMENT_HEIGHT +
    Math.max(insets.bottom, 8) +
    FLOATING_TAB_BAR_EXTRA_GAP
  )
}
