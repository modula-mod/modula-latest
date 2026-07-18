export type PresenceRailPerson = {
  id: string
  name: string
  /** Optional avatar URL — omitted uses initials. */
  uri?: string
  /** Fresh / unread presence ring. */
  fresh: boolean
  /** Cover / accent fallback for initials avatar. */
  colour?: string
}

/**
 * Local Preview seed for the Presence rail.
 * Not a live Stories backend — Focus Halo + presence craft only.
 */
export const PRESENCE_RAIL_SEED: PresenceRailPerson[] = [
  {
    id: 'maya',
    name: 'Maya Okonkwo',
    fresh: true,
    colour: '#2A6F78',
  },
  {
    id: 'alex',
    name: 'Alex Rivera',
    fresh: true,
    colour: '#4A6670',
  },
  {
    id: 'jordan',
    name: 'Jordan Lee',
    fresh: true,
    colour: '#5C7A84',
  },
  {
    id: 'you',
    name: 'You',
    fresh: false,
    colour: '#369CAA',
  },
  {
    id: 'sam',
    name: 'Sam Chen',
    fresh: true,
    colour: '#3D5A63',
  },
  {
    id: 'riley',
    name: 'Riley Park',
    fresh: false,
    colour: '#6B8A92',
  },
  {
    id: 'noah',
    name: 'Noah Adeyemi',
    fresh: true,
    colour: '#2F5C64',
  },
]
