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

  it('accepts a module-managed backend declaration', () => {
    const result = validateGreenfieldModuleManifest(
      validManifest({
        moduleId: 'com.example.crm',
        publisher: {publisherId: 'example', displayName: 'Example'},
        license: {status: 'verified', evidenceIds: ['license-review']},
        trust: {requestedLevel: 'verifiedPublisher'},
        permissions: [{permission: 'network:api.example.com:request', reason: 'Call the verified CRM backend'}],
        contributions: {},
        backend: {
          mode: 'module-managed',
          protocolVersion: '1.0.0',
          endpoints: {
            baseUrlStrategy: 'registry',
            apiVersion: '1.0.0',
            discoveryPath: '/.well-known/modula-module',
            healthPath: '/v1/health',
            actionsPath: '/v1/actions',
            allowedHosts: ['api.example.com'],
          },
          authentication: {
            strategy: 'greenfield-signed-jwt',
            tokenExchangeRequired: true,
            sessionExchangePath: '/v1/session/exchange',
            tokenTtlSeconds: 900,
          },
          deployment: {
            ownership: 'publisher-hosted',
            multiTenant: true,
            regions: ['eu-west'],
            dataResidency: ['GB', 'EU'],
            selfHostingSupported: true,
          },
          data: {
            primaryStore: 'module-backend',
            categories: [{id: 'contacts', description: 'CRM contacts', location: 'module-backend', classification: 'private', exportable: true, deletable: true}],
            exportSupported: true,
            deletionSupported: true,
            backupResponsibility: 'publisher',
          },
          trust: {
            publisherId: 'example',
            allowedOrigins: ['https://api.example.com'],
          },
          actions: [{
            actionId: 'com.example.crm.action.contact.read',
            method: 'POST',
            path: '/v1/actions/com.example.crm.action.contact.read',
            inputSchema: 'schemas/contact-read.input.json',
            outputSchema: 'schemas/contact-read.output.json',
            permissions: ['crm:contacts:read'],
            idempotent: true,
            sideEffects: 'none',
            confirmation: 'none',
            timeoutMs: 5000,
          }],
        },
      }),
    )
    expect(result.valid).toBe(true)
  })

  it('rejects unsafe module backend declarations', () => {
    const result = validateGreenfieldModuleManifest(
      validManifest({
        backend: {
          mode: 'module-managed',
          protocolVersion: '1.0.0',
          endpoints: {baseUrlStrategy: 'registry', apiVersion: '1.0.0', healthPath: '/v1/health', allowedHosts: ['localhost']},
          authentication: {tokenExchangeRequired: false},
          deployment: {ownership: 'publisher-hosted', multiTenant: true, selfHostingSupported: false},
          data: {primaryStore: 'module-backend', categories: [], exportSupported: true, deletionSupported: true, backupResponsibility: 'publisher'},
          trust: {publisherId: 'modula', allowedOrigins: ['https://127.0.0.1']},
        },
      }),
    )
    expect(result.issues.map(issue => issue.code)).toEqual(
      expect.arrayContaining(['TOKEN_EXCHANGE_REQUIRED', 'UNSAFE_BACKEND_HOST', 'UNSAFE_BACKEND_ORIGIN']),
    )
  })
})
