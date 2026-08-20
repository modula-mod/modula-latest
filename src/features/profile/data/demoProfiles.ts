import type {ModulaProfile} from '@/features/profile/contracts/profile'
import {demoIdentityClaims} from './demoIdentityClaims'

const updatedAt = '2026-07-16T09:00:00.000Z'

export const ownerProfileId = 'profile-andrei'

export const demoProfileRelations: {
  followers: Record<string, string[]>
  following: Record<string, string[]>
} = {
  followers: {
    'andrei.modula': ['profile-gaia', 'profile-design', 'profile-builders', 'profile-garden'],
    'gaia.modula': ['profile-andrei', 'profile-builders', 'profile-design'],
    'design.modula': ['profile-andrei', 'profile-gaia', 'profile-garden'],
    'builders.modula': ['profile-andrei', 'profile-gaia', 'profile-design', 'profile-garden'],
    'garden.modula': ['profile-andrei', 'profile-design'],
  },
  following: {
    'andrei.modula': ['profile-gaia', 'profile-design', 'profile-builders', 'profile-garden'],
    'gaia.modula': ['profile-andrei', 'profile-design'],
    'design.modula': ['profile-andrei', 'profile-builders', 'profile-garden'],
    'builders.modula': ['profile-andrei', 'profile-gaia', 'profile-design'],
    'garden.modula': ['profile-andrei', 'profile-design', 'profile-builders'],
  },
}

export const demoProfileList: ModulaProfile[] = [
  {
    id: ownerProfileId,
    handle: 'andrei.modula',
    displayName: 'Andrei',
    kind: 'person',
    bio: 'Building Modula - a modular Social Operating System where your profile becomes your platform.',
    pronouns: 'he/him',
    location: {
      label: 'United Kingdom',
      visibility: 'public',
    },
    website: {
      id: 'link-andrei-modula',
      label: 'Modula',
      url: 'https://modula.digital',
      domain: 'modula.digital',
      visibility: 'public',
    },
    followerCount: 1840,
    followingCount: 248,
    moduleCount: 14,
    postCount: 4,
    joinedAt: '2026-01-12T12:00:00.000Z',
    focusStatus: {
      id: 'focused',
      label: 'Focused',
      message: 'Building Profile OS',
      updatedAt,
    },
    identityClaims: demoIdentityClaims['profile-andrei'],
    links: [
      {
        id: 'link-andrei-github',
        label: 'GitHub',
        url: 'https://github.com/modula-labs',
        domain: 'github.com',
        visibility: 'public',
      },
      {
        id: 'link-andrei-updates',
        label: 'Build updates',
        url: 'https://modula.digital/updates',
        domain: 'modula.digital',
        visibility: 'public',
      },
    ],
    featuredModuleIds: ['module-vault-notes', 'module-tasks', 'module-crm', 'module-automations'],
    isFollowing: false,
    followsViewer: false,
  },
  {
    id: 'profile-gaia',
    handle: 'gaia.modula',
    displayName: 'Gaia',
    kind: 'professional',
    bio: 'AI and systems profile for local tools, execution layers and governed workflow previews.',
    location: {
      label: 'Runtime layer',
      visibility: 'public',
    },
    website: {
      id: 'link-gaia-runtime',
      label: 'GAIA runtime notes',
      url: 'https://modula.digital/gaia',
      domain: 'modula.digital',
      visibility: 'public',
    },
    followerCount: 3290,
    followingCount: 26,
    moduleCount: 8,
    postCount: 2,
    joinedAt: '2026-02-03T10:30:00.000Z',
    focusStatus: {
      id: 'available',
      label: 'Available',
      message: 'Local runtime preview',
      updatedAt,
    },
    identityClaims: demoIdentityClaims['profile-gaia'],
    links: [],
    featuredModuleIds: ['module-runtime-tools', 'module-automations'],
    isFollowing: true,
    followsViewer: true,
  },
  {
    id: 'profile-design',
    handle: 'design.modula',
    displayName: 'Jenny Wilson',
    kind: 'organisation',
    bio: 'Design organisation for theme inheritance, material rules and premium profile surfaces.',
    location: {
      label: 'Bali, Indonesia',
      visibility: 'public',
    },
    website: {
      id: 'link-design-guidelines',
      label: 'Design guidelines',
      url: 'https://modula.digital/design',
      domain: 'modula.digital',
      visibility: 'public',
    },
    followerCount: 1220,
    followingCount: 88,
    moduleCount: 6,
    postCount: 2,
    joinedAt: '2026-02-16T15:00:00.000Z',
    focusStatus: {
      id: 'live',
      label: 'Live',
      message: 'Publishing surface guidance',
      updatedAt,
    },
    identityClaims: demoIdentityClaims['profile-design'],
    links: [
      {
        id: 'link-design-library',
        label: 'Surface library',
        url: 'https://modula.digital/surfaces',
        domain: 'modula.digital',
        visibility: 'public',
      },
    ],
    featuredModuleIds: ['module-appearance-lab', 'module-guidelines'],
    isFollowing: true,
    followsViewer: true,
  },
  {
    id: 'profile-builders',
    handle: 'builders.modula',
    displayName: 'Builders',
    kind: 'team',
    bio: 'Developer community shaping modules, Boards, automations and governed social workflows.',
    location: {
      label: 'Modula community',
      visibility: 'public',
    },
    followerCount: 4080,
    followingCount: 312,
    moduleCount: 21,
    postCount: 1,
    joinedAt: '2026-03-04T11:15:00.000Z',
    focusStatus: {
      id: 'busy',
      label: 'Busy',
      message: 'Testing module SDK previews',
      updatedAt,
    },
    identityClaims: demoIdentityClaims['profile-builders'],
    links: [
      {
        id: 'link-builders-forum',
        label: 'Builder forum',
        url: 'https://modula.digital/builders',
        domain: 'modula.digital',
        visibility: 'public',
      },
    ],
    featuredModuleIds: ['module-sdk', 'module-marketplace'],
    isFollowing: true,
    followsViewer: true,
  },
  {
    id: 'profile-garden',
    handle: 'garden.modula',
    displayName: 'Digital Garden',
    kind: 'creator',
    bio: 'Creator profile for notes, media collections, public links and saved knowledge trails.',
    location: {
      label: 'Knowledge studio',
      visibility: 'public',
    },
    website: {
      id: 'link-garden-home',
      label: 'Garden notes',
      url: 'https://garden.modula.digital',
      domain: 'garden.modula.digital',
      visibility: 'public',
    },
    followerCount: 980,
    followingCount: 141,
    moduleCount: 9,
    postCount: 2,
    joinedAt: '2026-03-22T17:45:00.000Z',
    focusStatus: {
      id: 'away',
      label: 'Away',
      message: 'Collecting references',
      updatedAt,
    },
    identityClaims: demoIdentityClaims['profile-garden'],
    links: [
      {
        id: 'link-garden-newsletter',
        label: 'Newsletter',
        url: 'https://garden.modula.digital/newsletter',
        domain: 'garden.modula.digital',
        visibility: 'public',
      },
      {
        id: 'link-garden-shop',
        label: 'Shop',
        url: 'https://garden.modula.digital/shop',
        domain: 'garden.modula.digital',
        visibility: 'public',
      },
    ],
    featuredModuleIds: ['module-vault-notes', 'module-links'],
    isFollowing: true,
    followsViewer: false,
  },
]

export const demoProfilesByHandle = demoProfileList.reduce<Record<string, ModulaProfile>>(
  (acc, profile) => {
    acc[profile.handle] = profile
    return acc
  },
  {},
)

export const demoProfilesById = demoProfileList.reduce<Record<string, ModulaProfile>>(
  (acc, profile) => {
    acc[profile.id] = profile
    return acc
  },
  {},
)

export const demoOwnerProfile = demoProfilesById[ownerProfileId]
