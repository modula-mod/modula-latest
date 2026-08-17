import {StyleSheet, View, useWindowDimensions} from 'react-native'

import {ProfileBio} from '@/features/profile/components/ProfileIdentity'
import {ProfileMetadataGrid} from '@/features/profile/components/ProfileMetadataGrid'
import type {
  ModulaProfile,
  ProfileViewerContext,
} from '@/features/profile/contracts/profile'
import {PROFILE_LAYOUT} from '@/features/profile/model/profile-layout'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileAboutPageProps = {
  profile: ModulaProfile
  viewer: ProfileViewerContext
}

/**
 * Overview About inner page. Compact identity snapshot: bio + metadata.
 * The lower About tab remains the expanded destination.
 */
export function ProfileAboutPage({profile, viewer}: ProfileAboutPageProps) {
  const {spacing} = useThemeTokens()
  const {fontScale} = useWindowDimensions()
  const bioLines = fontScale >= PROFILE_LAYOUT.stackedFontScale ? 4 : 3

  return (
    <View
      style={[styles.page, {gap: spacing[2], paddingTop: spacing[1]}]}
      testID="profile-about-page">
      {profile.bio ? (
        <ProfileBio profile={profile} compact maxLines={bioLines} />
      ) : null}
      <ProfileMetadataGrid profile={profile} viewer={viewer} includeVisibility />
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'flex-start',
    minWidth: 0,
    width: '100%',
  },
})
