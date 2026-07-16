import {Button, ControlGroup, Host, Menu} from '@expo/ui/swift-ui'
import type {ReactNode} from 'react'

import type {ModulaActionItem} from '@/platform/ui/menus/types'

export type ModulaControlGroupAction = ModulaActionItem & {
  systemImage?: string
}

type ModulaControlGroupProps = {
  /** Visible menu label when presenting as a Menu + ControlGroup cluster. */
  label: string
  systemImage?: string
  actions: ModulaControlGroupAction[]
  onAction: (actionId: string) => void
  /** Extra menu rows below the control group. */
  overflowActions?: ModulaActionItem[]
  children?: ReactNode
}

/**
 * Expo UI SwiftUI ControlGroup inside a Menu — compact horizontal action cluster.
 * Inspired by IMG_0319 module/plan card actions.
 */
export function ModulaControlGroup({
  label,
  systemImage = 'ellipsis.circle',
  actions,
  onAction,
  overflowActions = [],
}: ModulaControlGroupProps) {
  return (
    <Host matchContents>
      <Menu label={label} systemImage={systemImage}>
        <ControlGroup>
          {actions.map(action => (
            <Button
              key={action.id}
              label={action.label}
              systemImage={action.systemImage as never}
              role={action.style === 'destructive' ? 'destructive' : undefined}
              onPress={() => onAction(action.id)}
            />
          ))}
        </ControlGroup>
        {overflowActions.map(action => (
          <Button
            key={action.id}
            label={action.label}
            role={action.style === 'destructive' ? 'destructive' : undefined}
            onPress={() => onAction(action.id)}
          />
        ))}
      </Menu>
    </Host>
  )
}
