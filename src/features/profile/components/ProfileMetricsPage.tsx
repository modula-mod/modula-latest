import {StyleSheet, View} from 'react-native'

import {ProfileStats} from '@/features/profile/components/ProfileStats'
import type {
  ModulaProfile,
  ProfilePresentationPreferences,
} from '@/features/profile/contracts/profile'

type ProfileMetricsPageProps = {
  profile: ModulaProfile
  ownerHandle: string
  presentation: ProfilePresentationPreferences
  onSelectTab: (tabId: string) => void
  isOwner: boolean
}

/**
 * Hero pager page 01. Two-column metric snapshot: picker on the left,
 * featured selected metric on the right. Full lists still open through
 * metric activation. There is no top-level Metrics tab.
 */
export function ProfileMetricsPage({
  profile,
  ownerHandle,
  presentation,
  onSelectTab,
  isOwner,
}: ProfileMetricsPageProps) {
  return (
    <View style={styles.page} testID="profile-metrics-page">
      <ProfileStats
        key={profile.id}
        profile={profile}
        ownerHandle={ownerHandle}
        presentation={presentation}
        onSelectTab={onSelectTab}
        isOwner={isOwner}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minWidth: 0,
    width: '100%',
  },
})
