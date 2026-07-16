import {ProfileConnectionsScreen} from '@/features/profile/screens/ProfileConnectionsScreen'

export function FollowersScreen({handle}: {handle: string}) {
  return <ProfileConnectionsScreen handle={handle} mode="followers" />
}
