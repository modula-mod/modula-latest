import {Button} from 'konsta/react'

import type {ModulaButtonRole} from '@/platform/ui/buttons/button-role'

function buttonAppearance(role: ModulaButtonRole) {
  return {
    clear: role === 'quiet' || role === 'plain' || role === 'inline' || role === 'icon',
    outline: role === 'secondary' || role === 'glass',
  }
}

export function KonstaButton({
  accessibilityLabel,
  disabled,
  label,
  loading,
  onPress,
  role,
  size,
  testID,
}: {
  accessibilityLabel: string
  disabled: boolean
  label: string
  loading: boolean
  onPress?: () => void
  role: ModulaButtonRole
  size: 'compact' | 'regular' | 'prominent'
  testID?: string
}) {
  const appearance = buttonAppearance(role)
  return (
    <Button
      aria-busy={loading || undefined}
      aria-label={accessibilityLabel}
      className="modula-konsta-button"
      clear={appearance.clear}
      data-role={role}
      data-size={size}
      data-testid={testID}
      disabled={disabled}
      large={size === 'prominent'}
      onClick={onPress}
      outline={appearance.outline}
      rounded
      small={size === 'compact'}
      type="button">
      {loading ? `${label}…` : label}
    </Button>
  )
}
