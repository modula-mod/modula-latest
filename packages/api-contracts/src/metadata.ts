export type ApiEnvironment = 'preview' | 'production' | 'development'

export type ApiCapabilities = {
  publicRead: boolean
  authentication: boolean
  mutations: boolean
  mediaUpload: boolean
  atproto: boolean
  modules: boolean
}

export type ApiMetadata = {
  apiVersion: 'v1'
  protocolVersion: '0.1'
  environment: ApiEnvironment
  minimumClientVersion: string
  capabilities: ApiCapabilities
}

export const PHASE5_PREVIEW_CAPABILITIES: ApiCapabilities = {
  publicRead: true,
  authentication: false,
  mutations: false,
  mediaUpload: false,
  atproto: false,
  modules: false,
}
