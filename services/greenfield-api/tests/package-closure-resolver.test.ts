import {describe, expect, it} from 'vitest'
import type {PackageReleaseDescriptor} from '@modula/greenfield-module-registry-contracts'
import {resolvePackageClosure, PackageResolutionError} from '../src/modules/package-closure-resolver.js'

const digest = (digit: string) => digit.repeat(64)
const release = (packageId: string, version: string, digit: string, dependencies: PackageReleaseDescriptor['dependencies'] = [],
                 category: PackageReleaseDescriptor['category'] = 'game-content'): PackageReleaseDescriptor => ({
  schemaVersion: 'modula.package.1', packageId, publisherId: 'modula', category, version,
  releaseId: `${packageId}:${version}`, artifact: {sha256: digest(digit), compressedSizeBytes: 1000,
    installedSizeEstimateBytes: 2000, mediaType: 'application/vnd.modula.game-web+tgz',
    download: {pathOrUrl: `/v1/artifacts/${digest(digit)}`, authorization: 'bearer', range: true}},
  signature: {algorithm: 'Ed25519', keyId: 'qa-key', signature: 'qa-signature', statementDigest: null},
  trust: {verified: true, publisherVerified: true, revoked: false}, minimumHostVersion: '>=1.1.0',
  platforms: ['ios'], dependencies, requiredCapabilities: [], cachePolicy: 'remove-when-unused',
  sharing: 'public-immutable',
})

const phaser = release('digital.modula.runtime.phaser', '4.2.1', 'a', [], 'web-runtime')
const arena = release('digital.modula.orbit-arena', '0.1.1', 'b', [{packageId: phaser.packageId, versionRange: '^4.2.0'}])
const dash = release('digital.modula.orbit-dash', '0.1.0', 'c', [{packageId: phaser.packageId, versionRange: '^4.2.0'}])
const request = (requested: string[], available: PackageReleaseDescriptor[]) => ({
  requested: requested.map(packageId => ({packageId, versionRange: '*'})), available,
  hostVersion: '1.1.0', platform: 'ios', hostCapabilities: new Set<string>(),
  trustedPublishers: new Set(['modula']), installedPublicDigests: new Set<string>(),
})

describe('exact signed package closure', () => {
  it('pins one Phaser artifact for two games and counts only missing bytes', () => {
    const input = request([dash.packageId, arena.packageId], [dash, phaser, arena])
    const lock = resolvePackageClosure(input)
    expect(lock.packages.map(item => item.packageId)).toEqual([arena.packageId, dash.packageId, phaser.packageId])
    expect(lock.aggregateCompressedBytes).toBe(3000)
    expect(lock.newDownloadBytes).toBe(3000)
    expect(resolvePackageClosure({...input, installedPublicDigests: new Set([phaser.artifact.sha256])}).newDownloadBytes).toBe(2000)
    expect(resolvePackageClosure({...input, requested: [...input.requested].reverse()})).toEqual(lock)
  })

  it('backtracks to a compatible immutable version across two ranges', () => {
    const older = release(phaser.packageId, '4.2.1', 'd', [], 'web-runtime')
    const newer = release(phaser.packageId, '4.3.0', 'e', [], 'web-runtime')
    const strict = release(dash.packageId, '0.1.1', 'f', [{packageId: phaser.packageId, versionRange: '<4.3.0'}])
    const lock = resolvePackageClosure(request([arena.packageId, strict.packageId], [arena, strict, older, newer]))
    expect(lock.packages.find(item => item.packageId === phaser.packageId)?.version).toBe('4.2.1')
  })

  it('rejects incompatible requirements and unsupported capabilities', () => {
    const incompatibleGame = release(dash.packageId, '0.1.1', 'f',
      [{packageId: phaser.packageId, versionRange: '<4.2.0'}])
    expect(() => resolvePackageClosure(request([arena.packageId, incompatibleGame.packageId],
      [arena, incompatibleGame, phaser]))).toThrowError(PackageResolutionError)
    try {
      resolvePackageClosure(request([arena.packageId, incompatibleGame.packageId], [arena, incompatibleGame, phaser]))
    } catch (error) { expect((error as PackageResolutionError).code).toBe('DEPENDENCY_CONFLICT') }
    const privileged = {...phaser, requiredCapabilities: ['native.camera']}
    expect(() => resolvePackageClosure(request([arena.packageId], [arena, privileged]))).toThrowError(PackageResolutionError)
    try { resolvePackageClosure(request([arena.packageId], [arena, privileged])) }
    catch (error) { expect((error as PackageResolutionError).code).toBe('CAPABILITY_UNSUPPORTED') }
  })

  it.each([
    ['DEPENDENCY_MISSING', [arena]],
    ['PACKAGE_REVOKED', [arena, {...phaser, trust: {...phaser.trust, revoked: true}}]],
    ['PACKAGE_UNTRUSTED', [arena, {...phaser, trust: {...phaser.trust, verified: false}}]],
    ['PLATFORM_UNSUPPORTED', [arena, {...phaser, platforms: ['android']}]],
    ['HOST_INCOMPATIBLE', [arena, {...phaser, minimumHostVersion: '>=99.0.0'}]],
    ['DEPENDENCY_CYCLE', [arena, {...phaser, dependencies: [{packageId: arena.packageId, versionRange: '*'}]}]],
  ] as const)('rejects %s', (code, available) => {
    expect(() => resolvePackageClosure(request([arena.packageId], [...available]))).toThrowError(PackageResolutionError)
    try { resolvePackageClosure(request([arena.packageId], [...available])) } catch (error) {
      expect((error as PackageResolutionError).code).toBe(code)
    }
  })

  it('never reuses private account bytes and requires a model execution provider', () => {
    const model = {...release('digital.modula.nodus.fixture', '0.1.0', '9', [], 'model-data'),
      sharing: 'account-private' as const, executionProvider: 'nodus.provider.1'}
    const input = request([model.packageId], [model])
    expect(() => resolvePackageClosure(input)).toThrow(/model provider/)
    const lock = resolvePackageClosure({...input, hostCapabilities: new Set(['nodus.provider.1']),
      installedPublicDigests: new Set([model.artifact.sha256])})
    expect(lock.newDownloadBytes).toBe(1000)
  })
})
