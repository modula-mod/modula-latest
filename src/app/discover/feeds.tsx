import {DiscoverFeedsScreen} from '@/features/discover/screens/DiscoverFeedsScreen'
import {HydratedRouteBoundary} from '@/components/system/HydratedRouteBoundary'

export default function DiscoverFeedsRoute() {
  return (
    <HydratedRouteBoundary>
      <DiscoverFeedsScreen />
    </HydratedRouteBoundary>
  )
}
