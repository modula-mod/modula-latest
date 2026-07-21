import type {GreenfieldRecordVisibility} from '@modula/greenfield-contracts'

export const GREENFIELD_RECORD_VISIBILITIES: readonly GreenfieldRecordVisibility[] = [
  'public',
  'followers',
  'teams',
  'private',
  'system',
] as const

export function isPublicBridgeEligible(visibility: GreenfieldRecordVisibility): boolean {
  return visibility === 'public'
}

/** Private and system records must never enter public event streams or bridges. */
export function mustExcludeFromPublicStreams(visibility: GreenfieldRecordVisibility): boolean {
  return visibility === 'private' || visibility === 'system'
}
