import {ProfileConnectionsScreen} from '@/features/profile/screens/ProfileConnectionsScreen'

export function FollowingScreen({handle}: {handle: string}) {
  return <ProfileConnectionsScreen handle={handle} mode="following" />
}
