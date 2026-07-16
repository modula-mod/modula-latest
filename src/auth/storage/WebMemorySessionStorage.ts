import type {RefreshToken} from '@/auth/contracts'
import type {SessionStorage} from '@/auth/storage/SessionStorage'

export class WebMemorySessionStorage implements SessionStorage {
  private refreshToken: RefreshToken | null = null

  async getRefreshToken(): Promise<RefreshToken | null> {
    return this.refreshToken
  }

  async setRefreshToken(token: RefreshToken): Promise<void> {
    this.refreshToken = token
  }

  async clearRefreshToken(): Promise<void> {
    this.refreshToken = null
  }
}
