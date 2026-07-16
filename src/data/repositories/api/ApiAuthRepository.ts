import {decodeAuthResult, decodeAuthenticatedSession} from '@/api/decoding'
import type {ApiClient} from '@/api/client'
import type {AuthRepository} from '@/data/repositories/contracts'
import type {AccessToken, AuthResult, RefreshToken, RegisterAccountInput, SignInCredentials, AuthenticatedSession} from '@/auth/contracts'

export class ApiAuthRepository implements AuthRepository {
  constructor(private readonly client: ApiClient) {}

  signIn(credentials: SignInCredentials): Promise<AuthResult> {
    return this.client.post({path: '/v1/auth/sign-in', body: credentials}, decodeAuthResult)
  }

  register(input: RegisterAccountInput): Promise<AuthResult> {
    return this.client.post({path: '/v1/auth/register', body: input}, decodeAuthResult)
  }

  refresh(refreshToken: RefreshToken): Promise<AuthResult> {
    return this.client.post({path: '/v1/auth/refresh', body: {refreshToken}}, decodeAuthResult)
  }

  getSession(_accessToken: AccessToken): Promise<AuthenticatedSession> {
    return this.client.get({path: '/v1/auth/session', authenticated: true}, decodeAuthenticatedSession)
  }

  async signOut(refreshToken: RefreshToken | null): Promise<void> {
    await this.client.post({path: '/v1/auth/sign-out', body: {refreshToken}}, () => undefined)
  }
}
