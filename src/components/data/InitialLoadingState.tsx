import {ActivityIndicator, StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function InitialLoadingState({label = 'Loading'}: {label?: string}) {
  const {colours, spacing} = useThemeTokens()
  return (
    <View style={[styles.wrap, {gap: spacing[3], padding: spacing[6]}]}>
      <ActivityIndicator accessibilityLabel={label} color={colours.accent} />
      <AppText variant="body" colour="textSecondary" style={styles.center}>
        {label}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
})
