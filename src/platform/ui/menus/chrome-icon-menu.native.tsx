import {Button, Host, Menu} from '@expo/ui/swift-ui'
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers'

import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {isCallstackLiquidGlassNativeAvailable} from '@/platform/ui/navigation/liquid-glass-availability'
import {isNativeGlassRuntimeAvailable} from '@/theme/materials/nativeMaterial'

type ChromeIconMenuProps = {
  systemImage: string
  title?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
  accessibilityLabel: string
}

/**
 * Native SwiftUI Menu with a single glass SF Symbol — never nest ModulaIconButton.
 */
export function ChromeIconMenu({
  systemImage,
  actions,
  onAction,
  accessibilityLabel,
}: ChromeIconMenuProps) {
  const glassOk =
    isNativeGlassRuntimeAvailable() || isCallstackLiquidGlassNativeAvailable()
  const visibleActions = actions.filter(action => !action.disabled || action.disabledReason)

  return (
    <Host matchContents>
      <Menu
        label={accessibilityLabel}
        systemImage={systemImage as never}
        modifiers={[
          buttonStyle(glassOk ? 'glass' : 'bordered'),
          labelStyle('iconOnly'),
          buttonBorderShape('circle'),
          controlSize('regular'),
        ]}>
        {visibleActions.map(action => (
          <Button
            key={action.id}
            label={
              action.disabled && action.disabledReason
                ? `${action.label} unavailable — ${action.disabledReason}`
                : action.label
            }
            role={!action.disabled && action.style === 'destructive' ? 'destructive' : undefined}
            onPress={() => {
              if (!action.disabled) onAction(action.id)
            }}
          />
        ))}
      </Menu>
    </Host>
  )
}
