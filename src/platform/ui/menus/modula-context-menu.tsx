import type {ReactNode} from 'react'
import {Pressable} from 'react-native'

import {presentModulaActions} from '@/platform/ui/menus/presentModulaActions'
import type {ModulaActionItem, ModulaMenuFit} from '@/platform/ui/menus/types'

export type ModulaContextMenuProps = {
  children: ReactNode
  title?: string
  actions: ModulaActionItem[]
  onAction: (actionId: string) => void
  accessibilityLabel?: string
  disabled?: boolean
  fit?: ModulaMenuFit
}

/**
 * Long-press context menu host (web / Android fallback).
 * iOS uses Expo UI SwiftUI ContextMenu via `.native.tsx`.
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
    <Pressable
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onLongPress={() => {
        void presentModulaActions({title, actions}).then(id => {
          if (id) onAction(id)
        })
      }}>
      {children}
    </Pressable>
  )
}
