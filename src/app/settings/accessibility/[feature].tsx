import {Redirect, useLocalSearchParams} from 'expo-router'

import {isSystemAccessibilityFeatureId} from '@/features/settings/data/systemAccessibilityFeatures'
import {SystemAccessibilityFeatureScreen} from '@/features/settings/screens/SystemAccessibilityFeatureScreen'

export default function SystemAccessibilityFeatureRoute() {
  const params = useLocalSearchParams<{feature: string | string[]}>()
  const feature = Array.isArray(params.feature) ? params.feature[0] : params.feature
  if (!isSystemAccessibilityFeatureId(feature)) {
    return <Redirect href="/settings/accessibility" />
  }
  return <SystemAccessibilityFeatureScreen featureId={feature} />
}
