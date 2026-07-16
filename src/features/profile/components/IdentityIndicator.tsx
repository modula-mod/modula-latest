import {StyleSheet, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {
  getIdentityClaimStatusLabel,
  type IdentityClaim,
} from '@/features/profile/contracts/identity'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type IdentityIndicatorProps = {
  claim: IdentityClaim
}

export function IdentityIndicator({claim}: IdentityIndicatorProps) {
  const {colours, radius, spacing} = useThemeTokens()
  const statusLabel = getIdentityClaimStatusLabel(claim.status)
  const colour =
    claim.status === 'verified'
      ? colours.success
      : claim.status === 'connected'
        ? colours.info
        : colours.textSecondary

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${claim.label}. ${statusLabel}.`}
      style={[
        styles.wrap,
        {
          borderColor: colours.border,
          borderRadius: radius.round,
          gap: spacing[1],
          paddingHorizontal: spacing[2],
        },
      ]}>
      <AppIcon
        name={claim.status === 'verified' ? 'check' : 'info'}
        colour={colour}
        size={15}
      />
      <AppText variant="micro" style={{color: colour}} numberOfLines={1}>
        {statusLabel}
      </AppText>
      <AppText variant="micro" colour="textSecondary" numberOfLines={1}>
        {claim.label}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    maxWidth: '100%',
    minHeight: 28,
  },
})
