import type {DemoProfile} from '@/types/social'

export const demoProfiles = {
  andrei: {
    id: 'profile-andrei',
    displayName: 'Andrei',
    handle: 'andrei.modula',
    bio: 'Building Modula as a profile-first operating environment for governed intelligence, modules, and social workflow.',
    avatarColour: '#369CAA',
    moduleCount: 14,
    followingCount: 248,
    followerCount: 1840,
  },
  gaia: {
    id: 'profile-gaia',
    displayName: 'Gaia',
    handle: 'gaia.modula',
    bio: 'Execution layer for local tools, chat surfaces, and assisted workflows.',
    avatarColour: '#2E9B64',
    moduleCount: 8,
    followingCount: 26,
    followerCount: 3290,
  },
  design: {
    id: 'profile-design',
    displayName: 'Jenny Wilson',
    handle: 'jenny.modula',
    bio: 'Interface patterns, theme inheritance, and premium OS-level surfaces.',
    avatarColour: '#9B6B43',
    moduleCount: 6,
    followingCount: 88,
    followerCount: 1220,
  },
  builders: {
    id: 'profile-builders',
    displayName: 'Builders',
    handle: 'builders.modula',
    bio: 'Experiments from people shaping modules, boards, automations, and social workflows.',
    avatarColour: '#5B7F95',
    moduleCount: 21,
    followingCount: 312,
    followerCount: 4080,
  },
  garden: {
    id: 'profile-garden',
    displayName: 'Digital Garden',
    handle: 'garden.modula',
    bio: 'Notes, links, knowledge trails, and saved ideas that grow into modules.',
    avatarColour: '#6A8F62',
    moduleCount: 9,
    followingCount: 141,
    followerCount: 980,
  },
} satisfies Record<string, DemoProfile>

export const currentDemoProfile = demoProfiles.andrei

export const storyProfiles = [
  currentDemoProfile,
  demoProfiles.gaia,
  demoProfiles.design,
  demoProfiles.builders,
  demoProfiles.garden,
] as const
