import {registerAccountPanelDestination} from '@/platform/ui/navigation/account-panel-destinations'

/**
 * Registers Phase 4.5 expansion destinations onto the shared destination registry.
 * NavigationDrawer merges these at render time; import once from root layout.
 */
export function registerExpansionAccountPanelDestinations(): void {
  const extras = [
    {
      id: 'lists',
      label: 'Lists',
      route: '/lists',
      icon: 'people' as const,
      description: 'Custom lists and feeds Preview',
    },
    {
      id: 'collections',
      label: 'Collections',
      route: '/collections',
      icon: 'bookmark' as const,
      description: 'Saved collections Preview',
    },
    {
      id: 'drafts',
      label: 'Drafts',
      route: '/drafts',
      icon: 'text' as const,
      description: 'Composer drafts Preview',
    },
    {
      id: 'creator',
      label: 'Creator Studio',
      route: '/creator',
      icon: 'poll' as const,
      description: 'Insights and monetization Preview',
    },
    {
      id: 'help',
      label: 'Help & Support',
      route: '/help',
      icon: 'info' as const,
      description: 'Local help articles',
    },
    {
      id: 'accounts',
      label: 'Accounts',
      route: '/account/switcher',
      icon: 'switch' as const,
      description: 'Account switcher Preview',
    },
  ]

  for (const destination of extras) {
    registerAccountPanelDestination(destination)
  }
}

registerExpansionAccountPanelDestinations()
