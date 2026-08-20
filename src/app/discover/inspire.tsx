import {DiscoverInspireScreen} from '@/features/discover/screens/DiscoverInspireScreen'
import {HydratedRouteBoundary} from '@/components/system/HydratedRouteBoundary'

export default function DiscoverInspireRoute() {
  return (
    <HydratedRouteBoundary>
      <DiscoverInspireScreen />
    </HydratedRouteBoundary>
  )
}
