import type {GreenfieldRuntimeResolutionResult} from './compatibility.js'
import type {GreenfieldRuntimeReasonCode} from './reason-code.js'

export type GreenfieldRuntimeSessionKind =
  | 'module'
  | 'connector-operation'
  | 'ai-conversation'
  | 'ai-tool-run'
  | 'automation-run'

export const GREENFIELD_RUNTIME_SESSION_STATES = [
  'creating',
  'resolving',
  'preparing',
  'ready',
  'starting',
  'active',
  'suspending',
  'suspended',
  'resuming',
  'stopping',
  'terminated',
  'failed',
  'recovering',
] as const

export type GreenfieldRuntimeSessionState = (typeof GREENFIELD_RUNTIME_SESSION_STATES)[number]

export const GREENFIELD_RUNTIME_SESSION_TRANSITIONS: Record<GreenfieldRuntimeSessionState, readonly GreenfieldRuntimeSessionState[]> = {
  creating: ['resolving', 'failed'],
  resolving: ['preparing', 'failed'],
  preparing: ['ready', 'failed'],
  ready: ['starting', 'stopping', 'terminated', 'failed'],
  starting: ['active', 'failed'],
  active: ['suspending', 'stopping', 'failed'],
  suspending: ['suspended', 'failed'],
  suspended: ['resuming', 'stopping', 'terminated', 'failed'],
  resuming: ['active', 'failed'],
  stopping: ['terminated', 'failed'],
  terminated: [],
  failed: ['recovering', 'terminated'],
  recovering: ['preparing', 'terminated', 'failed'],
}

export type GreenfieldRuntimeSession = {
  sessionId: string
  sessionKind: GreenfieldRuntimeSessionKind
  accountId: string
  moduleId?: string
  installationId?: string
  releaseId?: string
  providerIds: string[]
  state: GreenfieldRuntimeSessionState
  resolution?: GreenfieldRuntimeResolutionResult
  reasonCodes: GreenfieldRuntimeReasonCode[]
  metadata: Record<string, string | number | boolean | null>
  createdAt: string
  updatedAt: string
  startedAt?: string
  terminatedAt?: string
  failureCode?: GreenfieldRuntimeReasonCode
  failureMessage?: string
}

export function canTransitionRuntimeSession(
  from: GreenfieldRuntimeSessionState,
  to: GreenfieldRuntimeSessionState,
): boolean {
  return GREENFIELD_RUNTIME_SESSION_TRANSITIONS[from].includes(to)
}

export function assertRuntimeSessionTransition(
  from: GreenfieldRuntimeSessionState,
  to: GreenfieldRuntimeSessionState,
): void {
  if (!canTransitionRuntimeSession(from, to)) {
    throw new Error(`Invalid runtime session transition: ${from} -> ${to}`)
  }
}
