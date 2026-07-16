import type {PropsWithChildren, ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ExpandedShell({
  children,
  rail,
}: PropsWithChildren<{rail?: ReactNode}>) {
  const {spacing} = useThemeTokens()

  return (
    <View style={[styles.wrap, {gap: spacing[4]}]}>
      <MaterialSurface role="navigation" style={[styles.rail, {padding: spacing[3]}]}>
        {rail ?? <AppText variant="label">Modula</AppText>}
      </MaterialSurface>
      <View style={styles.content}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    minWidth: 0,
  },
  rail: {
    width: 248,
  },
  wrap: {
    flex: 1,
    flexDirection: 'row',
  },
})
