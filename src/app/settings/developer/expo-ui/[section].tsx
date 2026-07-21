import {useLocalSearchParams} from 'expo-router'

import {ExpoUiSectionScreen} from '@/features/settings/screens/ExpoUiSectionScreen'

export default function ExpoUiSectionRoute() {
  const params = useLocalSearchParams<{section?: string | string[]}>()
  const sectionId = Array.isArray(params.section)
    ? params.section[0]
    : params.section

  return <ExpoUiSectionScreen sectionId={sectionId ?? ''} />
}
