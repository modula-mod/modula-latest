import {ActionSheetIOS, Alert, Platform} from 'react-native'

import {flattenModulaActions} from '@/platform/ui/menus/flatten-actions'
import {getActionLabel} from '@/platform/ui/menus/action-label'
import type {
  ModulaActionItem,
  PresentModulaActionsOptions,
} from '@/platform/ui/menus/types'

/**
 * Imperative overflow / More menu.
 * Uses ActionSheetIOS on iOS and Alert buttons elsewhere until Phase 4.5
 * swaps the body for `@expo/ui` ContextMenu / Menu hosts.
 * Nested submenus and pickers flatten into a single list.
 * Product screens should call this (or Modula wrappers) — never import SwiftUI.
 */
export function presentModulaActions(
  options: PresentModulaActionsOptions,
): Promise<string | null> {
  const cancelLabel = options.cancelLabel ?? 'Cancel'
  const visibleActions = flattenModulaActions(options.actions).filter(
    action => !action.disabled || action.disabledReason,
  )

  if (Platform.OS === 'ios') {
    return presentIosActionSheet(options, visibleActions, cancelLabel)
  }

  return presentAlertActions(options, visibleActions, cancelLabel)
}

function presentIosActionSheet(
  options: PresentModulaActionsOptions,
  actions: ModulaActionItem[],
  cancelLabel: string,
): Promise<string | null> {
  return new Promise(resolve => {
    const labels = [...actions.map(getActionLabel), cancelLabel]
    const cancelButtonIndex = labels.length - 1
    const destructiveButtonIndex = actions.findIndex(
      action => !action.disabled && action.style === 'destructive',
    )

    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: options.title,
        message: options.message,
        options: labels,
        cancelButtonIndex,
        destructiveButtonIndex:
          destructiveButtonIndex >= 0 ? destructiveButtonIndex : undefined,
      },
      buttonIndex => {
        if (buttonIndex === cancelButtonIndex || buttonIndex == null) {
          resolve(null)
          return
        }
        const selected = actions[buttonIndex]
        resolve(selected && !selected.disabled ? selected.id : null)
      },
    )
  })
}

function presentAlertActions(
  options: PresentModulaActionsOptions,
  actions: ModulaActionItem[],
  cancelLabel: string,
): Promise<string | null> {
  return new Promise(resolve => {
    Alert.alert(
      options.title ?? 'Actions',
      options.message,
      [
        ...actions.map(action => ({
          text: getActionLabel(action),
          style:
            !action.disabled && action.style === 'destructive'
              ? ('destructive' as const)
              : ('default' as const),
          onPress: () => resolve(action.disabled ? null : action.id),
        })),
        {
          text: cancelLabel,
          style: 'cancel' as const,
          onPress: () => resolve(null),
        },
      ],
      {cancelable: true, onDismiss: () => resolve(null)},
    )
  })
}
