import {StyleSheet, View} from 'react-native'

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
  const {colours, controls, radius, spacing} = useThemeTokens()
  const label = presentation.primaryAction
  const soon = label === 'Soon'
  const blocked = label === 'Can’t install on this device'
  const shown = soon ? 'Coming Soon' : blocked ? 'Unavailable' : label === 'Install' ? 'Get' : label
  const primary = label === 'Install' || label === 'Update'
  const disabled = soon || loading || (!presentation.installable && label === 'Install')
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
        styles.target,
        {
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          minHeight: controls.touchTarget.minimum,
          width: fullWidth ? '100%' : undefined,
          opacity: loading ? 0.7 : 1,
        },
      ]}>
      <View
        style={[
          styles.capsule,
          {
            backgroundColor,
            borderColor,
            borderRadius: radius.round,
            minHeight:
              compact && !fullWidth
                ? controls.controlHeight.compact
                : controls.controlHeight.regular,
            paddingHorizontal: compact && !fullWidth ? spacing[3] : spacing[4],
            width: fullWidth ? '100%' : undefined,
          },
        ]}>
        <AppText
          variant="buttonLabel"
          style={{
            color: labelColour,
            textAlign: 'center',
            fontWeight: primary || productTone ? '700' : '500',
          }}>
          {loading ? (label === 'Install' ? 'Getting…' : label === 'Update' ? 'Updating…' : `${shown}…`) : shown}
        </AppText>
      </View>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  capsule: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingVertical: 6,
  },
  target: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
