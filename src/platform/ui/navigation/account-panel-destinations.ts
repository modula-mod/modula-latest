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
    description: 'Focus and pinned spaces',
  },
  {
    id: 'saved',
    label: 'Saved',
    route: '/saved',
    icon: 'saved',
    description: 'Posts, links, and notes',
  },
  {
    id: 'messages',
    label: 'Messages',
    route: '/messages',
    icon: 'messages',
    description: 'Private conversations',
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    route: '/marketplace',
    icon: 'marketplace',
    description: 'Browse modules and tools',
  },
  {
    id: 'product',
    label: 'Product Hub',
    route: '/product',
    icon: 'discover',
    description: 'Everything Modula offers',
  },
  {
    id: 'focus',
    label: 'Focus Mode',
    route: '/product/focus',
    icon: 'contrast',
    description: 'Quiet the shell',
  },
  {
    id: 'forge',
    label: 'Forge Builder',
    route: '/product/forge',
    icon: 'developer',
    description: 'Draft module manifests',
  },
  {
    id: 'agents',
    label: 'Agents',
    route: '/product/agents',
    icon: 'automation',
    description: 'Gaia agent packages',
  },
  {
    id: 'search',
    label: 'Search',
    route: '/product/search',
    icon: 'search',
    description: 'Capabilities and modules',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    route: '/settings/appearance',
    icon: 'appearance',
    description: 'Colour mode and accent',
  },
  {
    id: 'settings',
    label: 'Settings',
    route: '/settings',
    icon: 'settings',
    description: 'Account preferences',
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
