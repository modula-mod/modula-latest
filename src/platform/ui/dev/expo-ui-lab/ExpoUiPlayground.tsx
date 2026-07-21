import {StyleSheet, View} from 'react-native'

import {LabFallback} from '@/platform/ui/dev/expo-ui-lab/LabFallback'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ExpoUiPlayground() {
  const {spacing} = useThemeTokens()
  return (
    <View style={[styles.wrap, {padding: spacing[4]}]}>
      <LabFallback sectionTitle="Full Expo UI playground" />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
})
