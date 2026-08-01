import type {PresenceRailPerson} from '@/features/presence/contracts/presenceRail'

/**
 * Local Preview seed for the Stories dial.
 * First entry is always the starting story (index 0) — dial only rotates right.
 * Portrait URLs are stable preview placeholders (not a live Stories backend).
 */
export const PRESENCE_RAIL_SEED: PresenceRailPerson[] = [
  {
    id: 'you',
    name: 'You',
    fresh: false,
    colour: '#369CAA',
    uri: 'https://i.pravatar.cc/200?u=modula-story-you',
  },
  {
    id: 'maya',
    name: 'Maya Okonkwo',
    fresh: true,
    colour: '#2A6F78',
    uri: 'https://i.pravatar.cc/200?u=modula-story-maya',
  },
  {
    id: 'alex',
    name: 'Alex Rivera',
    fresh: true,
    colour: '#4A6670',
    uri: 'https://i.pravatar.cc/200?u=modula-story-alex',
  },
  {
    id: 'jordan',
    name: 'Jordan Lee',
    fresh: true,
    colour: '#5C7A84',
    uri: 'https://i.pravatar.cc/200?u=modula-story-jordan',
  },
  {
    id: 'sam',
    name: 'Sam Chen',
    fresh: true,
    colour: '#3D5A63',
    uri: 'https://i.pravatar.cc/200?u=modula-story-sam',
  },
  {
    id: 'riley',
    name: 'Riley Park',
    fresh: false,
    colour: '#6B8A92',
    uri: 'https://i.pravatar.cc/200?u=modula-story-riley',
  },
  {
    id: 'noah',
    name: 'Noah Adeyemi',
    fresh: true,
    colour: '#2F5C64',
    uri: 'https://i.pravatar.cc/200?u=modula-story-noah',
  },
]
