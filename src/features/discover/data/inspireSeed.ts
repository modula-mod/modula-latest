/**
 * Local Preview seed for Discover “Inspire next” destinations.
 * Not a travel/product clone — Modula communities, topics, and surfaces.
 */
export type InspireDestination = {
  id: string
  title: string
  subtitle: string
  highlights: string[]
  colour: string
  href: string
}

export const INSPIRE_DESTINATIONS: InspireDestination[] = [
  {
    id: 'builders',
    title: 'Builders',
    subtitle: 'Community',
    highlights: ['Module makers', 'Workflow design circles'],
    colour: '#2A6F78',
    href: '/communities/community-builders',
  },
  {
    id: 'design-systems',
    title: 'Design Systems',
    subtitle: 'Community',
    highlights: ['Token craft', 'Profile presentation'],
    colour: '#4A6670',
    href: '/communities/community-design',
  },
  {
    id: 'profile-os',
    title: 'Profile OS',
    subtitle: 'Topic',
    highlights: ['Identity shells', 'Presence patterns'],
    colour: '#5C7A84',
    href: '/communities/topic-profile-os',
  },
  {
    id: 'composer-tools',
    title: 'Composer Tools',
    subtitle: 'Topic',
    highlights: ['Media tools', 'Marketplace attach'],
    colour: '#3D5A63',
    href: '/communities/topic-composer-tools',
  },
  {
    id: 'calm-tools',
    title: 'Calm Tools',
    subtitle: 'Community',
    highlights: ['Focus Mode', 'Quiet feed craft'],
    colour: '#2F5C64',
    href: '/communities/community-wellbeing',
  },
]

export type LivePresenceRoom = {
  id: string
  title: string
  host: string
  viewersLabel: string
  colour: string
  live: boolean
}

export const LIVE_PRESENCE_ROOMS: LivePresenceRoom[] = [
  {
    id: 'live-focus',
    title: 'Focus Halo office hours',
    host: 'Maya Okonkwo',
    viewersLabel: '128',
    colour: '#369CAA',
    live: true,
  },
  {
    id: 'live-modules',
    title: 'Module vault walkthrough',
    host: 'Builders',
    viewersLabel: '86',
    colour: '#2A6F78',
    live: true,
  },
  {
    id: 'live-design',
    title: 'Surface Type sketch night',
    host: 'Modula Design',
    viewersLabel: '54',
    colour: '#4A6670',
    live: true,
  },
  {
    id: 'live-presence',
    title: 'Presence rail craft',
    host: 'Jordan Lee',
    viewersLabel: '41',
    colour: '#5C7A84',
    live: false,
  },
]
