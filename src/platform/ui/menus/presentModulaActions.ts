import {ActionSheetIOS, Alert, Platform} from 'react-native'

import type {
  ModulaActionItem,
  PresentModulaActionsOptions,
} from '@/platform/ui/menus/types'

/**
 * Imperative overflow / More menu.
 * Uses ActionSheetIOS on iOS and Alert buttons elsewhere until Phase 4.5
 * swaps the body for `@expo/ui` ContextMenu / Menu hosts.
 * Product screens should call this (or Modula wrappers) — never import SwiftUI.
 */
export function presentModulaActions(
  options: PresentModulaActionsOptions,
): Promise<string | null> {
  const cancelLabel = options.cancelLabel ?? 'Cancel'
  const actionable = options.actions.filter(action => !action.disabled)

  if (Platform.OS === 'ios') {
    return presentIosActionSheet(options, actionable, cancelLabel)
  }

  return presentAlertActions(options, actionable, cancelLabel)
}

function presentIosActionSheet(
  options: PresentModulaActionsOptions,
  actions: ModulaActionItem[],
  cancelLabel: string,
): Promise<string | null> {
  return new Promise(resolve => {
    const labels = [...actions.map(action => action.label), cancelLabel]
    const cancelButtonIndex = labels.length - 1
    const destructiveButtonIndex = actions.findIndex(
      action => action.style === 'destructive',
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
        resolve(actions[buttonIndex]?.id ?? null)
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
          text: action.label,
          style:
            action.style === 'destructive'
              ? ('destructive' as const)
              : ('default' as const),
          onPress: () => resolve(action.id),
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
