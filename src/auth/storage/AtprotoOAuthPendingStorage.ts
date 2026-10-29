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

let memoryPending: PendingAtprotoOAuthFlow | null = null
const consumedStates = new Set<string>()

export async function savePendingAtprotoOAuthFlow(
  flow: PendingAtprotoOAuthFlow,
): Promise<void> {
  memoryPending = flow
}

export async function readPendingAtprotoOAuthFlow(): Promise<PendingAtprotoOAuthFlow | null> {
  return memoryPending
}

export async function clearPendingAtprotoOAuthFlow(): Promise<void> {
  memoryPending = null
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
