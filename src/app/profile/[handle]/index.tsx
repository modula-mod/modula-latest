import {View} from 'react-native'
import {useLocalSearchParams} from 'expo-router'

import {UnifiedProfileScreen} from '@/features/profile/screens/UnifiedProfileScreen'
import {useHydrated} from '@/lib/useHydrated'

export default function PublicProfileRoute() {
  const hydrated = useHydrated()
  const params = useLocalSearchParams<{handle: string | string[]}>()
  const handle = Array.isArray(params.handle) ? params.handle[0] : params.handle

  if (!hydrated) {
    return <View testID="public-profile-pending" style={{flex: 1}} />
  }

  return <UnifiedProfileScreen mode="public" handle={handle} />
}
