import {describe, expect, it} from 'vitest'
import {GREENFIELD_MODULE_MANIFEST_VERSION, validateGreenfieldModuleManifest} from '../src/index.js'

function validManifest(overrides: Record<string, unknown> = {}) {
  return {
    manifestVersion: GREENFIELD_MODULE_MANIFEST_VERSION,
    moduleId: 'digital.modula.vault-notes',
    name: 'Vault Notes',
    description: 'First-party private notes module.',
    version: '0.1.0',
    publisher: {publisherId: 'modula', displayName: 'Modula'},
    source: {
      provider: 'github',
      repository: 'modula-mod/modula-module-vault-notes',
      commit: '0123456789abcdef0123456789abcdef01234567',
      manifestPath: 'module.manifest.json',
    },
    license: {status: 'firstParty', evidenceIds: ['first-party-policy']},
    trust: {requestedLevel: 'firstParty'},
    compatibility: {
      minimumGreenfieldVersion: '0.1.0',
      minimumModulaHostVersion: '0.1.0',
      protocolVersions: ['greenfield.v1'],
      platforms: ['server', 'ios'],
    },
    permissions: [{permission: 'schemas:register', reason: 'Register Vault record schemas'}],
    contributions: {
      routes: [{id: 'digital.modula.vault-notes.route.home', title: 'Vault Notes', path: '/module/digital.modula.vault-notes', routeKind: 'module'}],
      functions: [
        {
          id: 'digital.modula.vault-notes.function.create-note',
          title: 'Create Vault Note',
          functionId: 'digital.modula.vault-notes.function.create-note',
          mode: 'declarative',
          inputSchemaRef: 'schemas/create-note-input.v1.schema.json',
          outputSchemaRef: 'schemas/create-note-output.v1.schema.json',
          executionRequired: false,
        },
      ],
    },
    integrity: {manifestSha256: 'a'.repeat(64), releaseSha256: 'b'.repeat(64)},
    ...overrides,
  }
}

describe('Greenfield Module Manifest v1 validation', () => {
  it('accepts a valid first-party module', () => {
    expect(validateGreenfieldModuleManifest(validManifest()).valid).toBe(true)
  })

  it('rejects unsupported versions, malformed ids, mutable commits and unknown root fields', () => {
    const result = validateGreenfieldModuleManifest(
      validManifest({manifestVersion: 2, moduleId: 'Digital.Modula.Bad@1', source: {...validManifest().source, commit: 'main'}, unexpected: true}),
    )
    expect(result.issues.map(issue => issue.code)).toEqual(
      expect.arrayContaining(['UNSUPPORTED_MANIFEST_VERSION', 'INVALID_MODULE_ID', 'INVALID_SOURCE_COMMIT', 'UNKNOWN_ROOT_PROPERTY']),
    )
  })

  it('rejects duplicate and cross-namespace contribution IDs', () => {
    const result = validateGreenfieldModuleManifest(
      validManifest({
        contributions: {
          routes: [
            {id: 'digital.modula.vault-notes.route.home', title: 'Vault Notes', path: '/module/digital.modula.vault-notes', routeKind: 'module'},
            {id: 'digital.modula.vault-notes.route.home', title: 'Duplicate', path: '/module/digital.modula.vault-notes/dup', routeKind: 'module'},
          ],
          tools: [{id: 'digital.modula.other.tool.save', title: 'Bad', toolId: 'digital.modula.other.tool.save', surfaces: ['composer']}],
        },
      }),
    )
    expect(result.issues.map(issue => issue.code)).toEqual(
      expect.arrayContaining(['DUPLICATE_CONTRIBUTION_ID', 'CONTRIBUTION_OUTSIDE_NAMESPACE']),
    )
  })

  it('rejects unknown and reserved DIMON permissions for community modules', () => {
    const result = validateGreenfieldModuleManifest(
      validManifest({
        publisher: {publisherId: 'example', displayName: 'Example'},
        license: {status: 'declared', evidenceIds: ['readme']},
        trust: {requestedLevel: 'reviewedCommunity'},
        permissions: [
          {permission: 'dimon:transaction:request', reason: 'Money movement'},
          {permission: 'unknown:thing', reason: 'Invalid'},
        ],
      }),
    )
    expect(result.issues.map(issue => issue.code)).toContain('INVALID_PERMISSION')
  })

  it('rejects self dependencies and invalid ranges', () => {
    const result = validateGreenfieldModuleManifest(
      validManifest({
        dependencies: [
          {moduleId: 'digital.modula.vault-notes', versionRange: '^0.1.0', optional: false},
          {moduleId: 'digital.modula.tasks', versionRange: 'banana', optional: false},
        ],
      }),
    )
    expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(['SELF_DEPENDENCY', 'INVALID_SEMVER_RANGE']))
  })
})
