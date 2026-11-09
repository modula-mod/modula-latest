import {
  assertMissionTransition,
  isTerminalMissionStatus,
  type IntelligenceMission,
  type IntelligenceMissionStatus,
} from '@modula/intelligence-contracts'

/**
 * Apply one frozen mission transition.
 * The allowed graph lives in `@modula/intelligence-contracts`; this does not declare another.
 */
export function commitMissionStatus(mission: IntelligenceMission, to: IntelligenceMissionStatus, now: string): IntelligenceMission {
  assertMissionTransition(mission.status, to)
  return {
    ...mission,
    status: to,
    updatedAt: now,
    completedAt: isTerminalMissionStatus(to) ? now : mission.completedAt,
  }
}
