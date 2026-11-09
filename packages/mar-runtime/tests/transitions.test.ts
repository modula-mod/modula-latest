import {describe, expect, it} from 'vitest'
import {
  IntelligenceError,
  canTransitionMission,
  isTerminalMissionStatus,
  type IntelligenceMission,
  type IntelligenceMissionStatus,
} from '@modula/intelligence-contracts'
import {commitMissionStatus} from '../src/transition.js'

const NOW = '2026-11-07T00:00:00.000Z'

const STATUSES = [
  'draft',
  'planning',
  'awaiting_verification',
  'awaiting_authorization',
  'awaiting_approval',
  'running',
  'completed',
  'failed',
  'cancelled',
  'blocked',
] as const satisfies readonly IntelligenceMissionStatus[]

const LEGAL: Record<IntelligenceMissionStatus, readonly IntelligenceMissionStatus[]> = {
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

function mission(status: IntelligenceMissionStatus): IntelligenceMission {
  return {
    id: 'mission-transition',
    userId: 'account-verified',
    objective: 'List widgets from the registered test module',
    status,
    correlationId: 'corr-transition',
    createdAt: NOW,
    updatedAt: NOW,
  }
}

describe('frozen mission transitions', () => {
  it('accepts every legal transition and rejects every illegal transition', () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        const allowed = LEGAL[from].includes(to)
        expect(canTransitionMission(from, to), `${from} -> ${to}`).toBe(allowed)
        if (allowed) {
          const next = commitMissionStatus(mission(from), to, NOW)
          expect(next.status).toBe(to)
          expect(next.completedAt).toBe(isTerminalMissionStatus(to) ? NOW : undefined)
        } else {
          expect(() => commitMissionStatus(mission(from), to, NOW), `${from} -> ${to}`).toThrow(IntelligenceError)
          try {
            commitMissionStatus(mission(from), to, NOW)
          } catch (error) {
            expect(error).toBeInstanceOf(IntelligenceError)
            expect((error as IntelligenceError).code).toBe('INVALID_MISSION_STATE')
            expect((error as IntelligenceError).message).toContain(`from ${from} to ${to}`)
          }
        }
      }
    }
  })

  it('does not resume completed, failed, cancelled, or blocked missions', () => {
    for (const status of ['completed', 'failed', 'cancelled', 'blocked'] as const) {
      expect(isTerminalMissionStatus(status)).toBe(true)
      expect(() => commitMissionStatus(mission(status), 'running', NOW)).toThrow(/cannot transition/)
      expect(() => commitMissionStatus(mission(status), 'completed', NOW)).toThrow(IntelligenceError)
      expect(canTransitionMission(status, 'running')).toBe(false)
    }
  })

  it('does not let a failed mission become completed', () => {
    expect(canTransitionMission('failed', 'completed')).toBe(false)
    expect(() => commitMissionStatus(mission('failed'), 'completed', NOW)).toThrow(IntelligenceError)
  })
})
