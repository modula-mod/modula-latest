import {ComposeLabSection} from '@/platform/ui/dev/expo-ui-lab/sections/ComposeLabSection'
import {View} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ExpoUiPlayground() {
  const {spacing} = useThemeTokens()
  return (
    <View style={{flex: 1, padding: spacing[4]}}>
      <ComposeLabSection />
    </View>
  )
}
