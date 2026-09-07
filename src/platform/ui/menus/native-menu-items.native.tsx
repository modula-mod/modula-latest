import {Button, ContextMenu, Menu, Picker, Text} from '@expo/ui/swift-ui'
import {tag} from '@expo/ui/swift-ui/modifiers'
import type {ReactNode} from 'react'

import {getActionLabel} from '@/platform/ui/menus/action-label'
import {actionSystemImage} from '@/platform/ui/menus/action-system-image'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

function visibleActions(actions: ModulaActionItem[]): ModulaActionItem[] {
  return actions.filter(action => !action.disabled || action.disabledReason)
}

function buttonRole(action: ModulaActionItem) {
  return !action.disabled && action.style === 'destructive' ? ('destructive' as const) : undefined
}

function renderPicker(action: ModulaActionItem, onAction: (id: string) => void) {
  const picker = action.picker
  if (!picker) return null
  const systemImage = actionSystemImage(action)
  return (
    <Picker
      key={action.id}
      label={action.label}
      systemImage={systemImage}
      selection={picker.selectedId}
      onSelectionChange={selection => {
        if (typeof selection === 'string' && !action.disabled) onAction(selection)
      }}>
      {picker.options.map(option => (
        <Text key={option.id} modifiers={[tag(option.id)]}>
          {option.label}
        </Text>
      ))}
    </Picker>
  )
}

function renderLeafButton(action: ModulaActionItem, onAction: (id: string) => void) {
  const systemImage = action.checked ? 'checkmark' : actionSystemImage(action)
  return (
    <Button
      key={action.id}
      label={action.accessibilityLabel ?? getActionLabel(action)}
      systemImage={systemImage}
      role={buttonRole(action)}
      onPress={() => {
        if (!action.disabled) onAction(action.id)
      }}
    />
  )
}

/**
 * Nested ContextMenu + Picker + SF Symbol buttons for Expo UI ContextMenu.Items.
 */
export function renderContextMenuItems(
  actions: ModulaActionItem[],
  onAction: (id: string) => void,
): ReactNode {
  return visibleActions(actions).map(action => {
    if (action.picker) return renderPicker(action, onAction)
    if (action.children?.length) {
      const systemImage = actionSystemImage(action)
      return (
        <ContextMenu key={action.id}>
          <ContextMenu.Trigger>
            <Button
              label={action.accessibilityLabel ?? getActionLabel(action)}
              systemImage={systemImage}
            />
          </ContextMenu.Trigger>
          <ContextMenu.Items>
            {renderContextMenuItems(action.children, onAction)}
          </ContextMenu.Items>
        </ContextMenu>
      )
    }
    return renderLeafButton(action, onAction)
  })
}

/**
 * Nested Menu + Picker + SF Symbol buttons for Expo UI tap Menu.
 */
export function renderTapMenuItems(
  actions: ModulaActionItem[],
  onAction: (id: string) => void,
): ReactNode {
  return visibleActions(actions).map(action => {
    if (action.picker) return renderPicker(action, onAction)
    if (action.children?.length) {
      const systemImage = actionSystemImage(action)
      return (
        <Menu
          key={action.id}
          label={action.accessibilityLabel ?? getActionLabel(action)}
          systemImage={systemImage}>
          {renderTapMenuItems(action.children, onAction)}
        </Menu>
      )
    }
    return renderLeafButton(action, onAction)
  })
}
