import type {PropsWithChildren} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useTheme} from '@/theme/runtime/useTheme'

type SystemSectionProps = PropsWithChildren<{
  title: string
}>

/**
 * Settings-style section header + children stack.
 * Uses Modula primitives (not platform Form APIs) for cross-platform parity.
 */
export function SystemSection({title, children}: SystemSectionProps) {
  const {colours, spacing, radius} = useTheme()

  return (
    <View style={{marginBottom: spacing.xl}}>
      <AppText
        variant="caption"
        colour="textSecondary"
        style={{marginBottom: spacing.sm, textTransform: 'uppercase'}}>
        {title}
      </AppText>
      <View
        style={[
          styles.group,
          {
            backgroundColor: colours.surfaceRaised,
            borderColor: colours.border,
            borderRadius: radius.lg,
          },
        ]}>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  group: {
    borderWidth: 1,
    overflow: 'hidden',
  },
})
