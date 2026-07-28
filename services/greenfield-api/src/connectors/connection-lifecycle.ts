export {
  GREENFIELD_CONNECTION_STATES,
  GREENFIELD_CONNECTION_TRANSITIONS,
  assertGreenfieldConnectionTransition,
  canTransitionGreenfieldConnection,
  type GreenfieldConnectionState,
} from '@modula/greenfield-connector-contracts'

import {
  assertGreenfieldConnectionTransition,
  type GreenfieldConnectionState,
} from '@modula/greenfield-connector-contracts'

export function transitionGreenfieldConnectionState(
  current: GreenfieldConnectionState,
  next: GreenfieldConnectionState,
): GreenfieldConnectionState {
  assertGreenfieldConnectionTransition(current, next)
  return next
}
