import type {
  GreenfieldRuntimeReasonCode,
  GreenfieldRuntimeSession,
  GreenfieldRuntimeSessionState,
} from '@modula/greenfield-module-engine-contracts'

export type GreenfieldRuntimeSessionPatch = Partial<
  Pick<
    GreenfieldRuntimeSession,
    | 'state'
    | 'resolution'
    | 'reasonCodes'
    | 'providerIds'
    | 'metadata'
    | 'startedAt'
    | 'terminatedAt'
    | 'failureCode'
    | 'failureMessage'
  >
>

export interface GreenfieldRuntimeSessionStore {
  create(session: GreenfieldRuntimeSession): Promise<GreenfieldRuntimeSession>
  get(sessionId: string): Promise<GreenfieldRuntimeSession | null>
  listForAccount(accountId: string): Promise<GreenfieldRuntimeSession[]>
  update(sessionId: string, patch: GreenfieldRuntimeSessionPatch & {updatedAt: string}): Promise<GreenfieldRuntimeSession>
}

export class InMemoryGreenfieldRuntimeSessionStore implements GreenfieldRuntimeSessionStore {
  private readonly sessions = new Map<string, GreenfieldRuntimeSession>()

  async create(session: GreenfieldRuntimeSession): Promise<GreenfieldRuntimeSession> {
    if (this.sessions.has(session.sessionId)) throw new Error(`Runtime session already exists: ${session.sessionId}`)
    const stored = clone(session)
    this.sessions.set(stored.sessionId, stored)
    return clone(stored)
  }

  async get(sessionId: string): Promise<GreenfieldRuntimeSession | null> {
    const session = this.sessions.get(sessionId)
    return session ? clone(session) : null
  }

  async listForAccount(accountId: string): Promise<GreenfieldRuntimeSession[]> {
    return [...this.sessions.values()]
      .filter(session => session.accountId === accountId)
      .map(clone)
  }

  async update(sessionId: string, patch: GreenfieldRuntimeSessionPatch & {updatedAt: string}): Promise<GreenfieldRuntimeSession> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Runtime session not found: ${sessionId}`)
    const updated: GreenfieldRuntimeSession = {
      ...session,
      ...patch,
      reasonCodes: mergeReasonCodes(session.reasonCodes, patch.reasonCodes),
      metadata: {...session.metadata, ...patch.metadata},
      updatedAt: patch.updatedAt,
    }
    this.sessions.set(sessionId, clone(updated))
    return clone(updated)
  }
}

export function isTerminalRuntimeSessionState(state: GreenfieldRuntimeSessionState): boolean {
  return state === 'terminated'
}

function mergeReasonCodes(
  current: GreenfieldRuntimeReasonCode[],
  incoming?: GreenfieldRuntimeReasonCode[],
): GreenfieldRuntimeReasonCode[] {
  if (!incoming) return current
  return [...new Set([...current, ...incoming])]
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
