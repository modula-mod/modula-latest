import {StyleSheet, View} from 'react-native'

import {ProfileBio} from '@/features/profile/components/ProfileIdentity'
import {ProfileMetadataGrid} from '@/features/profile/components/ProfileMetadataGrid'
import type {
  ModulaProfile,
  ProfileViewerContext,
} from '@/features/profile/contracts/profile'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileAboutPageProps = {
  profile: ModulaProfile
  viewer: ProfileViewerContext
}

/**
 * Hero pager page 02. Compact identity summary.
 *
 * The top-level Profile About tab remains the full expanded profile. This
 * page is a glanceable bio + metadata grid, not a second About surface.
 */
export function ProfileAboutPage({profile, viewer}: ProfileAboutPageProps) {
  const {spacing} = useThemeTokens()

  return (
    <View style={[styles.page, {gap: spacing[2]}]} testID="profile-about-page">
      <AppText variant="micro" colour="textTertiary" style={styles.label}>
        About
      </AppText>
      <ProfileBio profile={profile} compact maxLines={3} />
      <ProfileMetadataGrid profile={profile} viewer={viewer} includeVisibility />
    </View>
  )
}

const styles = StyleSheet.create({
  label: {
    letterSpacing: 0.4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  page: {
    flex: 1,
    minWidth: 0,
    width: '100%',
  },
})
