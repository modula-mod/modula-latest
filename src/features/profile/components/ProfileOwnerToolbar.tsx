import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModulaProfile} from '@/features/profile/contracts/profile'
import {shareProfile} from '@/features/profile/services/shareProfile'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileOwnerToolbarProps = {
  profile: ModulaProfile
}

export function ProfileOwnerToolbar({profile}: ProfileOwnerToolbarProps) {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View style={[styles.row, {gap: spacing[2]}]}>
      <ToolbarButton
        label="Edit profile"
        icon="profile"
        onPress={() => router.push('/profile/edit' as Href)}
      />
      <ToolbarButton
        label="Customize"
        icon="appearance"
        onPress={() => router.push('/profile/customize' as Href)}
      />
      <AppPressable
        accessibilityLabel="Preview profile link"
        onPress={() => void shareProfile(profile)}
        style={[
          styles.iconButton,
          {backgroundColor: colours.surfaceRaised, borderRadius: radius.round},
        ]}>
        <AppIcon name="share" colour={colours.textSecondary} />
      </AppPressable>
    </View>
  )
}

function ToolbarButton({
  label,
  icon,
  onPress,
}: {
  label: string
  icon: Parameters<typeof AppIcon>[0]['name']
  onPress: () => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: colours.surfaceRaised,
          borderColor: colours.border,
          borderRadius: radius.round,
          gap: spacing[2],
          paddingHorizontal: spacing[3],
        },
      ]}>
      <AppIcon name={icon} colour={colours.accent} size={18} />
      <AppText variant="label">{label}</AppText>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
