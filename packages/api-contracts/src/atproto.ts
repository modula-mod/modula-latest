export type AtprotoClientKind = 'web' | 'native'

export type AtprotoConnectionStatus =
  | 'pending'
  | 'connected'
  | 'refreshRequired'
  | 'revoked'
  | 'disconnected'
  | 'error'

export type AtprotoConnectionDto = {
  id: string
  did: string
  handle: string
  pdsUrl: string
  status: AtprotoConnectionStatus
  grantedScopes: string[]
  connectedAt?: string | null
  refreshedAt?: string | null
  disconnectedAt?: string | null
  lastErrorCode?: string | null
  createdAt?: string
}

export type StartAtprotoConnectionInput = {
  handle?: string
  clientKind: AtprotoClientKind
  returnRoute: string
  requestScope?: 'atproto' | 'publish'
  scope?: 'atproto' | 'atproto transition:generic'
}

export type StartAtprotoConnectionResult = {
  authorizationUrl: string
  state: string
}

export type AtprotoPublicationMode = 'modulaOnly' | 'askEveryTime' | 'crossPostPublic'

export type AtprotoPublicationPreference = {
  enabled: boolean
  defaultMode: AtprotoPublicationMode
  publishProfileExtension: boolean
  publishModuleMetadata: boolean
}

export type AtprotoPublicationPreferencesDto = AtprotoPublicationPreference
export type PatchAtprotoPublicationPreferencesInput = Partial<AtprotoPublicationPreference>

export type AtprotoPublicationStatus =
  | 'pending'
  | 'publishing'
  | 'published'
  | 'updating'
  | 'deleting'
  | 'deleted'
  | 'failed'
  | 'revoked'

export type AtprotoPublicationDto = {
  id: string
  localRecordType: string
  localRecordId: string
  collection: string
  atUri?: string | null
  cid?: string | null
  status: AtprotoPublicationStatus
  lastErrorCode?: string | null
  publishedAt?: string
  createdAt?: string
}

export type SocialRecordOrigin = 'modula' | 'atproto' | 'modula+atproto'

export type AtmosphereFeedMode = 'connected' | 'following' | 'modula-network'

export type AtmosphereFeedItemDto = {
  id: string
  origin: SocialRecordOrigin
  did?: string
  handle?: string
  text?: string
  createdAt: string
  collection?: string
  uri?: string
}

export type AtprotoFeedItemDto = {
  uri: string
  cid: string
  did: string
  collection: string
  indexedAt: string
  record: Record<string, unknown>
}
