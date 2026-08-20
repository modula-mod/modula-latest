import {SellerPreviewScreen} from '@/features/marketplace/screens/SellerPreviewScreen'
import {HydratedRouteBoundary} from '@/components/system/HydratedRouteBoundary'

export default function SellerPreviewRoute() {
  return (
    <HydratedRouteBoundary>
      <SellerPreviewScreen />
    </HydratedRouteBoundary>
  )
}
