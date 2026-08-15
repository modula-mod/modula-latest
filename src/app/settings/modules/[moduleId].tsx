import {useLocalSearchParams} from 'expo-router'

import {ModuleManagementScreen} from '@/features/modules/screens/ModuleManagementScreen'
import {safeModuleId} from '@/features/modules/validation/module-route'

export default function SettingsModuleManagementRoute() {
  const params = useLocalSearchParams<{moduleId: string}>()
  return <ModuleManagementScreen moduleId={safeModuleId(params.moduleId)} />
}
