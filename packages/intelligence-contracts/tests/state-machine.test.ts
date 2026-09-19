import {describe, expect, it} from 'vitest'
import {assertMissionTransition, canTransitionMission, evidenceState} from '../src/index.js'

describe('mission state machine', () => {
  it('accepts the governed lifecycle and rejects terminal resurrection', () => {
    expect(canTransitionMission('draft', 'planning')).toBe(true)
    expect(canTransitionMission('awaiting_authorization', 'running')).toBe(true)
    expect(() => assertMissionTransition('completed', 'running')).toThrowError(/cannot transition/)
  })
})

describe('evidence semantics', () => {
  it('does not treat an unsupported derived assertion as evidence', () => {
    expect(evidenceState([], false)).toBe('NO_EVIDENCE')
    expect(evidenceState([], true)).toBe('INSUFFICIENT_EVIDENCE')
    expect(evidenceState([{id: 'model-reasoning', kind: 'derived'}], true)).toBe('INSUFFICIENT_EVIDENCE')
  })
})
