import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
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
 * Progressive blur bands at the top and/or bottom of a surface.
 * Uses stacked intensity strips so the edge dissolves instead of a hard bar.
 */
export function ProgressiveBlurEdges({
  edgeHeight = 56,
  style,
  enabled = true,
  edges = 'both',
  sideAtmosphere = true,
}: ProgressiveBlurEdgesProps) {
  const {colours, scheme} = useThemeTokens()
  const showTop = edges === 'both' || edges === 'top'
  const showBottom = edges === 'both' || edges === 'bottom'

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {showTop ? (
        <View style={[styles.edge, styles.top, {height: edgeHeight}]}>
          <ProgressiveBlurBand height={edgeHeight} enabled={enabled} topHeavy />
        </View>
      ) : null}
      {showBottom ? (
        <View style={[styles.edge, styles.bottom, {height: edgeHeight}]}>
          <ProgressiveBlurBand height={edgeHeight} enabled={enabled} topHeavy={false} />
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
