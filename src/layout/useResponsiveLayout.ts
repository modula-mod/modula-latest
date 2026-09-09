import {useWindowDimensions} from 'react-native'

import {useHydrated} from '@/lib/useHydrated'
import {breakpoints, type LayoutClass} from '@/layout/breakpoints'

export function useResponsiveLayout(): {
  width: number
  height: number
  layoutClass: LayoutClass
  isCompact: boolean
  isMedium: boolean
  isExpanded: boolean
} {
  const {width, height} = useWindowDimensions()
  const hydrated = useHydrated()
  // Static rendering has no viewport. Keep the hydration render compact, then
  // resolve the real browser class without replacing server DOM mid-hydration.
  const responsiveWidth = hydrated ? width : 0
  const layoutClass: LayoutClass =
    responsiveWidth >= breakpoints.expanded
      ? 'expanded'
      : responsiveWidth >= breakpoints.medium
        ? 'medium'
        : 'compact'

  return {
    width,
    height,
    layoutClass,
    isCompact: layoutClass === 'compact',
    isMedium: layoutClass === 'medium',
    isExpanded: layoutClass === 'expanded',
  }
}
