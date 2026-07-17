/**
 * Handle rules for Greenfield accounts (authoritative handles, not AT handles).
 */

export const GREENFIELD_HANDLE_MIN_LENGTH = 3
export const GREENFIELD_HANDLE_MAX_LENGTH = 30

/** Canonical handle form is lowercase. */
export type GreenfieldHandle = string

export type GreenfieldHandleHistoryEntry = {
  handle: string
  accountId: string
  assignedAt: string
  releasedAt: string | null
}

export type GreenfieldHandleAvailability = {
  handle: string
  available: boolean
  reason?: 'invalid' | 'reserved' | 'taken'
}
