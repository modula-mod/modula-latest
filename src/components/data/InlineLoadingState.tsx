import {ActivityIndicator, StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function InlineLoadingState({label = 'Loading'}: {label?: string}) {
  const {colours, spacing} = useThemeTokens()
  return (
    <View style={[styles.row, {gap: spacing[2]}]}>
      <ActivityIndicator color={colours.accent} />
      <AppText variant="caption" colour="textSecondary">
        {label}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 48,
  },
})
