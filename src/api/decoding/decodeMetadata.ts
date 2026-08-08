import type {
  ApiCapabilities,
  ApiEnvironment,
  ApiMetadata,
  ApiRegistrationCapability,
  ApiRegistrationMode,
} from '@modula/api-contracts'

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

function decodeRegistrationMode(value: unknown): ApiRegistrationMode {
  const mode = asString(value, 'registration.mode')
  if (mode === 'open' || mode === 'invite-only' || mode === 'closed') return mode
  throw new Error('Invalid API registration mode.')
}

function decodeRegistration(value: unknown, capabilities: Record<string, unknown>): ApiRegistrationCapability {
  if (value === undefined || value === null) {
    if (typeof capabilities.inviteOnly === 'boolean') {
      return {
        mode: capabilities.inviteOnly ? 'invite-only' : 'open',
        emailVerificationRequired: true,
      }
    }
    return {
      mode: 'closed',
      emailVerificationRequired: true,
    }
  }
  const record = asRecord(value, 'metadata registration')
  return {
    mode: decodeRegistrationMode(record.mode),
    emailVerificationRequired: asBoolean(
      record.emailVerificationRequired,
      'registration.emailVerificationRequired',
    ),
  }
}

export function decodeApiMetadata(value: unknown): ApiMetadata {
  const record = asRecord(value, 'API metadata')
  const capabilitiesRecord = asRecord(record.capabilities, 'metadata capabilities')
  return {
    apiVersion: asString(record.apiVersion, 'apiVersion') as ApiMetadata['apiVersion'],
    protocolVersion: asString(
      record.protocolVersion,
      'protocolVersion',
    ) as ApiMetadata['protocolVersion'],
    environment: decodeEnvironment(record.environment),
    minimumClientVersion: asString(record.minimumClientVersion, 'minimumClientVersion'),
    registration: decodeRegistration(record.registration, capabilitiesRecord),
    capabilities: decodeCapabilities(capabilitiesRecord),
  }
}
