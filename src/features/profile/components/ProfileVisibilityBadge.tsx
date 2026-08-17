import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {
  PROFILE_VISIBILITY_LABELS,
  type ProfileVisibility,
} from '@/features/profile/contracts/profile'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileVisibilityBadgeProps = {
  visibility: ProfileVisibility
  contextLabel?: string
}

export function ProfileVisibilityBadge({
  visibility,
  contextLabel,
}: ProfileVisibilityBadgeProps) {
  const {colours, radius, spacing} = useThemeTokens()
  const label = PROFILE_VISIBILITY_LABELS[visibility]

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={
        contextLabel ? `${contextLabel} visible to ${label.toLowerCase()}` : label
      }
      style={[
        styles.badge,
        {
          backgroundColor: colours.surfaceMuted,
          borderColor: colours.border,
          borderRadius: radius.round,
          paddingHorizontal: spacing[2],
        },
      ]}>
      <AppText variant="micro" colour="textSecondary">
        {label}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 24,
  },
})
