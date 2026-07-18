import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'

type ChromeOverflowMenuProps = {
  title?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
  accessibilityLabel?: string
}

/**
 * Native Menu (SwiftUI) with glass ellipsis trigger — not ActionSheet sheets.
 */
export function ChromeOverflowMenu({
  title,
  actions,
  onAction,
  accessibilityLabel = 'More actions',
}: ChromeOverflowMenuProps) {
  return (
    <ModulaMenu
      title={title}
      actions={actions}
      onAction={onAction}
      accessibilityLabel={accessibilityLabel}
      trigger={
        <ModulaIconButton
          icon="more"
          accessibilityLabel={accessibilityLabel}
          chrome="glass"
        />
      }
    />
  )
}
