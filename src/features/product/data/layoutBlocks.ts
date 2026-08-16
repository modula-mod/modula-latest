import type {AppIconName} from '@/components/primitives/AppIcon'
import type {ModulaTabId} from '@/platform/ui/navigation/modula-tabs'

export type LayoutSlot = 'home' | 'discover' | 'tabs' | 'activity' | 'profile'

export type LayoutBlock = {
  id: string
  slot: LayoutSlot
  label: string
  description: string
  icon: AppIconName
  /** Cannot be removed from the slot (still reorderable when allowed). */
  required?: boolean
}

export const HOME_LAYOUT_BLOCKS: readonly LayoutBlock[] = [
  {
    id: 'presence',
    slot: 'home',
    label: 'Presence rail',
    description: 'Focus Halo people strip at the top of Home.',
    icon: 'people',
  },
  {
    id: 'focus-banner',
    slot: 'home',
    label: 'Focus banner',
    description: 'Shows when Focus Mode is active.',
    icon: 'contrast',
  },
  {
    id: 'merge-banner',
    slot: 'home',
    label: 'Merge Feeds banner',
    description: 'Entry to Merge Feeds when multiple sources are on.',
    icon: 'discover',
  },
  {
    id: 'mode-tabs',
    slot: 'home',
    label: 'Feed mode tabs',
    description: 'Following / For You / Modules switcher.',
    icon: 'home',
    required: true,
  },
  {
    id: 'composer',
    slot: 'home',
    label: 'Composer prompt',
    description: '“Start a post” identity row on Home.',
    icon: 'text',
  },
]

export const DISCOVER_LAYOUT_BLOCKS: readonly LayoutBlock[] = [
  {
    id: 'live',
    slot: 'discover',
    label: 'Live presence',
    description: 'Live room carousel Preview.',
    icon: 'play',
  },
  {
    id: 'reels',
    slot: 'discover',
    label: 'Reels preview',
    description: 'Short-form rail into Reels.',
    icon: 'camera',
  },
  {
    id: 'people',
    slot: 'discover',
    label: 'Suggested people',
    description: 'Follow suggestions with stacked faces.',
    icon: 'people',
  },
  {
    id: 'inspire',
    slot: 'discover',
    label: 'Inspire next',
    description: 'Communities and topics to explore.',
    icon: 'discover',
  },
  {
    id: 'topics',
    slot: 'discover',
    label: 'Trending topics',
    description: 'Topic pills and custom feeds entry.',
    icon: 'poll',
  },
  {
    id: 'communities',
    slot: 'discover',
    label: 'Communities',
    description: 'Community list rail.',
    icon: 'community',
  },
  {
    id: 'modules',
    slot: 'discover',
    label: 'Featured modules',
    description: 'Marketplace module highlights.',
    icon: 'modules',
  },
  {
    id: 'media',
    slot: 'discover',
    label: 'Media grid',
    description: 'Media tiles into Reels.',
    icon: 'photo',
  },
]

export const TAB_LAYOUT_BLOCKS: readonly LayoutBlock[] = [
  {
    id: 'home',
    slot: 'tabs',
    label: 'Home',
    description: 'Primary feed tab — always required.',
    icon: 'home',
    required: true,
  },
  {
    id: 'discover',
    slot: 'tabs',
    label: 'Discover',
    description: 'Search and discovery tab.',
    icon: 'discover',
  },
  {
    id: 'create',
    slot: 'tabs',
    label: 'Create',
    description: 'Central publishing action.',
    icon: 'create',
    required: true,
  },
  {
    id: 'activity',
    slot: 'tabs',
    label: 'Activity',
    description: 'Notifications and digests.',
    icon: 'activity',
    required: true,
  },
  {
    id: 'profile',
    slot: 'tabs',
    label: 'Profile',
    description: 'Your Profile-OS shell.',
    icon: 'profile',
    required: true,
  },
]

export const ACTIVITY_LAYOUT_BLOCKS: readonly LayoutBlock[] = [
  {
    id: 'digest',
    slot: 'activity',
    label: 'Digest strip',
    description: 'Counts + stacked faces above the list.',
    icon: 'activity',
  },
  {
    id: 'filter-pills',
    slot: 'activity',
    label: 'Filter pills',
    description: 'All / Replies / Mentions / Filters row.',
    icon: 'settings',
    required: true,
  },
  {
    id: 'unread-cards',
    slot: 'activity',
    label: 'Unread card wash',
    description: 'Raised background on unread rows.',
    icon: 'notifications',
  },
  {
    id: 'stagger-enter',
    slot: 'activity',
    label: 'Staggered enter',
    description: 'Section enter animations (respects Reduce Motion).',
    icon: 'motion',
  },
]

export const PROFILE_LAYOUT_BLOCKS: readonly LayoutBlock[] = [
  {
    id: 'posts',
    slot: 'profile',
    label: 'Posts',
    description: 'Core posts tab.',
    icon: 'comment',
    required: true,
  },
  {
    id: 'media',
    slot: 'profile',
    label: 'Media',
    description: 'Media grid tab.',
    icon: 'photo',
  },
  {
    id: 'about',
    slot: 'profile',
    label: 'About',
    description: 'Bio and profile facts.',
    icon: 'info',
  },
  {
    id: 'modules',
    slot: 'profile',
    label: 'Modules',
    description: 'Installed module surfaces.',
    icon: 'modules',
  },
  {
    id: 'links',
    slot: 'profile',
    label: 'Links',
    description: 'Link shelf tab.',
    icon: 'link',
  },
  {
    id: 'shop',
    slot: 'profile',
    label: 'Shop',
    description: 'Module Preview tab — Marketplace foreshadow.',
    icon: 'marketplace',
  },
  {
    id: 'agents',
    slot: 'profile',
    label: 'Agents',
    description: 'Scoped GAIA agents tab Preview.',
    icon: 'automation',
  },
]

export const DEFAULT_HOME_BLOCK_IDS = HOME_LAYOUT_BLOCKS.map(block => block.id)
export const DEFAULT_DISCOVER_BLOCK_IDS = DISCOVER_LAYOUT_BLOCKS.map(block => block.id)
export const DEFAULT_TAB_BAR_IDS = TAB_LAYOUT_BLOCKS.map(block => block.id) as ModulaTabId[]
export const DEFAULT_ACTIVITY_BLOCK_IDS = ACTIVITY_LAYOUT_BLOCKS.map(block => block.id)
/** Matches DEFAULT_PROFILE_PRESENTATION.enabledTabIds — shop/agents stay opt-in. */
export const DEFAULT_PROFILE_TAB_IDS = [
  'posts',
  'media',
  'about',
  'modules',
  'links',
] as const

export type ChromeDensity = 'compact' | 'comfortable' | 'airy'
export type MotionDensity = 'full' | 'reduced' | 'minimal'
export type SurfacePreviewId = 'solid' | 'glass' | 'minimal'

export function isBlockOn(ids: readonly string[], id: string): boolean {
  return ids.includes(id)
}

export function toggleOrderedId(
  ids: readonly string[],
  id: string,
  catalog: readonly LayoutBlock[],
): string[] {
  const block = catalog.find(item => item.id === id)
  if (block?.required) return [...ids]
  if (ids.includes(id)) return ids.filter(item => item !== id)
  return [...ids, id]
}

export function moveOrderedId(
  ids: readonly string[],
  id: string,
  direction: -1 | 1,
): string[] {
  const next = [...ids]
  const index = next.indexOf(id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= next.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function sanitizeOrderedIds(
  ids: unknown,
  catalog: readonly LayoutBlock[],
  fallback: readonly string[],
): string[] {
  const allowed = new Set(catalog.map(block => block.id))
  const required = catalog.filter(block => block.required).map(block => block.id)
  // Missing / non-array must use the product default — NOT "required only".
  // Otherwise migrating older AsyncStorage blobs (no tabBarIds key) silently
  // collapses the tab bar to Home + Profile.
  if (!Array.isArray(ids)) {
    return [...fallback]
  }
  const raw = ids.filter(
    (id): id is string => typeof id === 'string' && allowed.has(id),
  )
  const unique = [...new Set(raw)]
  for (const id of required) {
    if (!unique.includes(id)) unique.unshift(id)
  }
  return unique.length ? unique : [...fallback]
}
