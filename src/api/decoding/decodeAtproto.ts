import type {
  AtmosphereFeedItemDto,
  AtmosphereFeedMode,
  AtprotoConnectionDto,
  AtprotoConnectionStatus,
  AtprotoPublicationMode,
  AtprotoPublicationPreference,
  SocialRecordOrigin,
  StartAtprotoConnectionResult,
} from '@modula/api-contracts'

import type {AtmosphereFeedPage, AtprotoOAuthCallbackResult} from '@/data/repositories/contracts/AtprotoRepository'
import {
  asArray,
  asBoolean,
  asIsoDate,
  asOptionalString,
  asRecord,
  asString,
  optional,
} from '@/api/decoding/validation'

const CONNECTION_STATUSES = new Set<AtprotoConnectionStatus>([
  'pending',
  'connected',
  'refreshRequired',
  'revoked',
  'disconnected',
  'error',
])

const PUBLICATION_MODES = new Set<AtprotoPublicationMode>([
  'modulaOnly',
  'askEveryTime',
  'crossPostPublic',
])

const ORIGINS = new Set<SocialRecordOrigin>(['modula', 'atproto', 'modula+atproto'])

const FEED_MODES = new Set<AtmosphereFeedMode>(['connected', 'following', 'modula-network'])

function decodeConnectionStatus(value: unknown): AtprotoConnectionStatus {
  const status = asString(value, 'connection status') as AtprotoConnectionStatus
  if (!CONNECTION_STATUSES.has(status)) {
    throw new Error('Invalid AT Protocol connection status.')
  }
  return status
}

function decodePublicationMode(value: unknown): AtprotoPublicationMode {
  const mode = asString(value, 'publication mode') as AtprotoPublicationMode
  if (!PUBLICATION_MODES.has(mode)) {
    throw new Error('Invalid AT Protocol publication mode.')
  }
  return mode
}

function decodeOrigin(value: unknown): SocialRecordOrigin {
  const origin = asString(value, 'record origin') as SocialRecordOrigin
  if (!ORIGINS.has(origin)) {
    throw new Error('Invalid social record origin.')
  }
  return origin
}

function decodeFeedMode(value: unknown): AtmosphereFeedMode {
  const mode = asString(value, 'atmosphere mode') as AtmosphereFeedMode
  if (!FEED_MODES.has(mode)) {
    throw new Error('Invalid Atmosphere feed mode.')
  }
  return mode
}

export function decodeAtprotoConnection(value: unknown): AtprotoConnectionDto {
  const record = asRecord(value, 'AT Protocol connection')
  return {
    id: asString(record.id, 'connection id'),
    did: asString(record.did, 'connection did'),
    handle: asString(record.handle, 'connection handle'),
    pdsUrl: asString(record.pdsUrl, 'connection pdsUrl'),
    status: decodeConnectionStatus(record.status),
    grantedScopes: asArray(record.grantedScopes, 'grantedScopes', item =>
      asString(item, 'granted scope'),
    ),
    connectedAt: optional(record.connectedAt, item => asIsoDate(item, 'connectedAt')) ?? null,
    refreshedAt: optional(record.refreshedAt, item => asIsoDate(item, 'refreshedAt')) ?? null,
    disconnectedAt:
      optional(record.disconnectedAt, item => asIsoDate(item, 'disconnectedAt')) ?? null,
    lastErrorCode: asOptionalString(record.lastErrorCode, 'lastErrorCode') ?? null,
    createdAt: optional(record.createdAt, item => asIsoDate(item, 'createdAt')),
  }
}

export function decodeAtprotoConnectionList(value: unknown): AtprotoConnectionDto[] {
  const record = asRecord(value, 'AT Protocol connections')
  return asArray(record.items, 'connections items', decodeAtprotoConnection)
}

export function decodeStartAtprotoConnectionResult(value: unknown): StartAtprotoConnectionResult {
  const record = asRecord(value, 'AT Protocol OAuth start')
  return {
    authorizationUrl: asString(record.authorizationUrl, 'authorizationUrl'),
    state: asString(record.state, 'state'),
  }
}

export function decodeAtprotoOAuthCallbackResult(value: unknown): AtprotoOAuthCallbackResult {
  const record = asRecord(value, 'AT Protocol OAuth callback')
  return {
    connection: optional(record.connection, decodeAtprotoConnection),
    returnRoute: asOptionalString(record.returnRoute, 'returnRoute'),
    status: asOptionalString(record.status, 'callback status'),
  }
}

export function decodeAtprotoPreferences(value: unknown): AtprotoPublicationPreference {
  const record = asRecord(value, 'AT Protocol preferences')
  return {
    enabled: asBoolean(record.enabled, 'preferences.enabled'),
    defaultMode: decodePublicationMode(record.defaultMode),
    publishProfileExtension: asBoolean(
      record.publishProfileExtension,
      'preferences.publishProfileExtension',
    ),
    publishModuleMetadata: asBoolean(
      record.publishModuleMetadata,
      'preferences.publishModuleMetadata',
    ),
  }
}

export function decodeAtmosphereFeedItem(value: unknown): AtmosphereFeedItemDto {
  const record = asRecord(value, 'Atmosphere feed item')
  return {
    id: asString(record.id, 'atmosphere item id'),
    origin: decodeOrigin(record.origin),
    did: asOptionalString(record.did, 'atmosphere did'),
    handle: asOptionalString(record.handle, 'atmosphere handle'),
    text: asOptionalString(record.text, 'atmosphere text'),
    createdAt: asIsoDate(record.createdAt, 'atmosphere createdAt'),
    collection: asOptionalString(record.collection, 'atmosphere collection'),
    uri: asOptionalString(record.uri, 'atmosphere uri'),
  }
}

export function decodeAtmosphereFeedPage(value: unknown): AtmosphereFeedPage {
  const record = asRecord(value, 'Atmosphere feed')
  return {
    label: asString(record.label, 'atmosphere label'),
    mode: decodeFeedMode(record.mode),
    items: asArray(record.items, 'atmosphere items', decodeAtmosphereFeedItem),
  }
}
