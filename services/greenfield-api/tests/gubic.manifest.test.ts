import {describe, expect, it} from 'vitest'
import {GubicManifestError, gubicManifestDigest, validateGubicManifest} from '../src/gubic/manifest.js'

const base = () => ({
  schema: 'modula.gubic.game.v1',
  gameId: 'digital.modula.games.orbit-tap',
  version: '1.0.0',
  title: 'Orbit Tap',
  summary: 'Tap to swap orbits and collect stars.',
  genre: 'Arcade',
  categories: ['arcade', 'casual'],
  runtime: {engine: 'html5', entry: 'index.html', orientation: 'portrait'},
  bridge: {version: 1, capabilities: ['lifecycle', 'score', 'achievements']},
  network: 'none',
  achievements: [
    {key: 'first-star', title: 'First star', description: 'Collect a star', points: 10},
    {key: 'orbit-master', title: 'Orbit master', description: 'Score 50', points: 40, hidden: true},
  ],
  ageRating: '4+',
  monetisation: 'free',
  packageSizeBytes: 120_000,
})

function issues(input: unknown): string[] {
  try { validateGubicManifest(input); return [] } catch (error) {
    expect(error).toBeInstanceOf(GubicManifestError)
    return (error as GubicManifestError).issues
  }
}

describe('GUBIC game manifest', () => {
  it('accepts and normalises a valid single-player HTML5 manifest', () => {
    const manifest = validateGubicManifest(base())
    expect(manifest.runtime).toEqual({engine: 'html5', engineVersion: null, entry: 'index.html', orientation: 'portrait'})
    expect(manifest.bridge.capabilities).toEqual(['achievements', 'lifecycle', 'score'])
    expect(manifest.achievements[1]).toMatchObject({key: 'orbit-master', hidden: true, points: 40})
    expect(manifest.multiplayer).toBeNull()
  })

  it('produces a stable digest regardless of key order', () => {
    const a = validateGubicManifest(base())
    const b = validateGubicManifest(JSON.parse(JSON.stringify({...base(), categories: ['casual', 'arcade']})))
    expect(gubicManifestDigest(a)).toBe(gubicManifestDigest(b))
    expect(gubicManifestDigest(a)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('refuses later-phase engines such as retro emulation', () => {
    expect(issues({...base(), runtime: {engine: 'retro-emulation'}}).join()).toContain('later phase')
    expect(issues({...base(), runtime: {engine: 'unity-native'}}).join()).toContain('runtime.engine must be one of')
  })

  it('never grants open network access', () => {
    expect(issues({...base(), network: 'internet'}).join()).toContain('never get open internet access')
  })

  it('requires lobby-relay networking and the lobby capability for multiplayer', () => {
    const problems = issues({...base(), multiplayer: {minPlayers: 2, maxPlayers: 4, mode: 'realtime-relay'}})
    expect(problems).toContain('multiplayer games must declare network lobby-relay')
    expect(problems).toContain('multiplayer games must request the lobby bridge capability')
    const ok = validateGubicManifest({...base(), network: 'lobby-relay', bridge: {version: 1, capabilities: ['lifecycle', 'lobby', 'achievements']}, multiplayer: {minPlayers: 2, maxPlayers: 4, mode: 'turn-based'}})
    expect(ok.multiplayer).toEqual({minPlayers: 2, maxPlayers: 4, mode: 'turn-based'})
    expect(issues({...base(), network: 'lobby-relay', bridge: {version: 1, capabilities: ['lifecycle', 'lobby']}, multiplayer: {minPlayers: 2, maxPlayers: 32, mode: 'turn-based'}}).join()).toContain('maxPlayers <= 16')
  })

  it('validates achievements: keys, duplicates, capability and point budget', () => {
    expect(issues({...base(), achievements: [{key: 'Bad Key', title: 'x'}]}).join()).toContain('key is invalid')
    expect(issues({...base(), achievements: [{key: 'a', title: 'A'}, {key: 'a', title: 'B'}]}).join()).toContain('duplicate achievement key a')
    expect(issues({...base(), bridge: {version: 1, capabilities: ['lifecycle']}}).join()).toContain('require the achievements bridge capability')
    const many = Array.from({length: 11}, (_, i) => ({key: `a${i}`, title: `A${i}`, points: 100}))
    expect(issues({...base(), achievements: many}).join()).toContain('total at most 1000')
  })

  it('rejects unknown capabilities, bad ids, sizes and ratings', () => {
    const problems = issues({...base(), gameId: 'Orbit', bridge: {version: 1, capabilities: ['lifecycle', 'wallet.write']}, packageSizeBytes: 999_999_999, ageRating: '18'})
    expect(problems.join()).toContain('gameId must be')
    expect(problems.join()).toContain('unknown bridge capability wallet.write')
    expect(problems.join()).toContain('packageSizeBytes')
    expect(problems.join()).toContain('ageRating')
  })
})
