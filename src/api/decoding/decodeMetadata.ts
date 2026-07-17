import type {ApiCapabilities, ApiEnvironment, ApiMetadata} from '@modula/api-contracts'

import {asBoolean, asRecord, asString} from '@/api/decoding/validation'

function decodeEnvironment(value: unknown): ApiEnvironment {
  const environment = asString(value, 'metadata environment')
  if (environment === 'preview' || environment === 'production' || environment === 'development') {
    return environment
  }
  throw new Error('Invalid API environment.')
}

function decodeCapabilities(value: unknown): ApiCapabilities {
  const record = asRecord(value, 'metadata capabilities')
  return {
    publicRead: asBoolean(record.publicRead, 'capabilities.publicRead'),
    authentication: asBoolean(record.authentication, 'capabilities.authentication'),
    mutations: asBoolean(record.mutations, 'capabilities.mutations'),
    mediaUpload: asBoolean(record.mediaUpload, 'capabilities.mediaUpload'),
    atproto: asBoolean(record.atproto, 'capabilities.atproto'),
    modules: asBoolean(record.modules, 'capabilities.modules'),
    atprotoOAuth: asBoolean(record.atprotoOAuth, 'capabilities.atprotoOAuth'),
    atprotoPublishing: asBoolean(record.atprotoPublishing, 'capabilities.atprotoPublishing'),
    atprotoImport: asBoolean(record.atprotoImport, 'capabilities.atprotoImport'),
    pdsPilot: asBoolean(record.pdsPilot, 'capabilities.pdsPilot'),
  }
}

export function decodeApiMetadata(value: unknown): ApiMetadata {
  const record = asRecord(value, 'API metadata')
  return {
    apiVersion: asString(record.apiVersion, 'apiVersion') as ApiMetadata['apiVersion'],
    protocolVersion: asString(
      record.protocolVersion,
      'protocolVersion',
    ) as ApiMetadata['protocolVersion'],
    environment: decodeEnvironment(record.environment),
    minimumClientVersion: asString(record.minimumClientVersion, 'minimumClientVersion'),
    capabilities: decodeCapabilities(record.capabilities),
  }
}
