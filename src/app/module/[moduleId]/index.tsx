import {useLocalSearchParams} from 'expo-router'
import {View} from 'react-native'

import {ModuleHostScreen} from '@/features/modules/screens/ModuleHostScreen'
import {useHydrated} from '@/lib/useHydrated'

export default function ModuleRoute() {
  const hydrated = useHydrated()
  const params = useLocalSearchParams<{moduleId: string}>()
  if (!hydrated) return <View testID="module-route-pending" style={{flex: 1}} />
  return <ModuleHostScreen moduleId={params.moduleId} />
}
