import {useLocalSearchParams} from 'expo-router'

import {ModuleManagementScreen} from '@/features/modules/screens/ModuleManagementScreen'

export default function SettingsModuleManagementRoute() {
  const params = useLocalSearchParams<{moduleId: string}>()
  return <ModuleManagementScreen moduleId={params.moduleId} />
}
