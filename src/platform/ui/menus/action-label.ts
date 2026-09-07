import type {ModulaActionItem} from '@/platform/ui/menus/types'

export function getActionLabel(action: ModulaActionItem): string {
  const label = action.checked === undefined ? action.label : `${action.label}, ${action.checked ? 'checked' : 'not checked'}`
  if (!action.disabled || !action.disabledReason) return label
  return `${label} unavailable — ${action.disabledReason}`
}
