import type {ReactNode} from 'react'
import {Platform} from 'react-native'

export type NativeScreenHeaderConfig = {
  title: string
  headerLargeTitle?: boolean
}

/**
 * Shared Stack header defaults for top-level tab stacks.
 * Transparent + system blur on iOS so chrome matches progressive-blur secondary headers.
 * Screens compose trailing/leading controls via Stack.Screen options.
 */
export function nativeScreenHeaderOptions(config: NativeScreenHeaderConfig) {
  return {
    headerShown: true as const,
    title: config.title,
    headerLargeTitle: config.headerLargeTitle ?? false,
    headerShadowVisible: false,
    headerTransparent: true as const,
    ...(Platform.OS === 'ios'
      ? {headerBlurEffect: 'systemChromeMaterial' as const}
      : {}),
  }
}

export type HeaderActionSlot = {
  accessibilityLabel: string
  onPress: () => void
  children: ReactNode
}
