import {Platform} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import type {ChromeDensity} from '@/features/product/data/layoutBlocks'

/**
 * Bottom content padding under shell tabs.
 *
 * iOS NativeTabs inset the first ScrollView automatically. Keep a small extra
 * gap so the last row is not flush with the liquid glass bar.
 * Screens that set `disableAutomaticContentInsets` (Profile cover) must pass
 * `automaticInsetsDisabled` so content can still clear the tab bar.
 * Web still uses the custom rail geometry.
 */
export const FLOATING_TAB_BAR_SEGMENT_HEIGHT = 60

const EXTRA_GAP: Record<ChromeDensity, number> = {
  compact: 24,
  comfortable: 36,
  airy: 52,
}

export const FLOATING_TAB_BAR_EXTRA_GAP = EXTRA_GAP.comfortable

export function useFloatingTabBarContentPadding(options?: {
  automaticInsetsDisabled?: boolean
}): number {
  const insets = useSafeAreaInsets()
  const {preferences} = useProductPreferences()
  const extra = EXTRA_GAP[preferences.chromeDensity] ?? EXTRA_GAP.comfortable
  if (Platform.OS === 'ios' && !options?.automaticInsetsDisabled) {
    return 28
  }
  if (Platform.OS === 'ios') {
    return FLOATING_TAB_BAR_SEGMENT_HEIGHT + Math.max(insets.bottom, 8) + extra
  }
  return FLOATING_TAB_BAR_SEGMENT_HEIGHT + Math.max(insets.bottom, 8) + extra
}
