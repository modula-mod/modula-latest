import {describe, expect, it} from 'vitest'
import {
  GREENFIELD_ENGINE_KINDS,
  assertRuntimeSessionTransition,
  canLaunchRuntimeResolution,
  canTransitionRuntimeSession,
  isGreenfieldRuntimeCapability,
  type GreenfieldRuntimeResolutionResult,
} from '../src/index.js'

describe('Greenfield module engine contracts', () => {
  it('retains the canonical Phase 7D engine kinds', () => {
    expect(GREENFIELD_ENGINE_KINDS).toEqual([
      'declarative-ui',
      'records',
      'actions',
      'functions',
      'automation',
      'ai',
      'media',
      'game',
      'spatial',
      'document',
      'connector',
      'custom-native',
    ])
  })

  it('models the runtime lifecycle without arbitrary state jumps', () => {
    expect(canTransitionRuntimeSession('creating', 'resolving')).toBe(true)
    expect(canTransitionRuntimeSession('ready', 'starting')).toBe(true)
    expect(canTransitionRuntimeSession('starting', 'active')).toBe(true)
    expect(canTransitionRuntimeSession('active', 'terminated')).toBe(false)
    expect(() => assertRuntimeSessionTransition('terminated', 'active')).toThrow(/Invalid runtime session transition/)
  })

  it('rejects wildcard runtime capabilities', () => {
    expect(isGreenfieldRuntimeCapability('records.read')).toBe(true)
    expect(isGreenfieldRuntimeCapability('connector.oauth')).toBe(true)
    expect(isGreenfieldRuntimeCapability('email.*')).toBe(false)
  })

  it('keeps launch permission separate from compatibility', () => {
    const result: GreenfieldRuntimeResolutionResult = {
      accountId: 'account-1',
      moduleId: 'digital.modula.vault-notes',
      releaseId: 'release-1',
      compatibility: 'degraded',
      launchPermission: 'degraded-only',
      selectedProviders: [],
      unresolvedRequirements: [],
      requiredPermissions: [],
      deniedCapabilities: [],
      nativeBuildRequirement: 'not-required',
      degradedModeEligible: true,
      reasonCodes: ['degraded-mode.available'],
    }
    expect(canLaunchRuntimeResolution(result)).toBe(true)
  })
})
