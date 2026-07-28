export type GreenfieldConnectionState =
  | 'available'
  | 'authorising'
  | 'connected'
  | 'refreshing'
  | 'degraded'
  | 'expired'
  | 'revoked'
  | 'disabled'
  | 'failed'
  | 'disconnected'

export const GREENFIELD_CONNECTION_STATES = [
  'available',
  'authorising',
  'connected',
  'refreshing',
  'degraded',
  'expired',
  'revoked',
  'disabled',
  'failed',
  'disconnected',
] as const

export const GREENFIELD_CONNECTION_TRANSITIONS: Record<GreenfieldConnectionState, readonly GreenfieldConnectionState[]> = {
  available: ['authorising'],
  authorising: ['connected', 'failed'],
  connected: ['refreshing', 'degraded', 'expired', 'revoked', 'disabled', 'disconnected'],
  refreshing: ['connected', 'expired', 'failed'],
  degraded: ['refreshing', 'disconnected', 'failed'],
  expired: ['authorising', 'disconnected'],
  revoked: ['authorising', 'disconnected'],
  disabled: ['connected', 'disconnected'],
  failed: ['authorising', 'disconnected'],
  disconnected: [],
}

export function canTransitionGreenfieldConnection(
  from: GreenfieldConnectionState,
  to: GreenfieldConnectionState,
): boolean {
  return GREENFIELD_CONNECTION_TRANSITIONS[from].includes(to)
}

export function assertGreenfieldConnectionTransition(
  from: GreenfieldConnectionState,
  to: GreenfieldConnectionState,
): void {
  if (!canTransitionGreenfieldConnection(from, to)) {
    throw new Error(`Invalid Greenfield connection transition: ${from} -> ${to}`)
  }
}
