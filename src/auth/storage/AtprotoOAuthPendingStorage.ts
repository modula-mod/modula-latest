import * as SecureStore from 'expo-secure-store'
import {Platform} from 'react-native'

/**
 * Pending AT Protocol OAuth flow metadata only (state / return route).
 * Never stores provider access or refresh tokens.
 */

export type PendingAtprotoOAuthFlow = {
  state: string
  returnRoute: string
  requestScope: 'atproto' | 'publish'
  clientKind: 'web' | 'native'
  expectedProvider: 'atproto'
  startedAt: string
  authorizationUrl: string
}

const KEY = 'modula.atproto.oauth.pending.v1'

let memoryPending: PendingAtprotoOAuthFlow | null = null
const consumedStates = new Set<string>()

export async function savePendingAtprotoOAuthFlow(
  flow: PendingAtprotoOAuthFlow,
): Promise<void> {
  memoryPending = flow
  if (Platform.OS === 'web') return
  await SecureStore.setItemAsync(KEY, JSON.stringify(flow))
}

export async function readPendingAtprotoOAuthFlow(): Promise<PendingAtprotoOAuthFlow | null> {
  if (Platform.OS === 'web') return memoryPending
  const raw = await SecureStore.getItemAsync(KEY)
  if (!raw) return memoryPending
  try {
    const parsed = JSON.parse(raw) as PendingAtprotoOAuthFlow
    memoryPending = parsed
    return parsed
  } catch {
    return null
  }
}

export async function clearPendingAtprotoOAuthFlow(): Promise<void> {
  memoryPending = null
  if (Platform.OS === 'web') return
  await SecureStore.deleteItemAsync(KEY)
}

export function markAtprotoOAuthStateConsumed(state: string): void {
  consumedStates.add(state)
}

export function wasAtprotoOAuthStateConsumed(state: string): boolean {
  return consumedStates.has(state)
}

export function isPendingAtprotoOAuthExpired(flow: PendingAtprotoOAuthFlow, now = Date.now()) {
  const started = Date.parse(flow.startedAt)
  if (!Number.isFinite(started)) return true
  return now - started > 10 * 60 * 1000
}
