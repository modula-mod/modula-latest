import {StyleSheet} from 'react-native'

import type {ModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Compact product CTA. Teal only for the meaningful primary verb.
 * `Soon` is metadata, not a fake button.
 */
export function ModuleAction({
  presentation,
  productName,
  onPress,
  compact = true,
  fullWidth = false,
  loading = false,
  testID,
}: {
  presentation: ModuleInstallPresentation
  productName: string
  onPress?: () => void
  compact?: boolean
  fullWidth?: boolean
  loading?: boolean
  testID?: string
}) {
  const {spacing} = useThemeTokens()
  const label = presentation.primaryAction
  if (label === 'Soon') {
    return (
      <ModulaButton
        label="Soon"
        role="plain"
        disabled
        accessibilityLabel={`${productName} coming soon`}
        testID={testID}
        style={compact ? styles.compact : undefined}
      />
    )
  }
  if (label === 'Can’t install on this device') {
    return (
      <ModulaButton
        label="View"
        role="secondary"
        accessibilityLabel={`View ${productName}`}
        onPress={onPress}
        testID={testID}
        style={compact ? styles.compact : undefined}
      />
    )
  }
  const primary = label === 'Install' || label === 'Update' || label === 'Open' || label === 'Enable'
  return (
    <ModulaButton
      label={label}
      role={primary && label !== 'Open' && label !== 'Enable' ? 'primary' : 'secondary'}
      accessibilityLabel={`${label} ${productName}`}
      onPress={onPress}
      loading={loading}
      disabled={!presentation.installable && label === 'Install'}
      fullWidth={fullWidth}
      testID={testID}
      style={compact && !fullWidth ? [styles.compact, {paddingHorizontal: spacing[3]}] : undefined}
    />
  )
}

const styles = StyleSheet.create({
  compact: {
    minHeight: 36,
    paddingVertical: 6,
  },
})
