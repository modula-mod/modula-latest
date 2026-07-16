import type {ReactNode} from 'react'

export type NativeScreenHeaderConfig = {
  title: string
  headerLargeTitle?: boolean
}

/**
 * Shared Stack header defaults for top-level tab stacks.
 * Screens compose trailing/leading controls via Stack.Screen options.
 */
export function nativeScreenHeaderOptions(config: NativeScreenHeaderConfig) {
  return {
    headerShown: true as const,
    title: config.title,
    headerLargeTitle: config.headerLargeTitle ?? false,
    headerShadowVisible: false,
  }
}

export type HeaderActionSlot = {
  accessibilityLabel: string
  onPress: () => void
  children: ReactNode
}
