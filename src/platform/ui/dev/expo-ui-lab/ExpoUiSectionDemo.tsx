import {StyleSheet, View} from 'react-native'

import {getExpoUiLabSection} from '@/platform/ui/dev/expo-ui-lab/catalog'
import {LabFallback} from '@/platform/ui/dev/expo-ui-lab/LabFallback'
import type {ExpoUiLabSectionId} from '@/platform/ui/dev/expo-ui-lab/types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ExpoUiSectionDemo({sectionId}: {sectionId: ExpoUiLabSectionId}) {
  const {spacing} = useThemeTokens()
  const meta = getExpoUiLabSection(sectionId)

  return (
    <View style={[styles.wrap, {padding: spacing[4]}]}>
      <LabFallback sectionTitle={meta?.title ?? sectionId} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
})
