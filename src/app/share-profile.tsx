import {ShareProfileSheetScreen} from '@/features/social/screens/SocialSurfaceScreens'
import {HydratedRouteBoundary} from '@/components/system/HydratedRouteBoundary'

export default function ShareProfileRoute() {
  return (
    <HydratedRouteBoundary>
      <ShareProfileSheetScreen />
    </HydratedRouteBoundary>
  )
}
