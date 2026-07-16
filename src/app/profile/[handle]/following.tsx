import {useLocalSearchParams} from 'expo-router'

import {FollowingScreen} from '@/features/profile/screens/FollowingScreen'

export default function ProfileFollowingRoute() {
  const {handle} = useLocalSearchParams<{handle: string}>()
  return <FollowingScreen handle={handle} />
}
