import {Platform} from 'react-native'

import {runtimeEnvironment} from '@/config/runtimeEnvironment'

/**
 * Shared AT Protocol OAuth constants. Native constructs the official Expo client;
 * web uses Modula server-mediated OAuth only.
 */

export const ATPROTO_NATIVE_REDIRECT_URI = 'modula://oauth/atproto'
export const ATPROTO_NATIVE_METADATA_URL =
  'https://modula.digital/oauth/atproto/native-client-metadata.json'
export const ATPROTO_WEB_METADATA_URL =
  'https://api.modula.digital/oauth/atproto/web-client-metadata.json'

/**
 * Matches `@atproto/oauth-client-expo` native custom-scheme rule
 * (`scheme:/path` with a single slash after the colon).
 */
export const CUSTOM_URI_SCHEME_REGEX = /^(?:[^.]+(?:\.[^.]+)+):\/(?:[^/].*)?$/

export const NATIVE_CLIENT_METADATA = {
  client_id: ATPROTO_NATIVE_METADATA_URL,
  client_name: 'Modula',
  client_uri: 'https://modula.digital',
  redirect_uris: [ATPROTO_NATIVE_REDIRECT_URI],
  scope: 'atproto',
  token_endpoint_auth_method: 'none' as const,
  response_types: ['code'] as ['code'],
  grant_types: ['authorization_code', 'refresh_token'] as [
    'authorization_code',
    'refresh_token',
  ],
  application_type: 'native' as const,
  dpop_bound_access_tokens: true,
}

export function isValidAtprotoNativeRedirectUri(uri: string): boolean {
  return (
    CUSTOM_URI_SCHEME_REGEX.test(ATPROTO_NATIVE_REDIRECT_URI) &&
    (uri === ATPROTO_NATIVE_REDIRECT_URI || uri.startsWith(`${ATPROTO_NATIVE_REDIRECT_URI}?`))
  )
}

export function expectedAtprotoClientKind(): 'web' | 'native' {
  return Platform.OS === 'web' ? 'web' : 'native'
}

export function atprotoOAuthApiBaseUrl(): string {
  return runtimeEnvironment.apiUrl ?? 'https://api.modula.digital'
}
