import type {GreenfieldAccount} from '@modula/greenfield-contracts'

/**
 * Core Modula / Greenfield authentication states for the product shell.
 * Guest browsing and Phase 4 bootstrap helpers remain on SessionState.
 */
export type ModulaAuthState =
  | {status: 'loading'}
  | {status: 'signedOut'}
  | {status: 'pendingVerification'; email: string}
  | {status: 'signedIn'; account: GreenfieldAccount}
  | {status: 'refreshing'; account: GreenfieldAccount}
  | {status: 'suspended'}
  | {status: 'error'; code: string}
