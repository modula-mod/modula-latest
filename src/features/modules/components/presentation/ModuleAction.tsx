import {StyleSheet} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Compact product CTA. Always an RN pressable — Expo UI Host+Button does not
 * receive taps inside ScrollView / nested pressables on iOS.
 * Teal only for the meaningful primary verb.
 */
export function ModuleAction({
  presentation,
  productName,
  onPress,
  compact = true,
  fullWidth = false,
  loading = false,
  tone = 'catalogue',
  testID,
}: {
  presentation: ModuleInstallPresentation
  productName: string
  onPress?: () => void
  compact?: boolean
  fullWidth?: boolean
  loading?: boolean
  tone?: 'catalogue' | 'product'
  testID?: string
}) {
  const {colours, radius, spacing} = useThemeTokens()
  const label = presentation.primaryAction
  const soon = label === 'Soon'
  const blocked = label === 'Can’t install on this device'
  const shown = soon ? 'Coming Soon' : blocked ? 'Unavailable' : label
  const primary = shown === 'Install' || shown === 'Update'
  const disabled = soon || loading || (!presentation.installable && shown === 'Install')
  const productTone = tone === 'product' && !soon
  const backgroundColor = soon
    ? 'transparent'
    : productTone
      ? colours.text
    : primary
      ? colours.accent
      : colours.surface
  const borderColor = soon || primary || productTone ? 'transparent' : colours.border
  const labelColour = soon
    ? colours.textTertiary
    : productTone
      ? colours.canvas
    : primary
      ? colours.accentForeground
      : colours.text

  return (
    <AppPressable
      accessibilityLabel={soon ? `${productName} coming soon` : `${shown} ${productName}`}
      accessibilityState={{disabled}}
      disabled={disabled}
      hitSlop={8}
      onPress={disabled ? undefined : onPress}
      testID={testID ?? `module-action-${shown.toLowerCase().replace(/\s+/g, '-')}`}
      style={[
        styles.capsule,
        compact && !fullWidth ? styles.compact : styles.regular,
        {
          backgroundColor,
          borderColor,
          borderRadius: radius.round,
          paddingHorizontal: compact && !fullWidth ? spacing[3] : spacing[4],
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          width: fullWidth ? '100%' : undefined,
          opacity: loading ? 0.7 : 1,
        },
      ]}>
      <AppText
        variant="buttonLabel"
        style={{
          color: labelColour,
          textAlign: 'center',
          fontWeight: primary || productTone ? '700' : '500',
        }}>
        {loading ? (shown === 'Install' ? 'Installing…' : shown === 'Update' ? 'Updating…' : `${shown}…`) : shown}
      </AppText>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  capsule: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  compact: {
    minHeight: 44,
    paddingVertical: 10,
  },
  regular: {
    minHeight: 44,
    paddingVertical: 10,
  },
})
