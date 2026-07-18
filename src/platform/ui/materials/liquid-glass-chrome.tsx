import type {ComponentType, ReactNode} from 'react'
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'
import {BlurView} from 'expo-blur'

import {isCallstackLiquidGlassNativeAvailable} from '@/platform/ui/navigation/liquid-glass-availability'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {isNativeGlassRuntimeAvailable} from '@/theme/materials/nativeMaterial'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type LiquidGlassChromeProps = {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  interactive?: boolean
  /** Solid / raised colour when glass is unavailable. */
  fallback?: 'raised' | 'surface' | 'accent'
}

type CallstackModule = {
  LiquidGlassView: ComponentType<{
    style?: StyleProp<ViewStyle>
    interactive?: boolean
    effect?: string
    children?: ReactNode
  }>
  isLiquidGlassSupported: boolean
}

let cachedCallstack: CallstackModule | null | undefined

function loadCallstackLiquidGlass(): CallstackModule | null {
  if (cachedCallstack !== undefined) return cachedCallstack
  if (!isCallstackLiquidGlassNativeAvailable()) {
    cachedCallstack = null
    return null
  }
  try {
    // Dynamic require — static import crashes Expo Go / missing pods.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedCallstack = require('@callstack/liquid-glass') as CallstackModule
  } catch {
    cachedCallstack = null
  }
  return cachedCallstack
}

/**
 * Shared liquid-glass chrome for circular / pill controls.
 * Prefer Callstack liquid glass → expo-glass-effect → BlurView → solid.
 */
export function LiquidGlassChrome({
  children,
  style,
  interactive = true,
  fallback = 'raised',
}: LiquidGlassChromeProps) {
  const {colours, scheme} = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const solid =
    fallback === 'accent'
      ? colours.accent
      : fallback === 'surface'
        ? colours.surface
        : colours.surfaceRaised

  if (reduceTransparency) {
    return (
      <View style={[styles.base, {backgroundColor: solid}, style]}>{children}</View>
    )
  }

  const callstack = loadCallstackLiquidGlass()
  if (callstack?.isLiquidGlassSupported) {
    const Glass = callstack.LiquidGlassView
    return (
      <Glass interactive={interactive} effect="regular" style={[styles.base, style]}>
        {children}
      </Glass>
    )
  }

  if (isNativeGlassRuntimeAvailable()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {GlassView} = require('expo-glass-effect') as {
        GlassView: ComponentType<{
          style?: StyleProp<ViewStyle>
          glassEffectStyle?: string
          colorScheme?: 'light' | 'dark'
          children?: ReactNode
        }>
      }
      return (
        <GlassView
          glassEffectStyle="regular"
          colorScheme={scheme === 'dark' ? 'dark' : 'light'}
          style={[styles.base, style]}>
          {children}
        </GlassView>
      )
    } catch {
      // fall through
    }
  }

  return (
    <BlurView
      intensity={48}
      tint={scheme === 'dark' ? 'dark' : 'light'}
      style={[styles.base, {overflow: 'hidden'}, style]}>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, {backgroundColor: solid, opacity: 0.28}]}
      />
      {children}
    </BlurView>
  )
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
})
