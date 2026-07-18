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
  {
    id: 'module-forge',
    name: 'Forge',
    description: 'Module Builder preview — create installable Modula packages visually.',
    longDescription:
      'Forge is the future Module Builder (Lovable/Bolt-class craft inside Modula). This pre-screen explains the pipeline: Builder → SDK → Fusion → Registry → Marketplace. No remote code generation or package publish runs in this build.',
    status: 'Gated',
    icon: 'developer',
    category: 'intelligence',
    capability: 'Builder · Registry · Marketplace',
    sellerId: 'seller-modula',
    tags: ['forge', 'builder', 'developer'],
    section: ['featured', 'forYou'],
  },
  {
    id: 'module-agents',
    name: 'Agents',
    description: 'Installable Gaia agents with explicit permission scopes.',
    longDescription:
      'Agents module Preview. Packages will extend Gaia with Summariser, Scheduler, CRM Analyst, and more. No model runtime or silent private-module access in this build.',
    status: 'Preview',
    icon: 'automation',
    category: 'intelligence',
    capability: 'Agents · Gaia · Scopes',
    sellerId: 'seller-modula',
    tags: ['agents', 'gaia', 'ai'],
    section: ['featured', 'forYou', 'new'],
  },
  {
    id: 'module-standards',
    name: 'Module Standards',
    description: 'Manifest, permissions, and boilerplate for Modula packages.',
    longDescription:
      'Standards card pointing builders to GreenfieldModuleManifest, module-standards docs, and templates/modula-module. Not an executable module.',
    status: 'Local',
    icon: 'developer',
    category: 'intelligence',
    capability: 'Standards · Manifest · Boilerplate',
    sellerId: 'seller-modula',
    tags: ['standards', 'manifest', 'boilerplate'],
    section: ['new'],
  },
  {
    id: 'module-calendar',
    name: 'Calendar',
    description: 'Scheduling and events on Board and profile tabs.',
    longDescription:
      'Calendar module preview for Profile-OS. No remote calendar sync is claimed in this build.',
    status: 'Preview',
    icon: 'event',
    category: 'productivity',
    capability: 'Calendar · Board · Profile tab',
    sellerId: 'seller-modula',
    tags: ['calendar', 'schedule'],
    section: ['featured', 'forYou'],
  },
  {
    id: 'module-files',
    name: 'Files',
    description: 'Personal and collaborative storage for Profile-OS.',
    longDescription:
      'Files module preview. Storage remains local/demo until Registry packages ship.',
    status: 'Preview',
    icon: 'storage',
    category: 'productivity',
    capability: 'Files · Board · Teams',
    sellerId: 'seller-modula',
    tags: ['files', 'storage'],
    section: ['new', 'forYou'],
  },
  {
    id: 'module-wallet',
    name: 'Wallet',
    description: 'DIMON and digital ownership UI — inactive until DIMON activates.',
    longDescription:
      'Wallet pre-screen only. No balances, transfers, or blockchain. See ADR-009.',
    status: 'Gated',
    icon: 'security',
    category: 'commerce',
    capability: 'Wallet · DIMON · Ownership',
    sellerId: 'seller-modula',
    tags: ['wallet', 'dimon'],
    section: ['forYou'],
  },
  {
    id: 'module-newsletter',
    name: 'Newsletter',
    description: 'Publishing and subscriber management for creators.',
    longDescription:
      'Newsletter module preview for creator Profile-OS. No email delivery in this build.',
    status: 'Preview',
    icon: 'messages',
    category: 'creative',
    capability: 'Newsletter · Creator · Profile tab',
    sellerId: 'seller-builders',
    tags: ['newsletter', 'creator'],
    section: ['new'],
  },
  {
    id: 'module-analytics',
    name: 'Analytics',
    description: 'Profile, content, business, and module statistics.',
    longDescription:
      'Analytics preview with seeded charts only — not a production metrics backend.',
    status: 'Preview',
    icon: 'poll',
    category: 'commerce',
    capability: 'Analytics · Creator · Teams',
    sellerId: 'seller-modula',
    tags: ['analytics', 'insights'],
    section: ['featured'],
  },
  {
    id: 'module-communities',
    name: 'Communities',
    description: 'Groups, forums, and membership spaces.',
    longDescription:
      'Communities module preview tied to /communities surfaces. Membership is local Preview.',
    status: 'Local',
    icon: 'community',
    category: 'social',
    capability: 'Communities · Forums · Membership',
    sellerId: 'seller-builders',
    tags: ['communities', 'social'],
    section: ['featured', 'forYou'],
  },
  {
    id: 'module-media',
    name: 'Media Studio',
    description: 'Video, music, galleries, and creator content tools.',
    longDescription:
      'Media module foreshadow. Short-form remains under /reels and Presence studio.',
    status: 'Preview',
    icon: 'photo',
    category: 'creative',
    capability: 'Media · Reels · Galleries',
    sellerId: 'seller-garden',
    tags: ['media', 'video'],
    section: ['new'],
  },
  {
    id: 'module-mail',
    name: 'Mail',
    description: 'Connected or Modula-native email experiences.',
    longDescription:
      'Mail module planned. Integrates with External Integrations / Elements later.',
    status: 'Gated',
    icon: 'messages',
    category: 'productivity',
    capability: 'Mail · Integrations',
    sellerId: 'seller-modula',
    tags: ['mail', 'email'],
    section: ['forYou'],
  },
  {
    id: 'module-commerce',
    name: 'Commerce',
    description: 'Products, services, subscriptions, and payments.',
    longDescription:
      'Commerce module preview. Settlements require DIMON later — no fake checkout.',
    status: 'Gated',
    icon: 'marketplace',
    category: 'commerce',
    capability: 'Commerce · Marketplace · DIMON',
    sellerId: 'seller-builders',
    tags: ['commerce', 'payments'],
    section: ['featured'],
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
