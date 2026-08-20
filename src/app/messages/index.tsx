import {MessagesInboxScreen} from '@/features/social/screens/SocialSurfaceScreens'
import {HydratedRouteBoundary} from '@/components/system/HydratedRouteBoundary'

export default function MessagesRoute() {
  return (
    <HydratedRouteBoundary>
      <MessagesInboxScreen />
    </HydratedRouteBoundary>
  )
}
