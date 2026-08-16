import type {ModulaActionItem} from '@/platform/ui/menus/types'

/**
 * Flatten nested submenus and pickers into a single action-sheet list.
 * Used by web / Android / imperative presenters.
 */
export function flattenModulaActions(actions: ModulaActionItem[]): ModulaActionItem[] {
  const flattened: ModulaActionItem[] = []

  for (const action of actions) {
    if (action.picker) {
      for (const option of action.picker.options) {
        flattened.push({
          id: option.id,
          label: `${action.label}: ${option.label}`,
          accessibilityLabel: option.label,
          disabled: action.disabled,
          disabledReason: action.disabledReason,
          icon: action.icon,
        })
      }
      continue
    }

    if (action.children?.length) {
      for (const child of flattenModulaActions(action.children)) {
        flattened.push({
          ...child,
          label: `${action.label}: ${child.label}`,
        })
      }
      continue
    }

    flattened.push(action)
  }

  return flattened
}
