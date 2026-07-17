import {ExpoOAuthClient} from '@atproto/oauth-client-expo'

import {
  ATPROTO_NATIVE_METADATA_URL,
  ATPROTO_NATIVE_REDIRECT_URI,
  ATPROTO_WEB_METADATA_URL,
  CUSTOM_URI_SCHEME_REGEX,
  NATIVE_CLIENT_METADATA,
  atprotoOAuthApiBaseUrl,
  expectedAtprotoClientKind,
  isValidAtprotoNativeRedirectUri,
} from '@/features/atproto/oauth/atprotoOAuthClient.shared'

/**
 * Official `@atproto/oauth-client-expo` entry for Modula (native).
 * Provider tokens remain server-side (ADR-007).
 */

export {
  ATPROTO_NATIVE_METADATA_URL,
  ATPROTO_NATIVE_REDIRECT_URI,
  ATPROTO_WEB_METADATA_URL,
  CUSTOM_URI_SCHEME_REGEX,
  ExpoOAuthClient,
  atprotoOAuthApiBaseUrl,
  expectedAtprotoClientKind,
  isValidAtprotoNativeRedirectUri,
}

let client: ExpoOAuthClient | null | undefined

export function getAtprotoExpoOAuthClient(): ExpoOAuthClient | null {
  if (client !== undefined) return client
  try {
    // Handle resolution stays server-mediated via Modula API; resolver URL is unused for
    // Modula's start/callback flow and must remain on the Modula domain for client policy.
    client = new ExpoOAuthClient({
      handleResolver: 'https://modula.digital',
      clientMetadata: NATIVE_CLIENT_METADATA,
    })
  } catch {
    // Native module / MMKV may be unavailable until a rebuild; still import ExpoOAuthClient.
    client = null
  }
  return client
}
