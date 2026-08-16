import {Button, ControlGroup, Host, Menu} from '@expo/ui/swift-ui'
import type {ReactNode} from 'react'

import {modulaIconDefinition} from '@/platform/ui/icons/modula-icon-registry'
import {actionSystemImage} from '@/platform/ui/menus/action-system-image'
import {renderTapMenuItems} from '@/platform/ui/menus/native-menu-items'
import {toolbarIconModifiers} from '@/platform/ui/menus/toolbar-chrome-modifiers'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

export type ModulaControlGroupAction = ModulaActionItem

type ModulaControlGroupProps = {
  /** Visible menu label when presenting as a Menu + ControlGroup cluster. */
  label: string
  actions: ModulaControlGroupAction[]
  onAction: (actionId: string) => void
  /** Extra menu rows below the control group. */
  overflowActions?: ModulaActionItem[]
  children?: ReactNode
}

/**
 * Expo UI SwiftUI ControlGroup inside a Menu. Lab / rare clusters only.
 * Product screens should prefer a single overflow Menu or a long-press
 * context menu — do not nest this trigger inside a header capsule.
 */
export function ModulaControlGroup({
  label,
  actions,
  onAction,
  overflowActions = [],
}: ModulaControlGroupProps) {
  const triggerSymbol = modulaIconDefinition('more').sf

  return (
    <Host matchContents>
      <Menu
        label={label}
        systemImage={triggerSymbol}
        modifiers={toolbarIconModifiers('plain')}>
        <ControlGroup>
          {actions.map(action => (
            <Button
              key={action.id}
              label={action.label}
              systemImage={actionSystemImage(action)}
              role={action.style === 'destructive' ? 'destructive' : undefined}
              onPress={() => onAction(action.id)}
            />
          ))}
        </ControlGroup>
        {renderTapMenuItems(overflowActions, onAction)}
      </Menu>
    </Host>
  )
}
