import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import type {ChromeDensity} from '@/features/product/data/layoutBlocks'

/**
 * Shared bottom content padding for screens under the floating
 * ModulaLiquidGlassTabBar. React Navigation does not auto-inset custom tabBars.
 *
 * Geometry mirrors modula-liquid-glass-tab-bar:
 * segment row 60 + bottom offset (safe area) + breathing room.
 * Extra gap scales with Customize → Chrome density.
 */
export const FLOATING_TAB_BAR_SEGMENT_HEIGHT = 60

const EXTRA_GAP: Record<ChromeDensity, number> = {
  compact: 24,
  comfortable: 36,
  airy: 52,
}

export const FLOATING_TAB_BAR_EXTRA_GAP = EXTRA_GAP.comfortable

export function useFloatingTabBarContentPadding(): number {
  const insets = useSafeAreaInsets()
  const {preferences} = useProductPreferences()
  const extra = EXTRA_GAP[preferences.chromeDensity] ?? EXTRA_GAP.comfortable
  return (
    FLOATING_TAB_BAR_SEGMENT_HEIGHT + Math.max(insets.bottom, 8) + extra
  )
}
