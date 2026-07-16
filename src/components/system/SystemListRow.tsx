import type {ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useTheme} from '@/theme/runtime/useTheme'

type SystemListRowProps = {
  title: string
  subtitle?: string
  right?: ReactNode
  onPress?: () => void
  showDivider?: boolean
}

export function SystemListRow({
  title,
  subtitle,
  right,
  onPress,
  showDivider = true,
}: SystemListRowProps) {
  const {colours, spacing} = useTheme()

  const body = (
    <View
      style={[
        styles.row,
        {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: showDivider ? StyleSheet.hairlineWidth : 0,
          borderBottomColor: colours.border,
        },
      ]}>
      <View style={styles.textCol}>
        <AppText variant="body">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" colour="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
      {!right && onPress ? (
        <AppText colour="textSecondary">›</AppText>
      ) : null}
    </View>
  )

  if (onPress) {
    return <AppPressable onPress={onPress}>{body}</AppPressable>
  }
  return body
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
})
