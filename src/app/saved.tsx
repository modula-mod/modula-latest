import {SavedPostsScreen} from '@/features/saved/screens/SavedPostsScreen'
import {HydratedRouteBoundary} from '@/components/system/HydratedRouteBoundary'

export default function SavedRoute() {
  return (
    <HydratedRouteBoundary>
      <SavedPostsScreen />
    </HydratedRouteBoundary>
  )
}
