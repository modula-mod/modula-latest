import {
  decodeAtmosphereFeedPage,
  decodeAtprotoConnection,
  decodeAtprotoConnectionList,
  decodeAtprotoOAuthCallbackResult,
  decodeAtprotoPreferences,
  decodeStartAtprotoConnectionResult,
} from '@/api/decoding/decodeAtproto'
import type {ApiClient} from '@/api/client'
import type {
  AtprotoRepository,
  AtmosphereFeedPage,
} from '@/data/repositories/contracts/AtprotoRepository'
import type {
  AtmosphereFeedMode,
  PatchAtprotoPublicationPreferencesInput,
  StartAtprotoConnectionInput,
} from '@modula/api-contracts'

export class ApiAtprotoRepository implements AtprotoRepository {
  constructor(private readonly client: ApiClient) {}

  listConnections() {
    return this.client.get(
      {path: '/v1/atproto/connections', authenticated: true},
      decodeAtprotoConnectionList,
    )
  }

  getConnectionStatus(connectionId: string) {
    return this.client.get(
      {
        path: `/v1/atproto/connections/${encodeURIComponent(connectionId)}/status`,
        authenticated: true,
      },
      decodeAtprotoConnection,
    )
  }

  startOAuth(input: StartAtprotoConnectionInput) {
    return this.client.post(
      {path: '/v1/atproto/oauth/start', body: input, authenticated: true},
      decodeStartAtprotoConnectionResult,
    )
  }

  completeOAuthCallback(query: Record<string, string>) {
    return this.client.get(
      {
        path: '/v1/atproto/oauth/callback',
        query,
        authenticated: true,
      },
      decodeAtprotoOAuthCallbackResult,
    )
  }

  async disconnect(connectionId: string) {
    await this.client.post(
      {
        path: `/v1/atproto/connections/${encodeURIComponent(connectionId)}/disconnect`,
        authenticated: true,
      },
      () => undefined,
    )
  }

  refresh(connectionId: string) {
    return this.client.post(
      {
        path: `/v1/atproto/connections/${encodeURIComponent(connectionId)}/refresh`,
        authenticated: true,
      },
      value => {
        const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
        return decodeAtprotoConnection(record.connection ?? value)
      },
    )
  }

  getPreferences() {
    return this.client.get(
      {path: '/v1/atproto/preferences', authenticated: true},
      decodeAtprotoPreferences,
    )
  }

  updatePreferences(input: PatchAtprotoPublicationPreferencesInput) {
    return this.client.patch(
      {path: '/v1/atproto/preferences', body: input, authenticated: true},
      decodeAtprotoPreferences,
    )
  }

  getAtmosphereFeed(input: {mode: AtmosphereFeedMode; limit?: number}): Promise<AtmosphereFeedPage> {
    return this.client.get(
      {
        path: '/v1/atproto/feed',
        query: {mode: input.mode, limit: input.limit},
      },
      decodeAtmosphereFeedPage,
    )
  }
}
