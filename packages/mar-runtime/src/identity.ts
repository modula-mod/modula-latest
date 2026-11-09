import {IntelligenceError} from '@modula/intelligence-contracts'

const ASSURANCE_METHODS = new Set(['greenfield-session', 'service-identity', 'test-harness'])

/**
 * Identity is supplied by the caller that already authenticated the session.
 * A client payload account id is never accepted as this value.
 */
export type VerifiedPrincipal = {
  readonly accountId: string
  readonly workspaceId?: string
  readonly assurance: {
    readonly kind: 'verified'
    readonly method: 'greenfield-session' | 'service-identity' | 'test-harness'
    readonly verifiedAt: string
  }
}

export type MissionRequest = {
  objective: string
  correlationId: string
}

export function assertVerifiedPrincipal(value: unknown): asserts value is VerifiedPrincipal {
  if (!value || typeof value !== 'object') {
    throw new IntelligenceError('MISSION_ACCESS_DENIED', 'A verified principal is required')
  }
  const candidate = value as Partial<VerifiedPrincipal>
  const assurance = candidate.assurance
  if (
    !assurance ||
    assurance.kind !== 'verified' ||
    typeof assurance.method !== 'string' ||
    !ASSURANCE_METHODS.has(assurance.method) ||
    !isTimestamp(assurance.verifiedAt)
  ) {
    throw new IntelligenceError('MISSION_ACCESS_DENIED', 'Principal assurance is missing; a client account identifier is not verified identity')
  }
  if (!isIdentifier(candidate.accountId)) {
    throw new IntelligenceError('MISSION_ACCESS_DENIED', 'Verified principal account id is missing')
  }
  if (candidate.workspaceId !== undefined && !isIdentifier(candidate.workspaceId)) {
    throw new IntelligenceError('MISSION_ACCESS_DENIED', 'Verified principal workspace id is invalid')
  }
}

export function parseMissionRequest(body: unknown): MissionRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new IntelligenceError('INVALID_ACTION_SCHEMA', 'Mission request must be an object')
  }
  const record = body as Record<string, unknown>
  if ('accountId' in record || 'userId' in record || 'ownerAccountId' in record) {
    throw new IntelligenceError('MISSION_ACCESS_DENIED', 'Client-supplied account identifiers are not accepted as identity')
  }
  const objective = typeof record.objective === 'string' ? record.objective.trim() : ''
  if (!objective || objective.length > 8000) {
    throw new IntelligenceError('INVALID_ACTION_SCHEMA', 'Objective must contain 1 to 8000 characters')
  }
  if (typeof record.correlationId !== 'string' || !/^[A-Za-z0-9:._/-]{8,200}$/.test(record.correlationId)) {
    throw new IntelligenceError('INVALID_ACTION_SCHEMA', 'correlationId must be 8 to 200 safe characters and is the mission idempotency key')
  }
  return {objective, correlationId: record.correlationId}
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}
