import {
  MODULA_TABS,
  type ModulaTabDefinition,
  type ModulaTabId,
} from '@/platform/ui/navigation/modula-tabs'

/**
 * Ordered visible tabs from Customize → Tab bar prefs.
 * Always keeps home + profile; optionally keeps the currently selected route
 * so a just-hidden tab remains reachable until the user navigates away.
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

  for (const required of ['home', 'profile'] as const) {
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
  if (tabId === 'home' || tabId === 'profile') return true
  return tabBarIds.includes(tabId)
}
