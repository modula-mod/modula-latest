/**
 * Local Preview seed data for expansion surfaces.
 * Self-contained — no `@/demo/*` imports (Phase 4 UI verifier).
 */

export type SeededMessageThread = {
  id: string
  name: string
  handle: string
  preview: string
  timestamp: string
  unread: boolean
  pinned?: boolean
}

export type SeededList = {
  id: string
  name: string
  description: string
  memberCount: number
  kind: 'people' | 'feed'
}

export type SeededCollection = {
  id: string
  name: string
  description: string
  itemCount: number
}

export type SeededDraft = {
  id: string
  title: string
  excerpt: string
  updatedAt: string
}

export type SeededCommunity = {
  id: string
  name: string
  description: string
  membersLabel: string
  topic: string
}

export type HelpArticle = {
  id: string
  title: string
  summary: string
  body: string[]
}

export const seededMessageThreads: SeededMessageThread[] = [
  {
    id: 'msg-1',
    name: 'Design Systems',
    handle: 'design',
    preview: 'The profile hero feels calmer now — nice work.',
    timestamp: '12m',
    unread: true,
    pinned: true,
  },
  {
    id: 'msg-2',
    name: 'Builders Collective',
    handle: 'builders',
    preview: 'Want to pin Marketplace on the Board?',
    timestamp: '1h',
    unread: true,
  },
  {
    id: 'msg-3',
    name: 'Garden Labs',
    handle: 'garden',
    preview: 'Saved your Vault Notes trail for later.',
    timestamp: 'Yesterday',
    unread: false,
    pinned: true,
  },
  {
    id: 'msg-4',
    name: 'GAIA Preview',
    handle: 'gaia',
    preview: 'Automation handoff stays human-controlled.',
    timestamp: '2d',
    unread: false,
  },
]

export const seededSharePeople = seededMessageThreads

export const seededInterests = [
  'Design systems',
  'Native UI',
  'Modules',
  'Creator tools',
  'Local-first',
  'Accessibility',
]

export const seededCustomFeeds = [
  {
    id: 'feed-builders',
    name: 'Builders',
    description: 'People shipping Modula modules',
    pinned: true,
  },
  {
    id: 'feed-calm',
    name: 'Calm design',
    description: 'Surface and token posts',
    pinned: false,
  },
  {
    id: 'feed-modules',
    name: 'Module drops',
    description: 'Marketplace and install notes',
    pinned: false,
  },
]

export const seededLists: SeededList[] = [
  {
    id: 'list-builders',
    name: 'Builders',
    description: 'People shipping Modula modules and shells.',
    memberCount: 12,
    kind: 'people',
  },
  {
    id: 'list-design',
    name: 'Design quiet feed',
    description: 'Custom feed preview for surface and token posts.',
    memberCount: 8,
    kind: 'feed',
  },
  {
    id: 'list-marketplace',
    name: 'Marketplace watch',
    description: 'Creators and modules you are evaluating locally.',
    memberCount: 6,
    kind: 'people',
  },
]

export const seededCollections: SeededCollection[] = [
  {
    id: 'collection-later',
    name: 'Read later',
    description: 'Posts and links to revisit this week.',
    itemCount: 7,
  },
  {
    id: 'collection-modules',
    name: 'Module inspiration',
    description: 'Marketplace and Board ideas worth keeping.',
    itemCount: 4,
  },
  {
    id: 'collection-media',
    name: 'Media refs',
    description: 'Visual references from Discover media.',
    itemCount: 5,
  },
]

export const seededDrafts: SeededDraft[] = [
  {
    id: 'draft-1',
    title: 'Board focus note',
    excerpt: 'Pin Marketplace and Saved as first-run destinations…',
    updatedAt: 'Today · 4:12',
  },
  {
    id: 'draft-2',
    title: 'Creator studio intro',
    excerpt: 'Insights remain Preview until analytics backend exists…',
    updatedAt: 'Yesterday',
  },
  {
    id: 'draft-3',
    title: 'Translate preferences',
    excerpt: 'Prefer concise previews over full machine translation claims…',
    updatedAt: 'Mon',
  },
]

export const seededCommunities: SeededCommunity[] = [
  {
    id: 'community-builders',
    name: 'Builders',
    description: 'Module makers and workflow designers.',
    membersLabel: '1.2k local',
    topic: 'Modules',
  },
  {
    id: 'community-design',
    name: 'Design Systems',
    description: 'Tokens, surfaces, and profile presentation.',
    membersLabel: '860 local',
    topic: 'Design',
  },
  {
    id: 'community-wellbeing',
    name: 'Calm Tools',
    description: 'Gated wellbeing module discussions.',
    membersLabel: '420 local',
    topic: 'Wellbeing',
  },
  {
    id: 'topic-profile-os',
    name: 'Profile OS',
    description: 'Identity, presentation, and profile shell patterns.',
    membersLabel: '1.8k local',
    topic: 'Profile',
  },
  {
    id: 'topic-module-sdk',
    name: 'Module SDK',
    description: 'Manifest-first module surface experiments.',
    membersLabel: '820 local',
    topic: 'Modules',
  },
  {
    id: 'topic-composer-tools',
    name: 'Composer Tools',
    description: 'Media, polls, and marketplace tools in Composer.',
    membersLabel: '534 local',
    topic: 'Composer',
  },
  {
    id: 'topic-board-workflows',
    name: 'Board workflows',
    description: 'Pinned spaces and focus patterns on Board.',
    membersLabel: '416 local',
    topic: 'Board',
  },
  {
    id: 'topic-dimon-previews',
    name: 'DIMON previews',
    description: 'Local previews for future governed modules.',
    membersLabel: '208 local',
    topic: 'Modules',
  },
]

export const seededMuteWords = ['spam-demo', 'clickbait-local', 'crypto-shill-preview']

export const seededBlockedAccounts = [
  {id: 'blocked-1', name: 'Noise Bot', handle: 'noise.bot'},
  {id: 'blocked-2', name: 'Spoof Seller', handle: 'spoof.market'},
]

export const seededInnerCircle = [
  {id: 'circle-1', name: 'Design Systems', handle: 'design'},
  {id: 'circle-2', name: 'Builders Collective', handle: 'builders'},
  {id: 'circle-3', name: 'Garden Labs', handle: 'garden'},
]

export const helpArticles: HelpArticle[] = [
  {
    id: 'help-account-panel',
    title: 'Using the account panel',
    summary: 'Open personal destinations without leaving the tab shell.',
    body: [
      'Tap your avatar in the Home header to open the adaptive account panel.',
      'On iPhone it presents as a native sheet. Destinations close the panel and push a real screen.',
      'Developer Settings only appear in development builds.',
    ],
  },
  {
    id: 'help-marketplace',
    title: 'Marketplace Preview install',
    summary: 'Why install does not provision remote modules yet.',
    body: [
      'Marketplace browse and detail pages use a seeded local catalog.',
      'Preview install acknowledges intent only — Modula does not claim production install in Phase 4.5.',
      'Seller cards open local creator previews with that seller’s modules.',
    ],
  },
  {
    id: 'help-privacy',
    title: 'Mute words and blocked accounts',
    summary: 'Local Preview lists for Privacy & Safety.',
    body: [
      'Mute words and blocked accounts are seeded Preview pages.',
      'Changes are local session previews and are not synced to a backend yet.',
      'Report flows are multi-step explanations and do not send reports.',
    ],
  },
  {
    id: 'help-shortcuts',
    title: 'Keyboard shortcuts',
    summary: 'Web and iPad productivity shortcuts.',
    body: [
      'Open Keyboard shortcuts from Help on wide layouts.',
      'Shortcuts are documented for the local shell and do not require a desktop app.',
    ],
  },
]

export const whatsNewNotes = [
  {
    version: '0.1.0 · Phase 4.5',
    items: [
      'Native tabs: Home, Discover, Board, Activity, Profile',
      'Adaptive account panel with extensible destinations',
      'Marketplace browse, search, and module detail',
      'Settings hierarchy with Privacy, Notifications, Language, and more',
      'Messages, Lists, Collections, Drafts, Help, and Creator Studio previews',
    ],
  },
]

export function getHelpArticle(id: string): HelpArticle | undefined {
  return helpArticles.find(article => article.id === id)
}

export function getSeededList(id: string): SeededList | undefined {
  return seededLists.find(list => list.id === id)
}

export function getSeededCollection(id: string): SeededCollection | undefined {
  return seededCollections.find(collection => collection.id === id)
}

export function getSeededCommunity(id: string): SeededCommunity | undefined {
  return seededCommunities.find(community => community.id === id)
}

export function getSeededThread(id: string): SeededMessageThread | undefined {
  return seededMessageThreads.find(thread => thread.id === id)
}
