export type ModulaTabId = 'home' | 'discover' | 'board' | 'activity' | 'profile'

export type ModulaTabDefinition = {
  id: ModulaTabId
  routeName: string
  label: string
  sfSymbol: {
    default: string
    selected: string
  }
  materialSymbol: string
}

/** Single source of truth for native tabs and the web adaptive rail. */
export const MODULA_TABS: readonly ModulaTabDefinition[] = [
  {
    id: 'home',
    routeName: 'index',
    label: 'Home',
    sfSymbol: {default: 'house', selected: 'house.fill'},
    materialSymbol: 'home',
  },
  {
    id: 'discover',
    routeName: 'discover',
    label: 'Discover',
    sfSymbol: {default: 'safari', selected: 'safari.fill'},
    materialSymbol: 'explore',
  },
  {
    id: 'board',
    routeName: 'board',
    label: 'Board',
    sfSymbol: {default: 'square.grid.2x2', selected: 'square.grid.2x2.fill'},
    materialSymbol: 'dashboard',
  },
  {
    id: 'activity',
    routeName: 'activity',
    label: 'Activity',
    sfSymbol: {default: 'bell', selected: 'bell.fill'},
    materialSymbol: 'notifications',
  },
  {
    id: 'profile',
    routeName: 'profile',
    label: 'Profile',
    sfSymbol: {
      default: 'person.crop.circle',
      selected: 'person.crop.circle.fill',
    },
    materialSymbol: 'person',
  },
] as const

export function getModulaTab(id: ModulaTabId): ModulaTabDefinition {
  const tab = MODULA_TABS.find(item => item.id === id)
  if (!tab) {
    throw new Error(`Unknown Modula tab: ${id}`)
  }
  return tab
}
