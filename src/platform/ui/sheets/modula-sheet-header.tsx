import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModulaSheetHeader({title, subtitle}: {title: string; subtitle?: string}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={[styles.root, {gap: spacing[1], paddingBottom: spacing[3]}]}>
      <AppText variant="headline" accessibilityRole="header">
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="caption" colour="textSecondary">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
  },
})
