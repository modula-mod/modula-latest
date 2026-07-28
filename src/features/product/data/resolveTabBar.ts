import {
  MODULA_TABS,
  type ModulaTabDefinition,
  type ModulaTabId,
} from '@/platform/ui/navigation/modula-tabs'

const REQUIRED_ROOT_TAB_IDS: readonly ModulaTabId[] = [
  'home',
  'discover',
  'create',
  'activity',
  'profile',
]

/**
 * Ordered visible tabs from Customize → Tab bar prefs.
 * Always keeps the canonical Founder Alpha roots; optionally keeps the
 * currently selected route so migration does not strand an older route.
 */
export function resolveVisibleModulaTabs(
  tabBarIds: readonly string[],
  options?: {alwaysIncludeRouteName?: string | null},
): ModulaTabDefinition[] {
  const byId = new Map(MODULA_TABS.map(tab => [tab.id, tab]))
  const byRoute = new Map(MODULA_TABS.map(tab => [tab.routeName, tab]))
  const seen = new Set<ModulaTabId>()
  const ordered: ModulaTabDefinition[] = []

  for (const id of tabBarIds) {
    const tab = byId.get(id as ModulaTabId)
    if (!tab || seen.has(tab.id)) continue
    seen.add(tab.id)
    ordered.push(tab)
  }

  for (const required of REQUIRED_ROOT_TAB_IDS) {
    if (seen.has(required)) continue
    const tab = byId.get(required)
    if (!tab) continue
    seen.add(tab.id)
    ordered.unshift(tab)
  }

  const keepRoute = options?.alwaysIncludeRouteName
  if (keepRoute) {
    const selected = byRoute.get(keepRoute)
    if (selected && !seen.has(selected.id)) {
      ordered.push(selected)
    }
  }

  return ordered.length ? ordered : [...MODULA_TABS]
}

export function isTabEnabled(
  tabBarIds: readonly string[],
  tabId: ModulaTabId,
): boolean {
  if (REQUIRED_ROOT_TAB_IDS.includes(tabId)) return true
  return tabBarIds.includes(tabId)
}
