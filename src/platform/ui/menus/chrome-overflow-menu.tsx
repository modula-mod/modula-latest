import {ChromeCircleButton} from '@/components/primitives/ChromeCircleButton'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

type ChromeOverflowMenuProps = {
  title?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
  accessibilityLabel?: string
}

/** Circular ⋯ menu trigger — Board / settings / secondary headers. */
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
        <ChromeCircleButton
          icon="more"
          accessibilityLabel={accessibilityLabel}
          pressable={false}
        />
      }
    />
  )
}
