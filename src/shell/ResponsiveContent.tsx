import type {ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

type ResponsiveContentProps = {
  children: ReactNode
  maxWidth?: number
}

export function ResponsiveContent({
  children,
  maxWidth = 680,
}: ResponsiveContentProps) {
  return (
    <View style={styles.outer}>
      <View style={[styles.inner, {maxWidth}]}>{children}</View>
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
