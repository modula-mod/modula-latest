import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import type {ToolbarChrome} from '@/platform/ui/menus/toolbar-chrome'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ChromeIconMenuProps = {
  systemImage?: string
  /** Fallback Ionicon when SwiftUI Menu is unavailable. */
  icon?: AppIconName
  title?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
  accessibilityLabel: string
  /** Accepted for API parity with native; fallback trigger is always a plain glyph. */
  chrome?: ToolbarChrome
}

/**
 * Web / Android fallback — AppIcon trigger only (no nested glass Host).
 */
export function ChromeIconMenu({
  icon = 'more',
  title,
  actions,
  onAction,
  accessibilityLabel,
}: ChromeIconMenuProps) {
  const {colours} = useThemeTokens()
  return (
    <ModulaMenu
      accessibilityLabel={accessibilityLabel}
      title={title}
      actions={actions}
      onAction={onAction}
      trigger={<AppIcon name={icon} colour={colours.textSecondary} size={20} />}
    />
  )
}
