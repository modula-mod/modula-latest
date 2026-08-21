import type {ComponentType, ReactNode} from 'react'
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import {BlurView} from 'expo-blur'

import {isCallstackLiquidGlassNativeAvailable} from '@/platform/ui/navigation/liquid-glass-availability'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {isNativeGlassRuntimeAvailable} from '@/theme/materials/nativeMaterial'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type LiquidGlassChromeProps = {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  interactive?: boolean
  /** Visual density when true liquid glass is unavailable. */
  fallback?: 'clear' | 'regular'
  /**
   * `fill` (default) — children absolute-fill the chrome (icon discs).
   * `flow` — children keep normal layout (pills / segmented rows).
   */
  contentLayout?: 'fill' | 'flow'
  /** BlurView intensity override (BlurView fallback path only). */
  blurIntensity?: number
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

type ExpoGlassViewComponent = ComponentType<{
  style?: StyleProp<ViewStyle>
  glassEffectStyle?: string
  colorScheme?: 'light' | 'dark'
  isInteractive?: boolean
  children?: ReactNode
}>

let cachedCallstack: CallstackModule | null | undefined
let cachedExpoGlassView: ExpoGlassViewComponent | null | undefined

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

function loadExpoGlassView(): ExpoGlassViewComponent | null {
  if (cachedExpoGlassView !== undefined) return cachedExpoGlassView
  if (!isNativeGlassRuntimeAvailable()) {
    cachedExpoGlassView = null
    return null
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-glass-effect') as {
      GlassView: ExpoGlassViewComponent
    }
    cachedExpoGlassView = mod.GlassView
  } catch {
    cachedExpoGlassView = null
  }
  return cachedExpoGlassView
}

const loadedCallstackLiquidGlass = loadCallstackLiquidGlass()
const LoadedExpoGlassView = loadExpoGlassView()

/**
 * Liquid-glass chrome for circular / pill controls.
 * Callstack (iOS 26) → expo-glass-effect → translucent BlurView glass.
 * Never paints an opaque surface fill (that reads as a flat grey disc).
 */
export function LiquidGlassChrome({
  children,
  style,
  interactive = true,
  fallback = 'clear',
  contentLayout = 'fill',
  blurIntensity,
}: LiquidGlassChromeProps) {
  const {scheme} = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const isDark = scheme === 'dark'
  const effect = fallback === 'regular' ? 'regular' : 'clear'
  const resolvedBlur =
    blurIntensity ?? (fallback === 'regular' ? 78 : 64)
  // `regular` is intentionally denser (segmented tracks, composer) than icon discs.
  // `regular` is denser so sticky chrome / tracks don’t read as see-through.
  const wash =
    fallback === 'regular'
      ? isDark
        ? 'rgba(22, 28, 32, 0.72)'
        : 'rgba(255, 255, 255, 0.86)'
      : isDark
        ? 'rgba(255,255,255,0.1)'
        : 'rgba(255,255,255,0.42)'
  const rim =
    fallback === 'regular'
      ? isDark
        ? 'rgba(255,255,255,0.2)'
        : 'rgba(0,0,0,0.08)'
      : isDark
        ? 'rgba(255,255,255,0.24)'
        : 'rgba(255,255,255,0.78)'
  const flow = contentLayout === 'flow'

  if (reduceTransparency) {
    return (
      <View
        style={[
          styles.base,
          {
            backgroundColor: isDark ? 'rgba(40,48,52,0.92)' : 'rgba(245,247,248,0.94)',
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            borderWidth: StyleSheet.hairlineWidth,
          },
          style,
        ]}>
        {children}
      </View>
    )
  }

  const callstack = loadedCallstackLiquidGlass
  if (callstack?.isLiquidGlassSupported) {
    const Glass = callstack.LiquidGlassView
    return (
      <Glass
        interactive={interactive}
        effect={effect}
        style={[styles.base, styles.shadow, style]}>
        {children}
      </Glass>
    )
  }

  if (LoadedExpoGlassView) {
    return (
      <LoadedExpoGlassView
        glassEffectStyle={effect}
        isInteractive={interactive}
        colorScheme={isDark ? 'dark' : 'light'}
        style={[styles.base, styles.shadow, style]}>
        {children}
      </LoadedExpoGlassView>
    )
  }

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.base,
          styles.shadow,
          {
            backgroundColor: wash,
            borderColor: rim,
            borderWidth: StyleSheet.hairlineWidth,
          },
          style,
        ]}>
        {children}
      </View>
    )
  }

  return (
    <View style={[styles.base, styles.shadow, style]}>
      <BlurView
        intensity={resolvedBlur}
        tint={
          fallback === 'regular'
            ? isDark
              ? 'systemThickMaterialDark'
              : 'systemThickMaterialLight'
            : isDark
              ? 'systemUltraThinMaterialDark'
              : 'systemUltraThinMaterialLight'
        }
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: wash,
            borderColor: rim,
            borderWidth: StyleSheet.hairlineWidth,
          },
        ]}
      />
      <View style={flow ? styles.flowForeground : styles.foreground}>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  flowForeground: {
    flexDirection: 'row',
    width: '100%',
  },
  foreground: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  shadow: {
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
})
