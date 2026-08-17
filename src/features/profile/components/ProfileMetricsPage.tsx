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
 * Overview Metrics inner page. Canonical metric descriptors only.
 * There is no top-level Metrics tab — activation opens Posts / connections / Modules.
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
