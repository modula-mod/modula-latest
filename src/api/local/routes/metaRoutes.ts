import type {LocalApiRoute} from '@/api/local/LocalApiRouter'

const LOCAL_META_CAPABILITIES = {
  publicRead: true,
  authentication: true,
  mutations: true,
  mediaUpload: false,
  atproto: false,
  modules: false,
  atprotoOAuth: false,
  atprotoPublishing: false,
  atprotoImport: false,
  pdsPilot: false,
} as const

export function createMetaRoutes(): LocalApiRoute[] {
  return [
    {
      method: 'GET',
      path: '/v1/meta',
      handler: () => ({
        apiVersion: 'v1' as const,
        protocolVersion: '0.1' as const,
        environment: 'development' as const,
        minimumClientVersion: '0.1.0',
        registration: {
          mode: 'open' as const,
          emailVerificationRequired: true,
        },
        // Local prototype keeps AT Protocol UI gated off until remote preview.
        capabilities: LOCAL_META_CAPABILITIES,
      }),
    },
  ]
}
