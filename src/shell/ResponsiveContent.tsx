import type {ReactNode} from 'react'
import {StyleSheet, View, useWindowDimensions} from 'react-native'

type ResponsiveContentProps = {
  children: ReactNode
  maxWidth?: number
}

export function ResponsiveContent({
  children,
  maxWidth = 680,
}: ResponsiveContentProps) {
  const {width} = useWindowDimensions()
  const centered = width >= 768

  return (
    <View style={styles.outer}>
      <View style={[styles.inner, centered && {maxWidth}]}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  inner: {
    alignSelf: 'center',
    flex: 1,
    width: '100%',
  },
  outer: {
    flex: 1,
    width: '100%',
  },
})
