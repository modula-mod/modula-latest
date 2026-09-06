import type {ModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {ModulaActionButton} from '@/platform/ui/buttons/modula-action-button'

/**
 * Product lifecycle composition. The geometry, press states and accessibility
 * contract live in the shared Modula action button.
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
  const label = presentation.primaryAction
  const soon = label === 'Soon'
  const blocked = label === 'Can’t install on this device'
  const shown = soon ? 'Coming Soon' : blocked ? 'Unavailable' : label === 'Install' ? 'Get' : label
  const primary = label === 'Install' || label === 'Update'
  const disabled = soon || loading || (!presentation.installable && label === 'Install')
  const productTone = tone === 'product' && !soon
  return (
    <ModulaActionButton
      accessibilityLabel={soon ? `${productName} coming soon` : `${shown} ${productName}`}
      disabled={disabled}
      emphasis={soon ? 'quiet' : productTone ? 'inverse' : primary ? 'primary' : 'neutral'}
      fullWidth={fullWidth}
      label={shown}
      loading={loading}
      loadingLabel={label === 'Install' ? 'Getting…' : label === 'Update' ? 'Updating…' : `${shown}…`}
      onPress={disabled ? undefined : onPress}
      size={compact && !fullWidth ? 'compact' : 'regular'}
      testID={testID ?? `module-action-${shown.toLowerCase().replace(/\s+/g, '-')}`}
    />
  )
}
