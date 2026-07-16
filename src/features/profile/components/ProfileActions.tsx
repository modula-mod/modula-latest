import {Alert, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {ProtectedActionPrompt} from '@/auth/components/ProtectedActionPrompt'
import {useCapability, useProtectedPrompt} from '@/auth/runtime'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {
  ModulaProfile,
  ProfileViewerContext,
} from '@/features/profile/contracts/profile'
import {useFollowProfileMutation} from '@/features/profile/data-query'
import {shareProfile} from '@/features/profile/services/shareProfile'
import {selectionHaptic} from '@/lib/haptics'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {parseProfileId} from '@/api/contracts'

type ProfileActionsProps = {
  profile: ModulaProfile
  viewer: ProfileViewerContext
}

export function ProfileActions({profile, viewer}: ProfileActionsProps) {
  const router = useRouter()
  const canFollow = useCapability('social:follow')
  const prompt = useProtectedPrompt()
  const followMutation = useFollowProfileMutation()
  const {colours, radius, spacing} = useThemeTokens()

  if (viewer.canEdit) {
    return (
      <View style={[styles.row, {gap: spacing[2]}]}>
        <ProfileActionButton
          label="Edit profile"
          icon="profile"
          primary
          onPress={() => router.push('/profile/edit' as Href)}
        />
        <ProfileActionButton
          label="Customize"
          icon="appearance"
          onPress={() => router.push('/profile/customize' as Href)}
        />
        <ProfileActionButton
          label="Share"
          icon="share"
          onPress={() => void shareProfile(profile)}
        />
        <ProfileActionButton
          label="More"
          icon="more"
          onPress={() =>
            Alert.alert('Profile actions', 'Choose a preview action.', [
              {text: 'View as visitor', onPress: () => router.push('/profile/preview' as Href)},
              {text: 'Copy profile link preview', onPress: () => void shareProfile(profile)},
              {text: 'Open Appearance', onPress: () => router.push('/settings/appearance' as Href)},
              {text: 'Cancel', style: 'cancel'},
            ])
          }
        />
      </View>
    )
  }

  return (
    <View style={[styles.row, {gap: spacing[2]}]}>
      <AppPressable
        accessibilityLabel={
          profile.isFollowing ? `Unfollow ${profile.displayName}` : `Follow ${profile.displayName}`
        }
        accessibilityState={{selected: profile.isFollowing}}
        onPress={() => {
          void selectionHaptic()
          if (!canFollow) {
            prompt.show()
            return
          }
          followMutation.mutate({
            profileId: parseProfileId(profile.id),
            following: !profile.isFollowing,
          })
        }}
        style={[
          styles.button,
          {
            backgroundColor: profile.isFollowing ? colours.surfaceRaised : colours.accent,
            borderColor: profile.isFollowing ? colours.border : 'transparent',
            borderRadius: radius.round,
            gap: spacing[2],
            paddingHorizontal: spacing[4],
          },
        ]}>
        <AppText
          variant="label"
          style={{
            color: profile.isFollowing ? colours.text : colours.accentForeground,
          }}>
          {profile.isFollowing ? 'Following' : 'Follow'}
        </AppText>
      </AppPressable>
      <ProfileActionButton
        label="Message"
        icon="messages"
        onPress={() => {
          if (canFollow) router.push('/messages' as Href)
          else prompt.show()
        }}
      />
      <ProfileActionButton
        label="Share"
        icon="share"
        onPress={() => void shareProfile(profile)}
      />
      <ProfileActionButton
        label="More"
        icon="more"
        onPress={() =>
          Alert.alert('Visitor preview actions', 'These moderation actions are local explanatory previews only.', [
            {text: 'Mute preview'},
            {text: 'Block preview'},
            {text: 'Report preview'},
            {text: 'Cancel', style: 'cancel'},
          ])
        }
      />
      <ProtectedActionPrompt
        visible={prompt.visible}
        onClose={prompt.hide}
        description="Sign in to follow profiles or use private social actions."
      />
    </View>
  )
}

function ProfileActionButton({
  label,
  icon,
  onPress,
  primary,
}: {
  label: string
  icon: Parameters<typeof AppIcon>[0]['name']
  onPress: () => void
  primary?: boolean
}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: primary ? colours.accent : colours.surfaceRaised,
          borderColor: primary ? 'transparent' : colours.border,
          borderRadius: radius.round,
          gap: spacing[2],
          paddingHorizontal: spacing[3],
        },
      ]}>
      <AppIcon
        name={icon}
        colour={primary ? colours.accentForeground : colours.textSecondary}
        size={18}
      />
      <AppText
        variant="label"
        style={{color: primary ? colours.accentForeground : colours.text}}>
        {label}
      </AppText>
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
