import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'
import Svg, {Path} from 'react-native-svg'

import {
  buildAvatarCradlePath,
  buildCoverCanvasLipPath,
  buildSelectedInvertedSurfacePath,
  buildTopLeadingInvertedPath,
  type InvertedSurfacePathOptions,
} from '@/platform/ui/geometry/inverted-corner-path'
import {inverted} from '@/theme/foundations/inverted'

export type InvertedSurfaceEdge = 'top' | 'bottom'
export type InvertedSurfaceSide = 'leading' | 'trailing'
export type InvertedSurfaceSize = keyof typeof inverted

type InvertedSurfaceTransitionProps = {
  edge?: InvertedSurfaceEdge
  side?: InvertedSurfaceSide
  size?: InvertedSurfaceSize
  width: number
  height: number
  fill: string
  trayWidth?: number
  trayHeight?: number
  cornerRadius?: number
  avatarCenterX?: number
  cradleRadius?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Canvas-coloured inverted silhouette. Decorative — never captures presses.
 */
export function InvertedSurfaceTransition({
  edge = 'top',
  side = 'leading',
  size = 'profile',
  width,
  height,
  fill,
  trayWidth,
  trayHeight,
  cornerRadius,
  avatarCenterX,
  cradleRadius,
  style,
}: InvertedSurfaceTransitionProps) {
  if (width <= 0 || height <= 0) return null
  const bite = inverted[size]
  const options: InvertedSurfacePathOptions = {
    cornerRadius,
    trayWidth,
    trayHeight,
    biteRadii: [Math.min(12, bite), bite, Math.min(12, bite)],
    avatarCenterX,
    cradleRadius,
  }
  const d =
    avatarCenterX != null && cradleRadius != null
      ? buildAvatarCradlePath(width, height, options)
      : edge === 'top' && side === 'leading'
        ? buildCoverCanvasLipPath(width, height, options)
        : buildTopLeadingInvertedPath(width, height, options)

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.host, {height, width}, style]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={d} fill={fill} />
      </Svg>
    </View>
  )
}

type InvertedSelectedSurfaceProps = {
  width: number
  height: number
  fill: string
  style?: StyleProp<ViewStyle>
}

export function InvertedSelectedSurface({
  width,
  height,
  fill,
  style,
}: InvertedSelectedSurfaceProps) {
  if (width <= 0 || height <= 0) return null
  const d = buildSelectedInvertedSurfacePath(width, height)
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.host, {height, width}, style]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={d} fill={fill} />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  host: {
    overflow: 'hidden',
  },
})
