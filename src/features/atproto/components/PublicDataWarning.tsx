import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {
  ATPROTO_PUBLIC_DATA_ACK_LABEL,
  ATPROTO_PUBLIC_DATA_WARNING,
} from '@/features/atproto/copy'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type PublicDataWarningProps = {
  acknowledged: boolean
  onAcknowledgeChange: (next: boolean) => void
  title?: string
}

export function PublicDataWarning({
  acknowledged,
  onAcknowledgeChange,
  title = 'Public data on AT Protocol',
}: PublicDataWarningProps) {
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <Surface
      variant="muted"
      style={[
        styles.wrap,
        {
          borderRadius: radius.md,
          padding: spacing[4],
          gap: spacing[3],
          borderColor: colours.border,
        },
      ]}>
      <AppText variant="headline">{title}</AppText>
      <AppText variant="body" colour="textSecondary">
        {ATPROTO_PUBLIC_DATA_WARNING}
      </AppText>
      <AppPressable
        accessibilityRole="checkbox"
        accessibilityState={{checked: acknowledged}}
        accessibilityLabel={ATPROTO_PUBLIC_DATA_ACK_LABEL}
        onPress={() => onAcknowledgeChange(!acknowledged)}
        style={[styles.ackRow, {gap: spacing[3]}]}>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: colours.accent,
              backgroundColor: acknowledged ? colours.accent : 'transparent',
              borderRadius: radius.sm,
            },
          ]}
        />
        <AppText variant="body" style={{flex: 1}}>
          {ATPROTO_PUBLIC_DATA_ACK_LABEL}
        </AppText>
      </AppPressable>
    </Surface>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  ackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
  },
})
