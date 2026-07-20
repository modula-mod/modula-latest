import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import type {MarketplaceModule} from '@/features/marketplace/data/catalog'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type MarketplaceStatus = MarketplaceModule['status']

export function MarketplaceStatusBadge({status}: {status: MarketplaceStatus}) {
  const {colours, radius, spacing} = useThemeTokens()
  const tone =
    status === 'Preview'
      ? {
          backgroundColor: colours.accentSubtle,
          borderColor: colours.accentBorder,
          textColor: colours.accent,
        }
      : status === 'Planned'
        ? {
            backgroundColor: colours.surfaceRaised,
            borderColor: colours.warning,
            textColor: colours.warning,
          }
        : {
            backgroundColor: colours.destructiveSubtle,
            borderColor: colours.destructive,
            textColor: colours.destructive,
          }

  return (
    <View
      accessibilityLabel={`${status} status`}
      style={[
        styles.badge,
        {
          backgroundColor: tone.backgroundColor,
          borderColor: tone.borderColor,
          borderRadius: radius.round,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[1],
        },
      ]}>
      <AppText variant="micro" style={{color: tone.textColor}}>
        {status}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
  },
})
