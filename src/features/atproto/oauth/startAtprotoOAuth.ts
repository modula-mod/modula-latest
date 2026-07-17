import * as WebBrowser from 'expo-web-browser'
import {Platform} from 'react-native'

import type {AtprotoRepository} from '@/data/repositories/contracts'
import {
  ATPROTO_NATIVE_REDIRECT_URI,
  expectedAtprotoClientKind,
  getAtprotoExpoOAuthClient,
} from '@/features/atproto/oauth/atprotoOAuthClient'
import {
  clearPendingAtprotoOAuthFlow,
  savePendingAtprotoOAuthFlow,
} from '@/features/atproto/oauth/pendingOAuthFlow'

WebBrowser.maybeCompleteAuthSession()

export type StartAtprotoOAuthInput = {
  atprotoRepository: AtprotoRepository
  handle?: string
  requestScope?: 'atproto' | 'publish'
  returnRoute?: string
}

export type StartAtprotoOAuthResult =
  | {status: 'success'; callbackUrl: string | null}
  | {status: 'cancelled'}
  | {status: 'failed'; message: string}

/**
 * Starts Modula-mediated AT Protocol OAuth using the official Expo OAuth client
 * surface and expo-web-browser auth session (same stack as ExpoOAuthClient.signIn).
 * Provider tokens are never returned to or stored by the app.
 */
export async function startAtprotoOAuth(
  input: StartAtprotoOAuthInput,
): Promise<StartAtprotoOAuthResult> {
  const returnRoute = input.returnRoute ?? '/settings/connections/atproto'
  const requestScope = input.requestScope ?? 'atproto'
  const clientKind = expectedAtprotoClientKind()

  // Ensure the official Expo client is constructed on native (crypto / scheme validation).
  if (clientKind === 'native') {
    getAtprotoExpoOAuthClient()
  }

  try {
    const started = await input.atprotoRepository.startOAuth({
      handle: input.handle,
      clientKind,
      returnRoute,
      requestScope,
    })

    await savePendingAtprotoOAuthFlow({
      state: started.state,
      returnRoute,
      requestScope,
      clientKind,
      expectedProvider: 'atproto',
      startedAt: new Date().toISOString(),
      authorizationUrl: started.authorizationUrl,
    })

    if (Platform.OS === 'web') {
      // Web follows authorizationUrl; callback is completed via API / redirect route.
      if (typeof window !== 'undefined') {
        window.location.assign(started.authorizationUrl)
      }
      return {status: 'success', callbackUrl: null}
    }

    const result = await WebBrowser.openAuthSessionAsync(
      started.authorizationUrl,
      ATPROTO_NATIVE_REDIRECT_URI,
    )

    if (result.type === 'cancel' || result.type === 'dismiss') {
      await clearPendingAtprotoOAuthFlow()
      return {status: 'cancelled'}
    }

    if (result.type === 'success' && result.url) {
      return {status: 'success', callbackUrl: result.url}
    }

    await clearPendingAtprotoOAuthFlow()
    return {status: 'failed', message: 'AT Protocol sign-in did not complete.'}
  } catch (error) {
    await clearPendingAtprotoOAuthFlow()
    return {
      status: 'failed',
      message:
        error instanceof Error ? error.message : 'Could not start AT Protocol connection.',
    }
  }
}
