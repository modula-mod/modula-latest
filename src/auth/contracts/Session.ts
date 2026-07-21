import type {GreenfieldAccount} from '@modula/greenfield-contracts'

import type {SessionId} from '@/api/contracts/identifiers'
import type {ModulaAccount} from '@/domain/account'
import type {ModulaProfile} from '@/features/profile/contracts'

export type SessionStatus =
  | 'booting'
  | 'signedOut'
  | 'guest'
  | 'pendingVerification'
  | 'signedIn'
  | 'refreshing'
  | 'suspended'
  | 'expired'
  | 'error'

export type BootingSession = {status: 'booting'}
export type GuestSession = {status: 'guest'}
export type SignedOutSession = {status: 'signedOut'; error?: string}
export type PendingVerificationSession = {
  status: 'pendingVerification'
  email: string
  accountId?: string
  primaryHandle?: string
  /** Dev/preview only — never shown in production UI copy as a secret. */
  verificationToken?: string
}
export type SuspendedSession = {status: 'suspended'}
export type ExpiredSession = {status: 'expired'}
export type ErrorSession = {status: 'error'; message: string; code?: string}

export type AuthenticatedSession = {
  status: 'signedIn'
  sessionId: SessionId
  account: ModulaAccount
  greenfieldAccount: GreenfieldAccount
  profile: ModulaProfile
  accessTokenExpiresAt: string
}

export type RefreshingSession = Omit<AuthenticatedSession, 'status'> & {
  status: 'refreshing'
}

export type SessionState =
  | BootingSession
  | SignedOutSession
  | GuestSession
  | PendingVerificationSession
  | AuthenticatedSession
  | RefreshingSession
  | SuspendedSession
  | ExpiredSession
  | ErrorSession
