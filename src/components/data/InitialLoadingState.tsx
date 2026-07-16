import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function InitialLoadingState({label = 'Loading Modula'}: {label?: string}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <View style={[styles.wrap, {gap: spacing[3], padding: spacing[6]}]}>
      <View
        style={[
          styles.block,
          {backgroundColor: colours.surfaceRaised, borderRadius: radius.large},
        ]}
      />
      <AppText variant="caption" colour="textSecondary">
        {label}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  block: {
    height: 96,
    width: '100%',
  },
  wrap: {
    minHeight: 180,
  },
})
