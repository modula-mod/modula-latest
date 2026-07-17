import type {AtprotoConnectionDto} from '@modula/api-contracts'

import type {AtprotoRepository} from '@/data/repositories/contracts'
import {
  clearPendingAtprotoOAuthFlow,
  isPendingAtprotoOAuthExpired,
  markAtprotoOAuthStateConsumed,
  readPendingAtprotoOAuthFlow,
  wasAtprotoOAuthStateConsumed,
} from '@/features/atproto/oauth/pendingOAuthFlow'

export type CompleteAtprotoOAuthInput = {
  atprotoRepository: AtprotoRepository
  url: string
}

export type CompleteAtprotoOAuthResult =
  | {
      status: 'connected'
      connection?: AtprotoConnectionDto
      returnRoute: string
    }
  | {status: 'cancelled'; returnRoute: string}
  | {status: 'expired'; returnRoute: string}
  | {status: 'duplicate'; returnRoute: string}
  | {status: 'invalid'; message: string; returnRoute: string}
  | {status: 'failed'; message: string; returnRoute: string}

function parseCallbackParams(url: string): Record<string, string> {
  const params: Record<string, string> = {}
  try {
    const parsed = new URL(url)
    parsed.searchParams.forEach((value, key) => {
      params[key] = value
    })
    // Also support hash fragments if a provider returns them.
    if (parsed.hash.startsWith('#')) {
      const hash = new URLSearchParams(parsed.hash.slice(1))
      hash.forEach((value, key) => {
        if (!(key in params)) params[key] = value
      })
    }
  } catch {
    // Fall through with empty params.
  }
  return params
}

function assertNoTokensInParams(params: Record<string, string>) {
  for (const key of Object.keys(params)) {
    const lower = key.toLowerCase()
    if (
      lower.includes('access_token') ||
      lower.includes('refresh_token') ||
      lower === 'token' ||
      lower === 'id_token'
    ) {
      throw new Error('OAuth callback must not include tokens.')
    }
  }
}

/**
 * Completes the native redirect `modula://oauth/atproto` by validating pending
 * state / provider and calling Modula's server-mediated callback. Never persists tokens.
 */
export async function completeAtprotoOAuth(
  input: CompleteAtprotoOAuthInput,
): Promise<CompleteAtprotoOAuthResult> {
  const defaultReturn = '/settings/connections/atproto'
  const pending = await readPendingAtprotoOAuthFlow()
  const returnRoute = pending?.returnRoute ?? defaultReturn
  const params = parseCallbackParams(input.url)

  if (params.error === 'access_denied' || params.cancelled === '1') {
    await clearPendingAtprotoOAuthFlow()
    return {status: 'cancelled', returnRoute}
  }

  try {
    assertNoTokensInParams(params)
  } catch (error) {
    await clearPendingAtprotoOAuthFlow()
    return {
      status: 'invalid',
      message: error instanceof Error ? error.message : 'Invalid OAuth callback.',
      returnRoute,
    }
  }

  const state = params.state
  if (!state) {
    return {
      status: 'invalid',
      message: 'Missing OAuth state.',
      returnRoute,
    }
  }

  if (wasAtprotoOAuthStateConsumed(state)) {
    return {status: 'duplicate', returnRoute}
  }

  if (!pending) {
    return {
      status: 'invalid',
      message: 'No pending AT Protocol connection. Start from Settings.',
      returnRoute,
    }
  }

  if (pending.expectedProvider !== 'atproto') {
    await clearPendingAtprotoOAuthFlow()
    return {
      status: 'invalid',
      message: 'Unexpected OAuth provider.',
      returnRoute,
    }
  }

  if (pending.state !== state) {
    await clearPendingAtprotoOAuthFlow()
    return {
      status: 'invalid',
      message: 'OAuth state mismatch.',
      returnRoute,
    }
  }

  if (isPendingAtprotoOAuthExpired(pending)) {
    await clearPendingAtprotoOAuthFlow()
    return {status: 'expired', returnRoute}
  }

  try {
    // Preview disposable completion when the authorize-preview redirect includes preview=1.
    const query: Record<string, string> = {state}
    if (params.preview) query.preview = params.preview
    if (params.did) query.did = params.did
    if (params.handle) query.handle = params.handle
    if (params.pdsUrl) query.pdsUrl = params.pdsUrl
    if (params.code) query.code = params.code
    if (params.iss) query.iss = params.iss

    const result = await input.atprotoRepository.completeOAuthCallback(query)
    markAtprotoOAuthStateConsumed(state)
    await clearPendingAtprotoOAuthFlow()
    return {
      status: 'connected',
      connection: result.connection,
      returnRoute: result.returnRoute ?? returnRoute,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not finish AT Protocol connection.'
    if (/already used|duplicate|consumed/i.test(message)) {
      markAtprotoOAuthStateConsumed(state)
      await clearPendingAtprotoOAuthFlow()
      return {status: 'duplicate', returnRoute}
    }
    if (/expired/i.test(message)) {
      await clearPendingAtprotoOAuthFlow()
      return {status: 'expired', returnRoute}
    }
    return {status: 'failed', message, returnRoute}
  }
}
