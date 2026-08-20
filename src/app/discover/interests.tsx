import {DiscoverInterestsScreen} from '@/features/discover/screens/DiscoverInterestsScreen'
import {HydratedRouteBoundary} from '@/components/system/HydratedRouteBoundary'

export default function DiscoverInterestsRoute() {
  return (
    <HydratedRouteBoundary>
      <DiscoverInterestsScreen />
    </HydratedRouteBoundary>
  )
}
