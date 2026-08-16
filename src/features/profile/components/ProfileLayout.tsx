import type {ReactNode} from 'react'
import {StyleSheet, View, useWindowDimensions} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileLayoutProps = {
  left?: ReactNode
  main: ReactNode
  right?: ReactNode
}

export function ProfileLayout({left, main, right}: ProfileLayoutProps) {
  const {width} = useWindowDimensions()
  const {spacing} = useThemeTokens()
  const expanded = width >= 1100

  if (!expanded) {
    return <View style={styles.single}>{main}</View>
  }

  return (
    <View style={[styles.expanded, {gap: spacing[4], padding: spacing[4]}]}>
      {left ? <View style={styles.left}>{left}</View> : null}
      <View style={styles.main}>{main}</View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  expanded: {
    alignSelf: 'center',
    flexDirection: 'row',
    maxWidth: 1440,
    width: '100%',
  },
  left: {
    flexBasis: 310,
    flexShrink: 0,
  },
  main: {
    flex: 1,
    maxWidth: 760,
    minWidth: 0,
  },
  right: {
    flexBasis: 290,
    flexShrink: 0,
  },
  single: {
    flex: 1,
    width: '100%',
  },
})
