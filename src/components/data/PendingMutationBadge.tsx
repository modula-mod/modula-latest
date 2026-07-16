import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function PendingMutationBadge({label = 'Pending'}: {label?: string}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colours.accentSubtle,
          borderRadius: radius.round,
          paddingHorizontal: spacing[2],
        },
      ]}>
      <AppText variant="micro" colour="accent">
        {label}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 22,
  },
})
