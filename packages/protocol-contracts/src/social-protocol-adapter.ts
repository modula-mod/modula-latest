/**
 * Future optional adapter boundary for public-social federation.
 * No runtime AT Protocol SDK is installed in Phase 5.
 */
export type SocialProtocolAdapterCapability =
  | 'public-post-federation'
  | 'public-follows'
  | 'account-linking'
  | 'import-export'
  | 'cross-posting'
  | 'portable-public-identity'

export type SocialProtocolAdapterStatus = {
  enabled: false
  protocol: 'atproto'
  capabilities: SocialProtocolAdapterCapability[]
  ownsPrivateData: false
}

export const DISABLED_ATPROTO_ADAPTER: SocialProtocolAdapterStatus = {
  enabled: false,
  protocol: 'atproto',
  capabilities: [],
  ownsPrivateData: false,
}
