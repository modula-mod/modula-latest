import type {IntelligenceMissionStatus} from './domain.js'
import {IntelligenceError} from './errors.js'

const TERMINAL = new Set<IntelligenceMissionStatus>(['completed', 'failed', 'cancelled', 'blocked'])

const TRANSITIONS: Readonly<Record<IntelligenceMissionStatus, readonly IntelligenceMissionStatus[]>> = {
  draft: ['planning', 'cancelled'],
  planning: ['awaiting_verification', 'failed', 'cancelled', 'blocked'],
  awaiting_verification: ['awaiting_authorization', 'failed', 'cancelled', 'blocked'],
  awaiting_authorization: ['awaiting_approval', 'running', 'failed', 'cancelled', 'blocked'],
  awaiting_approval: ['running', 'failed', 'cancelled', 'blocked'],
  running: ['completed', 'failed', 'cancelled', 'blocked'],
  completed: [],
  failed: [],
  cancelled: [],
  blocked: [],
}

export function isTerminalMissionStatus(status: IntelligenceMissionStatus): boolean {
  return TERMINAL.has(status)
}

export function canTransitionMission(from: IntelligenceMissionStatus, to: IntelligenceMissionStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function assertMissionTransition(from: IntelligenceMissionStatus, to: IntelligenceMissionStatus): void {
  if (!canTransitionMission(from, to)) {
    throw new IntelligenceError('INVALID_MISSION_STATE', `Mission cannot transition from ${from} to ${to}`)
  }
}
