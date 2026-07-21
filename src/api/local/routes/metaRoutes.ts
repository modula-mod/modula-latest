import {PHASE5_PREVIEW_CAPABILITIES} from '@modula/api-contracts'

import type {LocalApiRoute} from '@/api/local/LocalApiRouter'

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
        // Local prototype keeps AT Protocol UI gated off until remote preview.
        capabilities: {
          ...PHASE5_PREVIEW_CAPABILITIES,
          authentication: true,
          mutations: true,
        },
      }),
    },
  ]
}
