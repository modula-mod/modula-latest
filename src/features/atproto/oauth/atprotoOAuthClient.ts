/**
 * Default / web-safe AT Protocol OAuth helpers.
 * Native Metro resolves `atprotoOAuthClient.native.ts` which loads
 * `@atproto/oauth-client-expo`.
 */
export {
  ATPROTO_NATIVE_METADATA_URL,
  ATPROTO_NATIVE_REDIRECT_URI,
  ATPROTO_WEB_METADATA_URL,
  CUSTOM_URI_SCHEME_REGEX,
  atprotoOAuthApiBaseUrl,
  expectedAtprotoClientKind,
  isValidAtprotoNativeRedirectUri,
} from '@/features/atproto/oauth/atprotoOAuthClient.shared'

export function getAtprotoExpoOAuthClient(): null {
  return null
}
