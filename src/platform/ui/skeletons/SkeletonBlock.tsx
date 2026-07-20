import {useEffect, useMemo} from 'react'
import {Animated, StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import {useReduceMotion} from '@/lib/accessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type SkeletonBlockProps = {
  height: number
  width?: number | `${number}%`
  borderRadius?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Theme-token skeleton placeholder. Shimmers when Reduce Motion is off;
 * otherwise a static opaque block.
 */
export function SkeletonBlock({
  height,
  width = '100%',
  borderRadius,
  style,
}: SkeletonBlockProps) {
  const {colours, radius} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const opacity = useMemo(() => new Animated.Value(1), [])

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [opacity, reduceMotion])

  return (
    <Animated.View
      style={[
        styles.block,
        {
          backgroundColor: colours.surfaceRaised,
          borderRadius: borderRadius ?? radius.medium,
          height,
          opacity: reduceMotion ? 1 : opacity,
          width,
        },
        style,
      ]}
    />
  )
}

export function SkeletonRow({
  children,
  gap = 12,
  style,
}: {
  children: React.ReactNode
  gap?: number
  style?: StyleProp<ViewStyle>
}) {
  return <View style={[{flexDirection: 'row', gap}, style]}>{children}</View>
}

const styles = StyleSheet.create({
  block: {
    overflow: 'hidden',
  },
})
