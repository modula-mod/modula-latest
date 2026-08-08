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
 * Native AT Protocol OAuth remains server-mediated for Phase 7H.
 * The optional `@atproto/oauth-client-expo` package is intentionally not part of
 * the core runtime because it pulls an incompatible Expo WebBrowser copy and is
 * untested on the New Architecture. Provider tokens remain server-side (ADR-007).
 */

export {
  ATPROTO_NATIVE_METADATA_URL,
  ATPROTO_NATIVE_REDIRECT_URI,
  ATPROTO_WEB_METADATA_URL,
  CUSTOM_URI_SCHEME_REGEX,
  atprotoOAuthApiBaseUrl,
  expectedAtprotoClientKind,
  isValidAtprotoNativeRedirectUri,
}

export function getAtprotoExpoOAuthClient(): null {
  void NATIVE_CLIENT_METADATA
  return null
}
