import type {ModulaActionItem} from '@/platform/ui/menus/types'

export function getActionLabel(action: ModulaActionItem): string {
  if (!action.disabled || !action.disabledReason) return action.label
  return `${action.label} unavailable — ${action.disabledReason}`
}
