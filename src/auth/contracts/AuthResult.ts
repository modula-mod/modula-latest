import type {AuthenticatedSession} from '@/auth/contracts/Session'
import type {SessionTokenPair} from '@/auth/contracts/SessionTokens'

export type AuthResult = {
  session: AuthenticatedSession
  tokens: SessionTokenPair
}
