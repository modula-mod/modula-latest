import type {AccessToken, AuthResult, RefreshToken, RegisterAccountInput, SignInCredentials, AuthenticatedSession} from '@/auth/contracts'

export interface AuthRepository {
  signIn(credentials: SignInCredentials): Promise<AuthResult>
  register(input: RegisterAccountInput): Promise<AuthResult>
  refresh(refreshToken: RefreshToken): Promise<AuthResult>
  getSession(accessToken: AccessToken): Promise<AuthenticatedSession>
  signOut(refreshToken: RefreshToken | null): Promise<void>
}
