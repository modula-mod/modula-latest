import {useLocalSearchParams} from 'expo-router'

import {ModuleHostScreen} from '@/features/modules/screens/ModuleHostScreen'

export default function ModuleCatchAllRoute() {
  const params = useLocalSearchParams<{moduleId: string; path?: string | string[]}>()
  return <ModuleHostScreen moduleId={params.moduleId} path={params.path} />
}
