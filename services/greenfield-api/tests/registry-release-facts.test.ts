import {describe, expect, it} from 'vitest'
import {notesList, releaseFacts} from '../src/modules/marketplace-service.js'
import {evaluateCompatibility} from '../src/modules/registry-trust-service.js'

describe('registry release facts', () => {
  const stale = {publishedAt: '2026-08-24T00:00:00.000Z', sizeBytes: null, notes: ['Old 1.7 notes']}

  it('prefers the registry publish time, stored package size and MPS notes over the manifest', () => {
    const facts = releaseFacts(stale, new Date('2026-10-01T22:31:57.621Z'), {sizeBytes: 260526, notes: notesList('Vault Notes 1.8 ships new artwork.')})
    expect(facts).toEqual({publishedAt: '2026-10-01T22:31:57.621Z', sizeBytes: 260526, notes: ['Vault Notes 1.8 ships new artwork.']})
  })

  it('falls back to the manifest declaration only where the registry has nothing', () => {
    expect(releaseFacts({publishedAt: '2026-08-24T00:00:00.000Z', sizeBytes: 42, notes: ['Declared']}, null, null))
      .toEqual({publishedAt: '2026-08-24T00:00:00.000Z', sizeBytes: 42, notes: ['Declared']})
    expect(releaseFacts(null, null, {sizeBytes: null, notes: []})).toEqual({publishedAt: null, sizeBytes: null, notes: []})
  })

  it('normalises MPS release notes', () => {
    expect(notesList('  one paragraph ')).toEqual(['one paragraph'])
    expect(notesList(['a', '', 'b'])).toEqual(['a', 'b'])
    expect(notesList(null)).toEqual([])
  })
})

describe('host compatibility', () => {
  const release = (compatibility: Record<string, unknown>) => ({manifest: {compatibility}} as any)
  const declared = {host: '>=0.1.0', frontendHostRuntime: '>=0.1.0', platforms: ['ios', 'web'], requiredCapabilities: []}

  it('never blocks when the client sends no hostVersion', () => {
    const strict = release({minimumModulaHostVersion: '99.0.0', platforms: ['ios']})
    expect(evaluateCompatibility(strict, {}, {...declared, host: '>=99.0.0'}).compatible).not.toBe(false)
    const iosOnly = evaluateCompatibility(strict, {platform: 'ios'}, {...declared, host: '>=99.0.0', frontendHostRuntime: '>=99.0.0'})
    expect(iosOnly.compatible).toBe(true)
    expect(iosOnly.reasons).toEqual([])
    expect(evaluateCompatibility(strict, {hostVersion: null, platform: 'ios'}, declared).compatible).toBe(true)
  })

  it('blocks only when a sent hostVersion is genuinely too old', () => {
    const rel = release({minimumModulaHostVersion: '1.2.0'})
    expect(evaluateCompatibility(rel, {hostVersion: '1.2.0', platform: 'ios'}, declared).compatible).toBe(true)
    const old = evaluateCompatibility(rel, {hostVersion: '1.1.9', platform: 'ios'}, declared)
    expect(old.compatible).toBe(false)
    expect(old.reasons.map(reason => reason.code)).toEqual(['HOST_VERSION_TOO_OLD'])
  })
})
