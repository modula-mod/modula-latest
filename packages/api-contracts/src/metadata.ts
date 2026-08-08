export type ApiEnvironment = 'preview' | 'production' | 'development'
export type ApiRegistrationMode = 'open' | 'invite-only' | 'closed'

export type ApiRegistrationCapability = {
  mode: ApiRegistrationMode
  emailVerificationRequired: boolean
}

export type ApiCapabilities = {
  publicRead: boolean
  authentication: boolean
  mutations: boolean
  mediaUpload: boolean
  atproto: boolean
  modules: boolean
  atprotoOAuth: boolean
  atprotoPublishing: boolean
  atprotoImport: boolean
  pdsPilot: boolean
}

export type ApiMetadata = {
  apiVersion: 'v1'
  protocolVersion: '0.1'
  environment: ApiEnvironment
  minimumClientVersion: string
  registration: ApiRegistrationCapability
  capabilities: ApiCapabilities
}

export const PHASE5_PREVIEW_CAPABILITIES: ApiCapabilities = {
  publicRead: true,
  authentication: false,
  mutations: false,
  mediaUpload: false,
  atproto: false,
  modules: false,
  atprotoOAuth: false,
  atprotoPublishing: false,
  atprotoImport: false,
  pdsPilot: false,
}

export const PHASE6_PREVIEW_CAPABILITIES: ApiCapabilities = {
  publicRead: true,
  authentication: true,
  mutations: true,
  mediaUpload: true,
  atproto: true,
  modules: false,
  atprotoOAuth: true,
  atprotoPublishing: true,
  atprotoImport: true,
  pdsPilot: false,
}
