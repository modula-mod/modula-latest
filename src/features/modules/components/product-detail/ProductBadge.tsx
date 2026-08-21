import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModulaIcon} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ProductBadge({label = 'Private by design'}: {label?: string}) {
  const {colours, radius, spacing, scheme} = useThemeTokens()
  return (
    <View
      accessibilityLabel={label}
      style={[
        styles.badge,
        {
          backgroundColor: scheme === 'dark' ? colours.surfaceRaised : '#F2E8D9',
          borderRadius: radius.round,
          gap: spacing[1],
          paddingHorizontal: spacing[2],
        },
      ]}
      testID="product-badge">
      <ModulaIcon name="privacy" size={13} colour={scheme === 'dark' ? colours.textSecondary : '#6D5134'} />
      <AppText
        variant="micro"
        style={{color: scheme === 'dark' ? colours.textSecondary : '#6D5134', fontWeight: '700'}}>
        {label.toUpperCase()}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    minHeight: 24,
    paddingVertical: 4,
  },
})
