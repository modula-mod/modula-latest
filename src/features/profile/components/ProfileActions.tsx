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
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {selectionHaptic} from '@/lib/haptics'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {parseProfileId} from '@/api/contracts'
import {shareProfile} from '@/features/profile/services/shareProfile'

type ProfileActionsProps = {
  profile: ModulaProfile
  viewer: ProfileViewerContext
}

const OWNER_MORE_ACTIONS: ModulaActionItem[] = [
  {id: 'os', label: 'Profile-OS', icon: 'settings'},
  {id: 'customize', label: 'Customize', icon: 'appearance'},
  {id: 'share', label: 'Share profile', icon: 'share'},
  {id: 'preview', label: 'View as visitor', icon: 'eye'},
]

function visitorMoreActions(): ModulaActionItem[] {
  return [
    {id: 'share', label: 'Share profile', icon: 'share'},
    {id: 'copy', label: 'Copy profile link', icon: 'link'},
    {
      id: 'mute',
      label: 'Mute',
      icon: 'notifications',
      children: [
        {id: 'mute-8h', label: '8 hours'},
        {id: 'mute-1w', label: '1 week'},
        {id: 'mute-forever', label: 'Forever'},
      ],
    },
    {id: 'block', label: 'Block preview', icon: 'privacy', style: 'destructive'},
    {id: 'report', label: 'Report preview', icon: 'warning', style: 'destructive'},
  ]
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
            fullWidth
            onPress={() => router.push('/profile/edit' as Href)}
          />
        </View>
        <ModulaMenu
          accessibilityLabel="More profile actions"
          title="Profile"
          actions={OWNER_MORE_ACTIONS}
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
          styles.primary,
          {
            backgroundColor: profile.isFollowing ? colours.surfaceRaised : colours.accent,
            borderColor: profile.isFollowing ? colours.border : 'transparent',
            borderRadius: radius.round,
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
        actions={visitorMoreActions()}
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
