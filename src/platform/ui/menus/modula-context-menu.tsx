import type {ReactNode} from 'react'

import {AppPressable} from '@/components/primitives/AppPressable'
import {presentModulaActions} from '@/platform/ui/menus/presentModulaActions'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

type ModulaContextMenuProps = {
  children: ReactNode
  title?: string
  actions: ModulaActionItem[]
  onAction: (actionId: string) => void
  accessibilityLabel?: string
  disabled?: boolean
}

/**
 * Long-press context menu host.
 * Action lists are data-driven so siblings can add Translate / overflow items
 * without rewriting product screens.
 */
export function ModulaContextMenu({
  children,
  title,
  actions,
  onAction,
  accessibilityLabel,
  disabled,
}: ModulaContextMenuProps) {
  return (
    <AppPressable
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onLongPress={() => {
        void presentModulaActions({title, actions}).then(id => {
          if (id) onAction(id)
        })
      }}>
      {children}
    </AppPressable>
  )
}
