import type {AppIconName} from '@/components/primitives/AppIcon'
import {isDevelopmentBuild} from '@/lib/platform'

/**
 * Extensible account-panel destinations.
 * Sibling product-surface work can append routes (Marketplace, Lists, Help, Drafts)
 * without rewriting AdaptiveAccountPanel chrome.
 */
export type AccountPanelDestination = {
  id: string
  label: string
  route: string
  icon: AppIconName
  description: string
  /** When true, only shown in development builds. */
  devOnly?: boolean
}

const CORE_ACCOUNT_PANEL_DESTINATIONS: readonly AccountPanelDestination[] = [
  {
    id: 'board',
    label: 'Board',
    route: '/board',
    icon: 'board',
    description: 'Focus, modules, and recent activity',
  },
  {
    id: 'saved',
    label: 'Saved',
    route: '/saved',
    icon: 'saved',
    description: 'Posts, links, and module notes',
  },
  {
    id: 'messages',
    label: 'Messages',
    route: '/messages',
    icon: 'messages',
    description: 'Private conversation preview',
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    route: '/marketplace',
    icon: 'marketplace',
    description: 'Browse Modula tools and modules',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    route: '/settings/appearance',
    icon: 'appearance',
    description: 'Colour, accent, and materials',
  },
  {
    id: 'settings',
    label: 'Settings',
    route: '/settings',
    icon: 'settings',
    description: 'Account and shell preferences',
  },
  {
    id: 'developer',
    label: 'Developer',
    route: '/settings/developer',
    icon: 'developer',
    description: 'Diagnostics and local tools',
    devOnly: true,
  },
]

/** Extra destinations registered by product-surface expansions. */
const extraDestinations: AccountPanelDestination[] = []

export function registerAccountPanelDestination(
  destination: AccountPanelDestination,
): void {
  const index = extraDestinations.findIndex(item => item.id === destination.id)
  if (index >= 0) {
    extraDestinations[index] = destination
    return
  }
  extraDestinations.push(destination)
}

export function getAccountPanelDestinations(): AccountPanelDestination[] {
  const merged = [...CORE_ACCOUNT_PANEL_DESTINATIONS, ...extraDestinations]
  const seen = new Set<string>()
  return merged.filter(item => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    if (item.devOnly && !isDevelopmentBuild()) return false
    return true
  })
}
