import {modulaIconDefinition} from '@/platform/ui/icons/modula-icon-registry'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

/** SF Symbol for a menu row, or undefined when the action has no icon. */
export function actionSystemImage(action: ModulaActionItem) {
  if (!action.icon) return undefined
  return modulaIconDefinition(action.icon).sf
}
