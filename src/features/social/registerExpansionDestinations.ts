import {registerAccountPanelDestination} from '@/platform/ui/navigation/account-panel-destinations'

/**
 * Registers Phase 4.5 expansion destinations onto the shared destination registry.
 * NavigationDrawer merges these at render time; import once from root layout.
 * Preview-only entries are `devOnly` so production builds do not surface fake paths.
 */
export function registerExpansionAccountPanelDestinations(): void {
  const extras = [
    {
      id: 'customize',
      label: 'Customize',
      route: '/product/customize',
      icon: 'appearance' as const,
      description: 'Layout studios and optional surfaces',
      devOnly: true,
    },
    {
      id: 'lists',
      label: 'Lists',
      route: '/lists',
      icon: 'people' as const,
      description: 'Custom lists and feeds Preview',
      devOnly: true,
    },
    {
      id: 'collections',
      label: 'Collections',
      route: '/collections',
      icon: 'bookmark' as const,
      description: 'Saved collections Preview',
      devOnly: true,
    },
    {
      id: 'drafts',
      label: 'Drafts',
      route: '/drafts',
      icon: 'text' as const,
      description: 'Composer drafts Preview',
      devOnly: true,
    },
    {
      id: 'creator',
      label: 'Creator Studio',
      route: '/creator',
      icon: 'poll' as const,
      description: 'Insights and monetization Preview',
      devOnly: true,
    },
    {
      id: 'help',
      label: 'Help & Support',
      route: '/help',
      icon: 'info' as const,
      description: 'Local help articles',
      devOnly: true,
    },
    {
      id: 'accounts',
      label: 'Accounts',
      route: '/account/switcher',
      icon: 'switch' as const,
      description: 'Account switcher Preview',
      devOnly: true,
    },
  ]

  for (const destination of extras) {
    registerAccountPanelDestination(destination)
  }
}

registerExpansionAccountPanelDestinations()
