import {useLocalSearchParams} from 'expo-router'

import {ModuleHostScreen} from '@/features/modules/screens/ModuleHostScreen'

export default function ModuleRoute() {
  const params = useLocalSearchParams<{moduleId: string}>()
  return <ModuleHostScreen moduleId={params.moduleId} />
}
