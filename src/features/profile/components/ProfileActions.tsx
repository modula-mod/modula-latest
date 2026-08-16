import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {ProtectedActionPrompt} from '@/auth/components/ProtectedActionPrompt'
import {useCapability, useProtectedPrompt} from '@/auth/runtime'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {AppPressable} from '@/components/primitives/AppPressable'
import type {
  ModulaProfile,
  ProfileViewerContext,
} from '@/features/profile/contracts/profile'
import {useFollowProfileMutation} from '@/features/profile/data-query'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {selectionHaptic} from '@/lib/haptics'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {parseProfileId} from '@/api/contracts'
import {shareProfile} from '@/features/profile/services/shareProfile'

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
 * Compact in-hero actions. Owner overflow lives in the native header.
 * Visitor overflow is a plain glyph — never a second labeled brick.
 * Reference: X / Instagram profile — one compact Follow/Edit pill on the avatar row.
 */
export function ProfileActions({profile, viewer}: ProfileActionsProps) {
  const router = useRouter()
  const canFollow = useCapability('social:follow')
  const prompt = useProtectedPrompt()
  const followMutation = useFollowProfileMutation()
  const {colours} = useThemeTokens()

  if (viewer.canEdit) {
    return (
      <View style={styles.row}>
        <ProfileActionPill
          label="Edit Profile"
          accessibilityLabel="Edit Profile"
          primary
          onPress={() => router.push('/profile/edit' as Href)}
        />
        <ProtectedActionPrompt visible={prompt.visible} onClose={prompt.hide} />
      </View>
    )
  }

  return (
    <View style={styles.row}>
      <ProfileActionPill
        label={profile.isFollowing ? 'Following' : 'Follow'}
        accessibilityLabel={
          profile.isFollowing ? `Unfollow ${profile.displayName}` : `Follow ${profile.displayName}`
        }
        primary={!profile.isFollowing}
        selected={profile.isFollowing}
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
          <View pointerEvents="none" style={styles.moreHit}>
            <AppIcon name="more" colour={colours.text} size={22} />
          </View>
        }
      />
      <ProtectedActionPrompt visible={prompt.visible} onClose={prompt.hide} />
    </View>
  )
}

function ProfileActionPill({
  label,
  accessibilityLabel,
  primary,
  selected,
  onPress,
}: {
  label: string
  accessibilityLabel: string
  primary?: boolean
  selected?: boolean
  onPress: () => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected ? {selected: true} : undefined}
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: primary ? colours.accent : colours.surface,
          borderColor: primary ? 'transparent' : colours.border,
          borderRadius: radius.round,
          paddingHorizontal: spacing[4],
        },
      ]}>
      <AppText
        variant="label"
        style={{
          color: primary ? colours.accentForeground : colours.text,
          fontWeight: '600',
        }}>
        {label}
      </AppText>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  moreHit: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    minWidth: 44,
  },
  pill: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 44,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
})
