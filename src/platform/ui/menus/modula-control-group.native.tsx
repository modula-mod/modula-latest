import {Button, ControlGroup, Host, Menu} from '@expo/ui/swift-ui'
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers'
import type {ReactNode} from 'react'

import {modulaIconDefinition} from '@/platform/ui/icons/modula-icon-registry'
import {actionSystemImage} from '@/platform/ui/menus/action-system-image'
import {renderTapMenuItems} from '@/platform/ui/menus/native-menu-items'
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
 * Expo UI SwiftUI ControlGroup inside a circular glass Menu.
 * Compact horizontal icon row (Add / Favorite / Share) plus overflow items.
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
        modifiers={[
          buttonStyle('glass'),
          labelStyle('iconOnly'),
          buttonBorderShape('circle'),
          controlSize('large'),
        ]}>
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
