import type {ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useTheme} from '@/theme/runtime/useTheme'

type ScreenHeaderProps = {
  title: string
  right?: ReactNode
}

export function ScreenHeader({title, right}: ScreenHeaderProps) {
  const {colours, spacing} = useTheme()

  return (
    <View
      style={[
        styles.header,
        {
          borderBottomColor: colours.border,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colours.canvas,
        },
      ]}>
      <AppText variant="title">{title}</AppText>
      {right}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
})
