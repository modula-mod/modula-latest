import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {ProtectedActionPrompt} from '@/auth/components/ProtectedActionPrompt'
import {useCapability, useProtectedPrompt} from '@/auth/runtime'
import {AppText} from '@/components/primitives/AppText'
import {AppPressable} from '@/components/primitives/AppPressable'
import type {
  ModulaProfile,
  ProfileViewerContext,
} from '@/features/profile/contracts/profile'
import {useFollowProfileMutation} from '@/features/profile/data-query'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {selectionHaptic} from '@/lib/haptics'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {parseProfileId} from '@/api/contracts'
import {shareProfile} from '@/features/profile/services/shareProfile'

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
        <View style={styles.primary}>
          <ModulaButton
            label="Edit Profile"
            role="primary"
            onPress={() => router.push('/profile/edit' as Href)}
          />
        </View>
        <ModulaMenu
          accessibilityLabel="More profile actions"
          title="Profile"
          actions={[
            {id: 'os', label: 'Profile-OS'},
            {id: 'customize', label: 'Customize'},
            {id: 'share', label: 'Share profile'},
            {id: 'preview', label: 'View as visitor'},
          ]}
          onAction={id => {
            if (id === 'os') router.push('/profile/os' as Href)
            if (id === 'customize') router.push('/profile/customize' as Href)
            if (id === 'share') void shareProfile(profile)
            if (id === 'preview') router.push('/profile/preview' as Href)
          }}
          trigger={<ModulaButton label="More" role="secondary" />}
        />
        <ProtectedActionPrompt visible={prompt.visible} onClose={prompt.hide} />
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
            borderRadius: radius.md,
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
      <ModulaMenu
        accessibilityLabel="More profile actions"
        title={profile.displayName}
        actions={[
          {id: 'share', label: 'Share profile'},
          {id: 'copy', label: 'Copy profile link'},
          {id: 'mute', label: 'Mute preview', style: 'destructive'},
          {id: 'block', label: 'Block preview', style: 'destructive'},
          {id: 'report', label: 'Report preview', style: 'destructive'},
        ]}
        onAction={id => {
          if (id === 'share' || id === 'copy') void shareProfile(profile)
        }}
        trigger={<ModulaButton label="More" role="secondary" />}
      />
      <ProtectedActionPrompt visible={prompt.visible} onClose={prompt.hide} />
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 44,
  },
  primary: {
    flex: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
})
