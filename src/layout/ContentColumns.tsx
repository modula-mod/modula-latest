import type {PropsWithChildren, ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import {useResponsiveLayout} from '@/layout/useResponsiveLayout'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ContentColumns({
  children,
  right,
}: PropsWithChildren<{right?: ReactNode}>) {
  const {isExpanded} = useResponsiveLayout()
  const {spacing} = useThemeTokens()

  return (
    <View style={[styles.wrap, {gap: spacing[4]}]}>
      <View style={styles.main}>{children}</View>
      {isExpanded && right ? <View style={styles.right}>{right}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    maxWidth: 720,
    minWidth: 0,
  },
  right: {
    maxWidth: 320,
    width: '28%',
  },
  wrap: {
    alignSelf: 'center',
    flex: 1,
    flexDirection: 'row',
    width: '100%',
  },
})
