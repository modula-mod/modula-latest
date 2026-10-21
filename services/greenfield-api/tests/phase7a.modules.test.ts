import {describe, expect, it} from 'vitest'
import {GREENFIELD_MODULE_INSTALLATION_TRANSITIONS} from '@modula/greenfield-module-registry-contracts'
import {validateGreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import {GreenfieldModuleCompatibilityService} from '../src/modules/compatibility-service.js'
import {validateRemoteHttpFunctionPolicy} from '../src/modules/module-domain.js'

const manifest = {
  manifestVersion: 1,
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
  permissions: [
    {permission: 'records:module.digital.modula.vault-notes.note:read', reason: 'Read private Vault notes'},
    {permission: 'schemas:register', reason: 'Register Vault schemas'},
  ],
  contributions: {
    functions: [
      {
        id: 'digital.modula.vault-notes.function.create-note',
        title: 'Create note',
        functionId: 'digital.modula.vault-notes.function.create-note',
        mode: 'declarative',
        inputSchemaRef: 'schemas/create-note-input.v1.schema.json',
        outputSchemaRef: 'schemas/create-note-output.v1.schema.json',
        executionRequired: false,
      },
    ],
  },
  integrity: {manifestSha256: 'a'.repeat(64), releaseSha256: 'b'.repeat(64)},
}

describe('Phase 7A module platform contracts', () => {
  it('validates a namespaced first-party module and rejects DIMON permissions for non-DIMON modules', () => {
    expect(validateGreenfieldModuleManifest(manifest).valid).toBe(true)
    const bad = validateGreenfieldModuleManifest({
      ...manifest,
      moduleId: 'example.notes',
      publisher: {publisherId: 'example', displayName: 'Example'},
      license: {status: 'declared', evidenceIds: ['readme']},
      trust: {requestedLevel: 'reviewedCommunity'},
      permissions: [{permission: 'dimon:transaction:request', reason: 'Move value'}],
    })
    expect(bad.valid).toBe(false)
  })

  it('returns explicit incompatibility reasons', () => {
    const service = new GreenfieldModuleCompatibilityService({moduleRemoteFunctionsEnabled: false} as any)
    const result = service.evaluate(
      {
        releaseId: 'r',
        extensionId: manifest.moduleId,
        extensionVersionId: `${manifest.moduleId}@0.1.0`,
        moduleId: manifest.moduleId,
        version: '0.1.0',
        publisherId: 'modula',
        releaseState: 'quarantined',
        manifest: manifest as any,
        manifestSha256: 'a'.repeat(64),
        releaseSha256: 'b'.repeat(64),
        signatureKeyId: null,
        signature: null,
        sourceRepository: manifest.source.repository,
        sourceCommit: manifest.source.commit,
        manifestPath: manifest.source.manifestPath,
        licenseStatus: 'firstParty',
        trustLevel: 'firstParty',
      },
      {platform: 'android', publisherStatus: 'verified'},
    )
    expect(result.reasons).toEqual(expect.arrayContaining(['RELEASE_NOT_PUBLISHED', 'RELEASE_QUARANTINED', 'PLATFORM_UNSUPPORTED']))
  })

  it('evaluates a declared client host version instead of the server fallback', () => {
    const release = {releaseState: 'published', manifest: {
      ...manifest,
      compatibility: {...manifest.compatibility, minimumModulaHostVersion: '1.1.0'},
    }} as any
    const service = new GreenfieldModuleCompatibilityService()
    expect(service.evaluate(release, {platform: 'ios', hostVersion: '1.1.0'}).reasons).not.toContain('HOST_VERSION_TOO_OLD')
    expect(service.evaluate(release, {platform: 'ios', hostVersion: '1.0.0'}).reasons).toContain('HOST_VERSION_TOO_OLD')
    expect(service.evaluate(release, {platform: 'ios'}).reasons).toContain('HOST_VERSION_TOO_OLD')
  })

  it('keeps lifecycle transitions centralized and rejects direct removal from enabled', () => {
    expect(GREENFIELD_MODULE_INSTALLATION_TRANSITIONS.enabled).toContain('disabling')
    expect(GREENFIELD_MODULE_INSTALLATION_TRANSITIONS.enabled).not.toContain('removed')
  })

  it('defines future remote HTTP policy validation without enabling remote functions', () => {
    const errors = validateRemoteHttpFunctionPolicy({
      url: 'http://127.0.0.1/function',
      allowedHosts: ['api.example.com'],
      timeoutMs: 60_000,
      responseSizeLimitBytes: 10_000_000,
      responseSchemaRef: '',
    })
    expect(errors).toEqual(
      expect.arrayContaining([
        'REMOTE_HTTP_HTTPS_REQUIRED',
        'REMOTE_HTTP_HOST_NOT_ALLOWLISTED',
        'REMOTE_HTTP_PRIVATE_ADDRESS_DENIED',
        'REMOTE_HTTP_TIMEOUT_INVALID',
        'REMOTE_HTTP_RESPONSE_SIZE_INVALID',
        'REMOTE_HTTP_RESPONSE_SCHEMA_REQUIRED',
      ]),
    )
  })
})
