import {Platform, useWindowDimensions} from 'react-native'

import {useHydrated} from '@/lib/useHydrated'

/**
 * React Native Web has no viewport during static rendering. Components whose
 * markup changes at breakpoints must reuse that server snapshot for the first
 * hydration render, then adopt the live dimensions.
 */
export function useHydrationSafeWindowDimensions() {
  const dimensions = useWindowDimensions()
  const hydrated = useHydrated()
  if (Platform.OS !== 'web' || hydrated) return dimensions
  return {...dimensions, width: 0, height: 0}
}
