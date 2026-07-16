import {useWindowDimensions} from 'react-native'

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
  const layoutClass: LayoutClass =
    width >= breakpoints.expanded
      ? 'expanded'
      : width >= breakpoints.medium
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
