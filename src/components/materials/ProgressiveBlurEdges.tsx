import {Platform, StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'
import {BlurView} from 'expo-blur'
import {LinearGradient} from 'expo-linear-gradient'

import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProgressiveBlurEdgesProps = {
  /** Height of each fade band. */
  edgeHeight?: number
  style?: StyleProp<ViewStyle>
  /** When false, only soft canvas gradients (no BlurView). */
  enabled?: boolean
  /** Which edges to paint. Headers use `top` only. */
  edges?: 'both' | 'top' | 'bottom'
  /** Soft teal side wash (Presence stage). Off for chrome headers. */
  sideAtmosphere?: boolean
}

/**
 * Apple-like progressive blur bands at the top and bottom of a surface.
 * Respects Reduce Transparency — falls back to soft canvas fades.
 */
export function ProgressiveBlurEdges({
  edgeHeight = 56,
  style,
  enabled = true,
  edges = 'both',
  sideAtmosphere = true,
}: ProgressiveBlurEdgesProps) {
  const {colours, scheme} = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const useBlur = enabled && !reduceTransparency && Platform.OS !== 'web'
  const tint = scheme === 'dark' ? 'dark' : 'light'
  const fadeSolid =
    scheme === 'dark'
      ? (['rgba(11,20,22,0.92)', 'rgba(11,20,22,0.45)', 'rgba(11,20,22,0)'] as const)
      : (['rgba(243,247,248,0.95)', 'rgba(243,247,248,0.5)', 'rgba(243,247,248,0)'] as const)
  const showTop = edges === 'both' || edges === 'top'
  const showBottom = edges === 'both' || edges === 'bottom'

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {showTop ? (
        <View style={[styles.edge, styles.top, {height: edgeHeight}]}>
          {useBlur ? (
            <BlurView intensity={42} tint={tint} style={StyleSheet.absoluteFill} />
          ) : null}
          <LinearGradient
            colors={[...fadeSolid]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
      {showBottom ? (
        <View style={[styles.edge, styles.bottom, {height: edgeHeight}]}>
          {useBlur ? (
            <BlurView intensity={42} tint={tint} style={StyleSheet.absoluteFill} />
          ) : null}
          <LinearGradient
            colors={[...fadeSolid].reverse() as [string, string, ...string[]]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
      {sideAtmosphere ? (
        <LinearGradient
          pointerEvents="none"
          colors={
            scheme === 'dark'
              ? ['rgba(54,156,170,0.12)', 'transparent', 'rgba(54,156,170,0.08)']
              : ['rgba(54,156,170,0.1)', 'transparent', 'rgba(54,156,170,0.08)']
          }
          start={{x: 0, y: 0.5}}
          end={{x: 1, y: 0.5}}
          style={[StyleSheet.absoluteFill, {opacity: 0.9}]}
        />
      ) : null}
      <View
        style={[
          StyleSheet.absoluteFill,
          {borderColor: colours.border, opacity: 0},
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  bottom: {
    bottom: 0,
    left: 0,
    right: 0,
  },
  edge: {
    left: 0,
    overflow: 'hidden',
    right: 0,
  },
  top: {
    left: 0,
    right: 0,
    top: 0,
  },
})
