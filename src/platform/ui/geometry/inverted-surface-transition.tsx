import {useMemo} from 'react'
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'
import Svg, {Path} from 'react-native-svg'

import {
  buildAvatarCradleRisePath,
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
  /** Portrait sits on this side of the transition. */
  avatarSlot?: InvertedSurfaceSide
  /** Raised canvas plateau — Profile identity occupies `trailing`. */
  raisedSide?: InvertedSurfaceSide
  width: number
  height: number
  fill: string
  trayWidth?: number
  trayHeight?: number
  cornerRadius?: number
  avatarCenterX?: number
  avatarCenterY?: number
  cradleRadius?: number
  /** Convex radius where the cradle rise meets the raised plateau. */
  plateauRadius?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Canvas-coloured inverted silhouette. Decorative — never captures presses.
 */
export function InvertedSurfaceTransition({
  edge = 'top',
  side = 'leading',
  size = 'profile',
  avatarSlot = 'leading',
  raisedSide = 'trailing',
  width,
  height,
  fill,
  trayWidth,
  trayHeight,
  cornerRadius,
  avatarCenterX,
  avatarCenterY,
  cradleRadius,
  plateauRadius,
  style,
}: InvertedSurfaceTransitionProps) {
  const d = useMemo(() => {
    if (width <= 0 || height <= 0) return ''
    const bite = inverted[size]
    const options: InvertedSurfacePathOptions = {
      cornerRadius,
      trayWidth,
      trayHeight,
      biteRadii: [Math.min(12, bite), bite, Math.min(12, bite)],
      avatarCenterX,
      avatarCenterY,
      cradleRadius,
      plateauRadius,
    }
    if (avatarCenterX != null && cradleRadius != null) {
      if (avatarSlot === 'leading' && raisedSide === 'trailing') {
        return buildAvatarCradleRisePath(width, height, options)
      }
    }
    if (edge === 'top' && side === 'leading') {
      return buildCoverCanvasLipPath(width, height, options)
    }
    return buildTopLeadingInvertedPath(width, height, options)
  }, [
    avatarCenterX,
    avatarCenterY,
    avatarSlot,
    cornerRadius,
    cradleRadius,
    edge,
    height,
    plateauRadius,
    raisedSide,
    side,
    size,
    trayHeight,
    trayWidth,
    width,
  ])

  if (width <= 0 || height <= 0 || !d) return null

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
  const d = useMemo(
    () => (width <= 0 || height <= 0 ? '' : buildSelectedInvertedSurfacePath(width, height)),
    [height, width],
  )
  if (width <= 0 || height <= 0 || !d) return null
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
