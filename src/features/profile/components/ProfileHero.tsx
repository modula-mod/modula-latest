import {StyleSheet, View, useWindowDimensions} from 'react-native'

import type {
  ModulaProfile,
  ProfilePresentationPreferences,
  ProfileViewerContext,
} from '@/features/profile/contracts/profile'
import {ProfileActions} from '@/features/profile/components/ProfileActions'
import {ProfileAvatar} from '@/features/profile/components/ProfileAvatar'
import {ProfileCover} from '@/features/profile/components/ProfileCover'
import {ProfileIdentity} from '@/features/profile/components/ProfileIdentity'
import {ProfileStats} from '@/features/profile/components/ProfileStats'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileHeroProps = {
  profile: ModulaProfile
  viewer: ProfileViewerContext
  presentation: ProfilePresentationPreferences
  ownerHandle: string
  showStats?: boolean
  showActions?: boolean
  compact?: boolean
  onSelectTab: (tabId: string) => void
}

export function ProfileHero({
  profile,
  viewer,
  presentation,
  ownerHandle,
  showStats = true,
  showActions = true,
  compact,
  onSelectTab,
}: ProfileHeroProps) {
  const {width} = useWindowDimensions()
  const {colours, spacing} = useThemeTokens()
  const isCompact = compact ?? width < 760
  const avatarSize = isCompact ? 96 : 120

  return (
    <View style={[styles.wrap, {backgroundColor: colours.canvas}]}>
      <ProfileCover profile={profile} compact={isCompact} />
      <View
        style={[
          styles.identityRow,
          {
            gap: spacing[4],
            paddingHorizontal: spacing[4],
            paddingBottom: spacing[4],
            marginTop: -(avatarSize / 2),
          },
        ]}>
        <ProfileAvatar
          profile={profile}
          size={avatarSize}
          showFocusHalo={presentation.showFocusHalo}
        />
        <View style={[styles.identityBody, {paddingTop: avatarSize / 2 + spacing[2]}]}>
          <ProfileIdentity profile={profile} viewer={viewer} compact={isCompact} />
        </View>
      </View>
      {showActions ? (
        <View style={[styles.section, {paddingHorizontal: spacing[4], paddingBottom: spacing[3]}]}>
          <ProfileActions profile={profile} viewer={viewer} />
        </View>
      ) : null}
      {showStats ? (
        <ProfileStats
          profile={profile}
          ownerHandle={ownerHandle}
          presentation={presentation}
          onSelectTab={onSelectTab}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  identityBody: {
    flex: 1,
    minWidth: 0,
  },
  identityRow: {
    flexDirection: 'row',
  },
  section: {
    minWidth: 0,
  },
  wrap: {
    overflow: 'hidden',
  },
})
