import type {ReactNode} from 'react'

import type {ModulaActionItem} from '@/platform/ui/menus/types'

/** Web stub — native menus are implemented in `native-menu-items.native.tsx`. */
export function renderContextMenuItems(
  _actions: ModulaActionItem[],
  _onAction: (id: string) => void,
): ReactNode {
  return null
}

export function renderTapMenuItems(
  _actions: ModulaActionItem[],
  _onAction: (id: string) => void,
): ReactNode {
  return null
}
