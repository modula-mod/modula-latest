import type {AppIconName} from '@/components/primitives/AppIcon'

/**
 * Seeded marketplace catalog for Phase 4.5 Preview surfaces.
 * Kept self-contained (no `@/demo/*` imports) so Phase 4 UI-source
 * verifiers stay green — demo seeds remain local-API only.
 */

export type MarketplaceCategory =
  | 'productivity'
  | 'intelligence'
  | 'commerce'
  | 'wellbeing'
  | 'creative'
  | 'social'

export type MarketplaceSeller = {
  id: string
  name: string
  handle: string
  bio: string
  moduleCount: number
}

export type MarketplaceModule = {
  id: string
  name: string
  description: string
  longDescription: string
  status: 'Featured' | 'New' | 'Preview' | 'Local' | 'Gated' | 'Simulated'
  icon: AppIconName
  category: MarketplaceCategory
  capability: string
  sellerId: string
  tags: string[]
  section: Array<'featured' | 'new' | 'forYou'>
}

export const marketplaceSellers: MarketplaceSeller[] = [
  {
    id: 'seller-modula',
    name: 'Modula Studio',
    handle: 'modula',
    bio: 'First-party tools for the Modula shell.',
    moduleCount: 6,
  },
  {
    id: 'seller-builders',
    name: 'Builders Collective',
    handle: 'builders',
    bio: 'Community modules for workflows and CRM.',
    moduleCount: 3,
  },
  {
    id: 'seller-garden',
    name: 'Garden Labs',
    handle: 'garden',
    bio: 'Calm creative and wellbeing experiments.',
    moduleCount: 2,
  },
]

export const marketplaceCatalog: MarketplaceModule[] = [
  {
    id: 'module-vault-notes',
    name: 'Vault Notes',
    description: 'Private notes that can attach to posts, Boards, and profile surfaces.',
    longDescription:
      'Private-first notes for social context. Preview install does not provision remote storage in Phase 4.5.',
    status: 'Featured',
    icon: 'saved',
    category: 'productivity',
    capability: 'Notes · Board · Saved',
    sellerId: 'seller-modula',
    tags: ['notes', 'productivity'],
    section: ['featured', 'forYou'],
  },
  {
    id: 'module-tasks',
    name: 'Tasks',
    description: 'Plan work from social context without leaving your profile OS.',
    longDescription:
      'Local task cards inspired by Board focus. No remote task sync is claimed in this build.',
    status: 'Local',
    icon: 'check',
    category: 'productivity',
    capability: 'Tasks · Board',
    sellerId: 'seller-modula',
    tags: ['tasks', 'productivity'],
    section: ['featured', 'forYou'],
  },
  {
    id: 'module-crm',
    name: 'CRM',
    description: 'Relationship memory for teams, builders, clients, and communities.',
    longDescription:
      'Seeded CRM preview for relationship context. Contacts are local demonstration data only.',
    status: 'Preview',
    icon: 'people',
    category: 'commerce',
    capability: 'CRM · People',
    sellerId: 'seller-builders',
    tags: ['crm', 'commerce'],
    section: ['featured'],
  },
  {
    id: 'module-health-agent',
    name: 'Health Agent',
    description: 'A gated wellbeing module preview with human-controlled activation.',
    longDescription:
      'Gated wellbeing preview. Activation remains human-controlled and is not connected to health backends.',
    status: 'Gated',
    icon: 'activity',
    category: 'wellbeing',
    capability: 'Wellbeing · Gated tools',
    sellerId: 'seller-garden',
    tags: ['wellbeing', 'gated'],
    section: ['forYou'],
  },
  {
    id: 'module-automations',
    name: 'Automations',
    description: 'Local workflow cards that can later become governed actions.',
    longDescription:
      'Simulated automation cards for workflow ideation. No unattended actions run in this build.',
    status: 'Simulated',
    icon: 'automation',
    category: 'intelligence',
    capability: 'Automations · Assist',
    sellerId: 'seller-modula',
    tags: ['automation', 'intelligence'],
    section: ['featured'],
  },
  {
    id: 'module-sticker-kit',
    name: 'Sticker Kit',
    description: 'Restrained reaction stickers for posts and DMs.',
    longDescription:
      'Local sticker/reaction picker preview. Stickers are not uploaded or shared outside this device.',
    status: 'New',
    icon: 'gif',
    category: 'creative',
    capability: 'Reactions · Composer tools',
    sellerId: 'seller-garden',
    tags: ['reactions', 'composer'],
    section: ['new', 'forYou'],
  },
  {
    id: 'module-lists-plus',
    name: 'Lists Plus',
    description: 'Custom feed collections with quiet ranking notes.',
    longDescription:
      'Preview custom lists and feeds. Ranking is seeded locally and does not claim a production algorithm.',
    status: 'Featured',
    icon: 'people',
    category: 'social',
    capability: 'Lists · Custom feeds',
    sellerId: 'seller-builders',
    tags: ['lists', 'feeds'],
    section: ['featured', 'forYou'],
  },
  {
    id: 'module-translate-lite',
    name: 'Translate Lite',
    description: 'On-device style translation preview for post text.',
    longDescription:
      'Ties into Modula’s translate preview. No remote translation API is called in this build.',
    status: 'Preview',
    icon: 'text',
    category: 'intelligence',
    capability: 'Translate · Accessibility',
    sellerId: 'seller-modula',
    tags: ['translate', 'language'],
    section: ['featured', 'new'],
  },
  {
    id: 'module-insights',
    name: 'Creator Insights',
    description: 'Local engagement charts for post analytics preview.',
    longDescription:
      'Shows seeded engagement metrics. Not connected to a production analytics backend.',
    status: 'New',
    icon: 'poll',
    category: 'commerce',
    capability: 'Analytics · Creator studio',
    sellerId: 'seller-modula',
    tags: ['analytics', 'creator'],
    section: ['new', 'forYou'],
  },
  {
    id: 'module-link-library',
    name: 'Link Library',
    description: 'Curated references attached to Boards and Saved.',
    longDescription:
      'Local link library preview for knowledge trails. External opens still use the safe URL helper.',
    status: 'Preview',
    icon: 'link',
    category: 'productivity',
    capability: 'Links · Saved',
    sellerId: 'seller-builders',
    tags: ['links', 'saved'],
    section: ['new'],
  },
]

export const marketplaceCategories: Array<{
  id: MarketplaceCategory | 'all'
  label: string
}> = [
  {id: 'all', label: 'All'},
  {id: 'productivity', label: 'Productivity'},
  {id: 'intelligence', label: 'Intelligence'},
  {id: 'commerce', label: 'Commerce'},
  {id: 'wellbeing', label: 'Wellbeing'},
  {id: 'creative', label: 'Creative'},
  {id: 'social', label: 'Social'},
]

export function getMarketplaceModule(id: string): MarketplaceModule | undefined {
  return marketplaceCatalog.find(module => module.id === id)
}

export function getMarketplaceSeller(id: string): MarketplaceSeller | undefined {
  return marketplaceSellers.find(seller => seller.id === id)
}

export function searchMarketplace(query: string): MarketplaceModule[] {
  const q = query.trim().toLowerCase()
  if (!q) return marketplaceCatalog
  return marketplaceCatalog.filter(module =>
    `${module.name} ${module.description} ${module.tags.join(' ')} ${module.category}`
      .toLowerCase()
      .includes(q),
  )
}

export function modulesForSeller(sellerId: string): MarketplaceModule[] {
  return marketplaceCatalog.filter(module => module.sellerId === sellerId)
}
