import {View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ProductDescription({children}: {children: string}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[2]}} testID="product-description">
      <AppText variant="headline" accessibilityRole="header">Description</AppText>
      <AppText variant="body" colour="textSecondary">{children}</AppText>
    </View>
  )
}
