import type {SessionId} from '@/api/contracts/identifiers'
import type {ModulaAccount} from '@/domain/account'
import type {ModulaProfile} from '@/features/profile/contracts'

export type SessionStatus =
  | 'booting'
  | 'signedOut'
  | 'guest'
  | 'signedIn'
  | 'refreshing'
  | 'expired'
  | 'error'

export type BootingSession = {status: 'booting'}
export type GuestSession = {status: 'guest'}
export type SignedOutSession = {status: 'signedOut'; error?: string}
export type ExpiredSession = {status: 'expired'}
export type ErrorSession = {status: 'error'; message: string}

export type AuthenticatedSession = {
  status: 'signedIn'
  sessionId: SessionId
  account: ModulaAccount
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
  | AuthenticatedSession
  | RefreshingSession
  | ExpiredSession
  | ErrorSession
