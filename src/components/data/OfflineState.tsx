import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function OfflineState({local}: {local: boolean}) {
  const {spacing} = useThemeTokens()
  return (
    <View
      accessibilityRole="alert"
      style={[styles.wrap, {paddingHorizontal: spacing[4], paddingVertical: spacing[3]}]}>
      <AppText variant="headline">You’re offline</AppText>
      <AppText variant="body" colour="textSecondary">
        {local
          ? 'Last-known Modula data on this device is still available.'
          : 'Connect to the network to refresh. Last-known content stays visible where it was already loaded.'}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
})
