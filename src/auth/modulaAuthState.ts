import type {ModulaAuthState} from '@/auth/contracts/ModulaAuthState'
import type {SessionState} from '@/auth/contracts/Session'

/** Maps the full SessionState union onto the core ModulaAuthState product model. */
export function toModulaAuthState(session: SessionState): ModulaAuthState {
  switch (session.status) {
    case 'booting':
      return {status: 'loading'}
    case 'signedOut':
    case 'guest':
    case 'expired':
      return {status: 'signedOut'}
    case 'pendingVerification':
      return {status: 'pendingVerification', email: session.email}
    case 'signedIn':
      return {status: 'signedIn', account: session.greenfieldAccount}
    case 'refreshing':
      return {status: 'refreshing', account: session.greenfieldAccount}
    case 'suspended':
      return {status: 'suspended'}
    case 'error':
      return {status: 'error', code: session.code ?? 'unknown'}
  }
}
