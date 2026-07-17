/** Initial Greenfield collection identifiers (schema registry lands later). */
export const GREENFIELD_INITIAL_COLLECTIONS = [
  'modula.identity.profile',
  'modula.social.post',
  'modula.social.follow',
  'modula.social.like',
  'modula.social.save',
  'modula.social.repost',
  'modula.profile.link',
  'modula.profile.tab',
  'modula.modules.installation',
  'modula.extensions.preference',
] as const

export type GreenfieldInitialCollection = (typeof GREENFIELD_INITIAL_COLLECTIONS)[number]

export function isGreenfieldCollectionId(value: string): boolean {
  return value.length > 0 && !value.includes('://') && value.includes('.')
}
