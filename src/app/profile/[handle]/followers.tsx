import {useLocalSearchParams} from 'expo-router'

import {FollowersScreen} from '@/features/profile/screens/FollowersScreen'

export default function ProfileFollowersRoute() {
  const {handle} = useLocalSearchParams<{handle: string}>()
  return <FollowersScreen handle={handle} />
}
