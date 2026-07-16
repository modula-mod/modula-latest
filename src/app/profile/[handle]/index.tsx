import {useLocalSearchParams} from 'expo-router'

import {UnifiedProfileScreen} from '@/features/profile/screens/UnifiedProfileScreen'

export default function PublicProfileRoute() {
  const {handle} = useLocalSearchParams<{handle: string}>()
  return (
    <UnifiedProfileScreen
      mode="public"
      handle={handle}
    />
  )
}
