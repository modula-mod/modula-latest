import {StyleSheet, View} from 'react-native'

import {ProtectedActionPrompt} from '@/auth/components/ProtectedActionPrompt'
import {useCapability, useProtectedPrompt} from '@/auth/runtime'
import type {
  ModulaProfile,
  ProfileViewerContext,
} from '@/features/profile/contracts/profile'
import {useFollowProfileMutation} from '@/features/profile/data-query'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaIcon} from '@/platform/ui/icons'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {selectionHaptic} from '@/lib/haptics'
import {parseProfileId} from '@/api/contracts'
import {shareProfile} from '@/features/profile/services/shareProfile'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileActionsProps = {
  profile: ModulaProfile
  viewer: ProfileViewerContext
}

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

/**
 * Compact in-hero actions via Expo UI `ModulaButton` (universal outlined/filled).
 * Owner Edit lives in the cover control group. Visitors keep Follow on the
 * avatar row — X / Instagram / Bluesky density, not a teal brick.
 */
export function ProfileActions({profile, viewer}: ProfileActionsProps) {
  const canFollow = useCapability('social:follow')
  const prompt = useProtectedPrompt()
  const followMutation = useFollowProfileMutation()
  const {colours, controls} = useThemeTokens()

  if (viewer.canEdit) {
    return null
  }

  return (
    <View style={styles.row}>
      <ModulaButton
        label={profile.isFollowing ? 'Following' : 'Follow'}
        role={profile.isFollowing ? 'secondary' : 'primary'}
        accessibilityLabel={
          profile.isFollowing ? `Unfollow ${profile.displayName}` : `Follow ${profile.displayName}`
        }
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
      />
      <ModulaMenu
        accessibilityLabel="More profile actions"
        title={profile.displayName}
        actions={visitorMoreActions()}
        onAction={id => {
          if (id === 'share' || id === 'copy') void shareProfile(profile)
        }}
        trigger={
          <View
            pointerEvents="none"
            style={[
              styles.menuTarget,
              {
                minHeight: controls.touchTarget.minimum,
                minWidth: controls.touchTarget.minimum,
              },
            ]}>
            <ModulaIcon name="more" colour={colours.text} size={controls.iconSize.toolbar} />
          </View>
        }
      />
      <ProtectedActionPrompt visible={prompt.visible} onClose={prompt.hide} />
    </View>
  )
}

const styles = StyleSheet.create({
  menuTarget: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 8,
  },
})
