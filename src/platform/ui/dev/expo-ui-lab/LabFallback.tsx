import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Shared non-iOS message for SwiftUI Expo UI demos. */
export function LabFallback({sectionTitle}: {sectionTitle?: string}) {
  const {colours, spacing} = useThemeTokens()

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colours.surface,
          borderColor: colours.border,
          gap: spacing[2],
          padding: spacing[4],
        },
      ]}>
      <AppText variant="headline">
        {sectionTitle ? `${sectionTitle} — iOS only` : 'iOS only'}
      </AppText>
      <AppText variant="body" colour="textSub">
        These Expo UI SwiftUI demos require an iOS simulator or device (SDK 57
        `@expo/ui/swift-ui`). On Android/web, evaluate the catalog notes and use
        existing Modula wrappers (`ModulaButton`, `ModulaSheet`,
        `ModulaContextMenu`, …) instead of importing SwiftUI from product screens.
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
