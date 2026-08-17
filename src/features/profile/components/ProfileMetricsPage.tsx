import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ProfileStats} from '@/features/profile/components/ProfileStats'
import type {
  ModulaProfile,
  ProfilePresentationPreferences,
} from '@/features/profile/contracts/profile'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileMetricsPageProps = {
  profile: ModulaProfile
  ownerHandle: string
  presentation: ProfilePresentationPreferences
  onSelectTab: (tabId: string) => void
  isOwner: boolean
}

/**
 * Hero pager page 01. Interactive metric snapshot. Full lists still open
 * through metric activation. There is no top-level Metrics tab.
 */
export function ProfileMetricsPage({
  profile,
  ownerHandle,
  presentation,
  onSelectTab,
  isOwner,
}: ProfileMetricsPageProps) {
  const {spacing} = useThemeTokens()

  return (
    <View style={[styles.page, {gap: spacing[1]}]} testID="profile-metrics-page">
      <AppText variant="micro" colour="textTertiary" style={styles.label}>
        Metrics
      </AppText>
      <View style={styles.picker}>
        <ProfileStats
          key={profile.id}
          profile={profile}
          ownerHandle={ownerHandle}
          presentation={presentation}
          onSelectTab={onSelectTab}
          isOwner={isOwner}
        />
      </View>
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
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    width: '100%',
  },
  picker: {
    alignSelf: 'center',
    maxWidth: 220,
    minWidth: 140,
    width: '62%',
  },
})
