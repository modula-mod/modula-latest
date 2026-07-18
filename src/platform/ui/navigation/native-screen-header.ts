import type {ReactNode} from 'react'

import {ProgressiveBlurHeaderBackground} from '@/platform/ui/navigation/progressive-blur-header-background'

export type NativeScreenHeaderConfig = {
  title: string
  headerLargeTitle?: boolean
}

/**
 * Shared Stack header defaults for top-level tab stacks.
 * Transparent + progressive blur background (not hard-edged system material).
 */
export function nativeScreenHeaderOptions(config: NativeScreenHeaderConfig) {
  return {
    headerShown: true as const,
    title: config.title,
    headerLargeTitle: config.headerLargeTitle ?? false,
    headerShadowVisible: false,
    headerTransparent: true as const,
    headerBackground: ProgressiveBlurHeaderBackground,
  }
}

export type HeaderActionSlot = {
  accessibilityLabel: string
  onPress: () => void
  children: ReactNode
}
