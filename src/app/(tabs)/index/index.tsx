import {HomeFeedScreen} from '@/features/feed/screens/HomeFeedScreen'
import {HydratedRouteBoundary} from '@/components/system/HydratedRouteBoundary'

export default function HomeRoute() {
  return (
    <HydratedRouteBoundary>
      <HomeFeedScreen />
    </HydratedRouteBoundary>
  )
}
