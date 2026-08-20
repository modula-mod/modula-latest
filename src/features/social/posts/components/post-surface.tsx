import {BlurView} from 'expo-blur'
import {LinearGradient} from 'expo-linear-gradient'
import type {ReactNode} from 'react'
import {Platform, StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type PostSurfaceProps = {
  role: 'rail' | 'context' | 'comments' | 'captionScrim' | 'reaction'
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  contentLayout?: 'fill' | 'flow'
}

/**
 * Semantic post overlay surfaces mapped through appearance tokens.
 */
export function PostSurface({role, children, style, contentLayout = 'flow'}: PostSurfaceProps) {
  const {colours, scheme} = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const isDark = scheme === 'dark'

  if (role === 'captionScrim') {
    return (
      <LinearGradient
        colors={['transparent', colours.mediaOverlayScrim]}
        locations={[0, 1]}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, style]}
      />
    )
  }

  if (reduceTransparency || Platform.OS === 'web') {
    const background =
      role === 'context'
        ? isDark
          ? 'rgba(22,28,32,0.92)'
          : 'rgba(245,247,248,0.94)'
        : colours.mediaOverlayControlBackground
    return (
      <View style={[styles.base, {backgroundColor: background}, style]}>
        {children}
      </View>
    )
  }

  const fallback = role === 'context' || role === 'comments' ? 'regular' : 'clear'
  return (
    <LiquidGlassChrome
      fallback={fallback}
      contentLayout={contentLayout}
      blurIntensity={role === 'context' ? 72 : 58}
      style={[styles.base, style]}>
      {children}
    </LiquidGlassChrome>
  )
}

export function PostBackdropDim({opacity}: {opacity: number}) {
  const {colours} = useThemeTokens()
  if (opacity <= 0.01) return null
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {backgroundColor: colours.backdrop, opacity},
      ]}
    />
  )
}

export function PostCaptionBlur({height}: {height: number}) {
  const {scheme} = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  if (reduceTransparency || Platform.OS === 'web') return null
  return (
    <BlurView
      intensity={42}
      tint={scheme === 'dark' ? 'dark' : 'light'}
      style={[styles.captionBlur, {height}]}
    />
  )
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  captionBlur: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
})
