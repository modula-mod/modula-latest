import {IntelligenceLayerScreen} from '@/features/product/screens/IntelligenceLayerScreen'
import {HydratedRouteBoundary} from '@/components/system/HydratedRouteBoundary'

export default function IntelligenceLayerRoute() {
  return (
    <HydratedRouteBoundary>
      <IntelligenceLayerScreen />
    </HydratedRouteBoundary>
  )
}
