import {describe, expect, it} from 'vitest'
import {
  GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
  GREENFIELD_MODULE_MANIFEST_VERSION,
  createDefaultModuleSectionVersions,
  type GreenfieldModuleManifest,
} from '@modula/greenfield-module-manifest'
import {normalizeModuleManifest} from '../src/modules/manifest-normalizer.js'

describe('Phase 7E Standard 2.0 manifest normalization', () => {
  it('normalizes legacy Standard 1.2 manifests into the compatible runtime model without mutation', () => {
    const manifest = legacyManifest()
    const original = JSON.stringify(manifest)
    const normalized = normalizeModuleManifest(manifest)

    expect(JSON.stringify(manifest)).toBe(original)
    expect(normalized.identity.moduleId).toBe('digital.modula.vault-notes')
    expect(normalized.versions.standardVersion).toBe('1.2.0')
    expect(normalized.versions.normalizedFromStandardVersion).toBe('1.2.0')
    expect(normalized.dependencies.requires).toHaveLength(1)
    expect(normalized.permissions.legacy.map(permission => permission.permission)).toContain('ai.request')
    expect(normalized.ai.features).toEqual(['summarise'])
    expect(normalized.artifact).toMatchObject({
      manifestSha256: 'a'.repeat(64),
      releaseSha256: 'b'.repeat(64),
      checksumSource: 'manifest-integrity',
    })
    expect(normalized.diagnostics.runtimeSupport.standardVersion).toBe('2.0.0')
  })

  it('normalizes Standard 2.0 declarations and flags runtime gaps explicitly', () => {
    const manifest = standard20Manifest()
    const normalized = normalizeModuleManifest(manifest, {
      manifestSha256: 'c'.repeat(64),
      releaseSha256: 'd'.repeat(64),
    })
    const unsupportedSections = normalized.diagnostics.unsupportedSections.map(section => section.section)

    expect(normalized.versions.standardVersion).toBe('2.0.0')
    expect(normalized.artifact).toMatchObject({
      manifestSha256: 'c'.repeat(64),
      releaseSha256: 'd'.repeat(64),
      checksumSource: 'release-record',
    })
    expect(normalized.services.items).toHaveLength(1)
    expect(normalized.apis.items).toHaveLength(1)
    expect(normalized.hooks.items).toHaveLength(1)
    expect(normalized.capabilities.provides.map(provider => provider.id)).toEqual(['modula.reference.records'])
    expect(unsupportedSections).toEqual(expect.arrayContaining(['services', 'apis', 'hooks', 'jobs', 'storage', 'ui', 'automation']))
    expect(normalized.diagnostics.runtimeSupport.sections.services).toBe('DECLARATIVE_ONLY')
  })
})

function legacyManifest(): GreenfieldModuleManifest {
  return {
    manifestVersion: GREENFIELD_MODULE_MANIFEST_VERSION,
    moduleId: 'digital.modula.vault-notes',
    name: 'Vault Notes',
    description: 'First-party private notes module.',
    version: '1.1.0',
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
      platforms: ['server', 'web'],
    },
    permissions: [
      {permission: 'schemas:register', reason: 'Register Vault record schemas'},
      {permission: 'ai.request', reason: 'Request account-approved AI summarisation'},
    ],
    dependencies: [{moduleId: 'digital.modula.search', versionRange: '^1.0.0', optional: false}],
    contributions: {
      routes: [{id: 'digital.modula.vault-notes.route.home', title: 'Vault Notes', path: '/module/digital.modula.vault-notes', routeKind: 'module'}],
      schemas: [{id: 'digital.modula.vault-notes.schema.note', title: 'Note schema', schemaRef: 'schemas/note.json', collection: 'notes', defaultVisibility: 'private'}],
      settings: [{id: 'digital.modula.vault-notes.settings.account', title: 'Vault Settings', schemaRef: 'schemas/settings.json', scope: 'account'}],
    },
    ai: {
      features: ['summarise'],
      requiredCapabilities: ['text-generation'],
      dataAccess: {recordScopes: ['digital.modula.vault-notes.notes'], defaultPolicy: 'account-consent'},
    },
    integrity: {manifestSha256: 'a'.repeat(64), releaseSha256: 'b'.repeat(64)},
  }
}

function standard20Manifest(): GreenfieldModuleManifest {
  return {
    ...legacyManifest(),
    manifestVersion: GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
    moduleId: 'digital.modula.reference-runtime',
    name: 'Reference Runtime',
    version: '2.0.0',
    standardVersion: '2.0.0',
    sectionVersions: createDefaultModuleSectionVersions(),
    dependencyGraph: {
      version: '2.0.0',
      requires: [{moduleId: 'digital.modula.records', versionRange: '^1.0.0', reason: 'Store diagnostic records'}],
      optional: [{provides: 'modula.calendar', versionRange: '^1.0.0', reason: 'Attach dated diagnostics'}],
      recommended: [],
      conflicts: [],
      replaces: [],
      provides: [{id: 'modula.reference.records', title: 'Reference Records', version: '1.0.0', kind: 'capability'}],
    },
    serviceRegistry: {
      version: '2.0.0',
      items: [{id: 'digital.modula.reference-runtime.service.records', title: 'Record service', version: '1.0.0', kind: 'custom', contract: 'modula.reference.records.v1'}],
    },
    apiRegistry: {
      version: '2.0.0',
      items: [{
        id: 'digital.modula.reference-runtime.api.record-create',
        title: 'Create diagnostic record',
        version: '1.0.0',
        method: 'POST',
        path: '/api/modula/digital.modula.reference-runtime/records',
        permissions: ['records:module.digital.modula.reference-runtime.records:write'],
        sideEffects: 'write',
        idempotent: true,
      }],
    },
    hookRegistry: {
      version: '2.0.0',
      items: [{
        id: 'digital.modula.reference-runtime.hook.before-install',
        hook: 'module.before-install',
        phase: 'before',
        target: 'digital.modula.reference-runtime',
        policyMode: 'warn',
      }],
    },
    permissionModel: {
      version: '2.0.0',
      categories: {
        data: [{id: 'records:module.digital.modula.reference-runtime.records:write', reason: 'Create diagnostic records', required: true, risk: 'medium', policyMode: 'warn'}],
      },
    },
    capabilityDiscovery: {version: '2.0.0', supportsSearch: true, supportsWidgets: true},
    jobRegistry: {version: '2.0.0', items: [{id: 'digital.modula.reference-runtime.job.health', title: 'Health check', kind: 'health'}]},
    storageModel: {version: '2.0.0', items: [{id: 'digital.modula.reference-runtime.storage.records', kind: 'structured-records', version: '1.0.0'}]},
    widgetRegistry: {version: '2.0.0', items: [{id: 'digital.modula.reference-runtime.widget.board', title: 'Reference board', surface: 'board'}]},
    navigationRegistry: {version: '2.0.0', items: [{id: 'digital.modula.reference-runtime.navigation.home', title: 'Reference', kind: 'route', target: '/module/digital.modula.reference-runtime'}]},
    uiContributions: {version: '2.0.0', items: [{id: 'digital.modula.reference-runtime.ui.board', title: 'Reference card', kind: 'board-card', target: 'board', contract: 'modula.reference.card.v1'}]},
    automationRegistry: {version: '2.0.0', items: [{id: 'digital.modula.reference-runtime.automation.audit', title: 'Audit', triggers: [], actions: [], conditions: []}]},
    marketplace: {version: '2.0.0', verifiedBadge: true, requiredRuntimes: ['greenfield-api']},
    integrity: {manifestSha256: 'a'.repeat(64), releaseSha256: 'b'.repeat(64)},
  }
}
