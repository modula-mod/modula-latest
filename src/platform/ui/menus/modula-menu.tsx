import type {ReactNode} from 'react'

import {AppPressable} from '@/components/primitives/AppPressable'
import {presentModulaActions} from '@/platform/ui/menus/presentModulaActions'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

export type ModulaMenuProps = {
  trigger: ReactNode
  title?: string
  actions: ModulaActionItem[]
  onAction: (actionId: string) => void
  accessibilityLabel?: string
  disabled?: boolean
}

/**
 * Visible tap Menu. Uses the shared imperative action presenter so overflow
 * lists stay extensible (Translate and sibling post actions can append items).
 */
export function ModulaMenu({
  trigger,
  title,
  actions,
  onAction,
  accessibilityLabel = 'Open menu',
  disabled,
}: ModulaMenuProps) {
  return (
    <AppPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        void presentModulaActions({title, actions}).then(id => {
          if (id) onAction(id)
        })
      }}>
      {trigger}
    </AppPressable>
  )
}
