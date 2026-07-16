import type {AccessToken} from '@/auth/contracts'

export class AccessTokenStore {
  private token: AccessToken | null = null

  get(): AccessToken | null {
    return this.token
  }

  set(token: AccessToken | null) {
    this.token = token
  }

  clear() {
    this.token = null
  }
}
