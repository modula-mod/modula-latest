import type {AppIconName} from '@/components/primitives/AppIcon'
import {
  ChromeGlassControlGroup,
  type ChromeGlassGroupItem,
} from '@/platform/ui/menus/chrome-glass-control-group'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

export type ModulaControlGroupAction = ModulaActionItem

type ModulaControlGroupProps = {
  label: string
  actions: ModulaControlGroupAction[]
  onAction: (actionId: string) => void
  overflowActions?: ModulaActionItem[]
}

/**
 * Legacy name — now the shared Home liquid-glass control group.
 * Prefer importing `ChromeGlassControlGroup` directly in new call sites.
 */
export function ModulaControlGroup({
  label,
  actions,
  onAction,
  overflowActions = [],
}: ModulaControlGroupProps) {
  const items: ChromeGlassGroupItem[] = [...actions, ...overflowActions].map(action => ({
    kind: 'button' as const,
    icon: (action.icon as AppIconName | undefined) ?? 'more',
    accessibilityLabel: action.accessibilityLabel ?? action.label,
    onPress: () => onAction(action.id),
  }))

  return <ChromeGlassControlGroup items={items.length ? items : [{
    kind: 'button',
    icon: 'more',
    accessibilityLabel: label,
    onPress: () => undefined,
  }]} />
}
