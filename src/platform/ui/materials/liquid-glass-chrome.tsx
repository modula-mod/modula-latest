import type {ReactNode} from 'react'
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
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

type WebGlassStyle = ViewStyle & {
  backdropFilter: string
  WebkitBackdropFilter: string
}

/**
 * Token-derived web glass for circular and pill controls.
 */
export function LiquidGlassChrome({
  children,
  style,
  interactive: _interactive = true,
  fallback = 'clear',
  contentLayout = 'fill',
  blurIntensity,
}: LiquidGlassChromeProps) {
  const {scheme} = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const isDark = scheme === 'dark'
  const resolvedBlur =
    blurIntensity ?? (fallback === 'regular' ? 78 : 64)
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

  const webBlur = `blur(${Math.round(resolvedBlur * 0.28)}px) saturate(145%)`
  return (
    <View
      style={[
        styles.base,
        styles.shadow,
        {backdropFilter: webBlur, WebkitBackdropFilter: webBlur} as WebGlassStyle,
        {backgroundColor: wash, borderColor: rim, borderWidth: StyleSheet.hairlineWidth},
        style,
      ]}>
      {contentLayout === 'flow' ? children : <View style={styles.foreground}>{children}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
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
