import {PostAnalyticsScreen} from '@/features/social/screens/SocialSurfaceScreens'
import {HydratedRouteBoundary} from '@/components/system/HydratedRouteBoundary'

export default function PostAnalyticsRoute() {
  return (
    <HydratedRouteBoundary>
      <PostAnalyticsScreen />
    </HydratedRouteBoundary>
  )
}
