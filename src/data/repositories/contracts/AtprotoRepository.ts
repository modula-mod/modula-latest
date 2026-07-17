import type {
  AtmosphereFeedItemDto,
  AtmosphereFeedMode,
  AtprotoConnectionDto,
  AtprotoPublicationPreference,
  PatchAtprotoPublicationPreferencesInput,
  StartAtprotoConnectionInput,
  StartAtprotoConnectionResult,
} from '@modula/api-contracts'

export type AtmosphereFeedPage = {
  label: string
  mode: AtmosphereFeedMode
  items: AtmosphereFeedItemDto[]
}

export type AtprotoOAuthCallbackResult = {
  connection?: AtprotoConnectionDto
  returnRoute?: string
  status?: string
}

export interface AtprotoRepository {
  listConnections(): Promise<AtprotoConnectionDto[]>
  getConnectionStatus(connectionId: string): Promise<AtprotoConnectionDto>
  startOAuth(input: StartAtprotoConnectionInput): Promise<StartAtprotoConnectionResult>
  completeOAuthCallback(query: Record<string, string>): Promise<AtprotoOAuthCallbackResult>
  disconnect(connectionId: string): Promise<void>
  refresh(connectionId: string): Promise<AtprotoConnectionDto>
  getPreferences(): Promise<AtprotoPublicationPreference>
  updatePreferences(
    input: PatchAtprotoPublicationPreferencesInput,
  ): Promise<AtprotoPublicationPreference>
  getAtmosphereFeed(input: {
    mode: AtmosphereFeedMode
    limit?: number
  }): Promise<AtmosphereFeedPage>
}
