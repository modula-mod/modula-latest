import type {ReactNode} from 'react'
import {StyleSheet} from 'react-native'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {AppText} from '@/components/primitives/AppText'
import {useTheme} from '@/theme/runtime/useTheme'

type ScreenHeaderProps = {
  title: string
  right?: ReactNode
}

export function ScreenHeader({title, right}: ScreenHeaderProps) {
  const {colours, spacing} = useTheme()

  return (
    <MaterialSurface
      role="navigation"
      style={[
        styles.header,
        {
          borderBottomColor: colours.border,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        },
      ]}>
      <AppText variant="title">{title}</AppText>
      {right}
    </MaterialSurface>
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
