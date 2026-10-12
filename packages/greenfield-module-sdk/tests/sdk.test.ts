import {describe, expect, it} from 'vitest'
import {
  defineFunction,
  defineModule20,
  defineProductUiNode,
  defineSchema,
  defineStandardApiOperation,
  defineStandardService,
  defineStandardVersionedSection,
  defineTool,
  moduleRecordCollection,
  negotiateHostCapabilities,
} from '../src/index.js'

describe('Greenfield module SDK builders', () => {
  it('builds namespaced contribution contracts without execution helpers', () => {
    const moduleId = 'digital.modula.vault-notes'
    expect(moduleRecordCollection(moduleId, 'note')).toBe('module.digital.modula.vault-notes.note')
    expect(
      defineFunction(moduleId, 'create-note', {
        title: 'Create note',
        mode: 'declarative',
        inputSchemaRef: 'schemas/create-note-input.v1.schema.json',
        outputSchemaRef: 'schemas/create-note-output.v1.schema.json',
        executionRequired: false,
      }).functionId,
    ).toBe('digital.modula.vault-notes.function.create-note')
    expect(
      defineTool(moduleId, 'save-post', {
        title: 'Save to Vault',
        surfaces: ['composer'],
      }).toolId,
    ).toBe('digital.modula.vault-notes.tool.save-post')
    expect(
      defineSchema(moduleId, 'note', {
        title: 'Vault note',
        schemaRef: 'schemas/vault-note.v1.schema.json',
        collectionSuffix: 'note',
        defaultVisibility: 'private',
      }).collection,
    ).toBe('module.digital.modula.vault-notes.note')
  })

  it('builds Standard 2.0 manifests and registry contracts', () => {
    const moduleId = 'digital.modula.vault-notes'
    const manifest = defineModule20({
      moduleId,
      name: 'Vault Notes',
      description: 'First-party private notes module.',
      version: '0.1.0',
      publisher: {publisherId: 'modula', displayName: 'Modula'},
      source: {
        provider: 'github',
        repository: 'modula-mod/modula-vault-notes',
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
      contributions: {},
      integrity: {manifestSha256: 'a'.repeat(64)},
      serviceRegistry: defineStandardVersionedSection([defineStandardService(moduleId, 'search', {kind: 'search', contract: 'vault-notes.search'})]),
      apiRegistry: defineStandardVersionedSection([defineStandardApiOperation(moduleId, 'create-note')]),
    })
    expect(manifest.manifestVersion).toBe(2)
    expect(manifest.standardVersion).toBe('2.0.0')
    expect(manifest.sectionVersions.services).toBe('2.0.0')
    expect(manifest.serviceRegistry?.items?.[0]?.id).toBe('digital.modula.vault-notes.service.search')
    expect(manifest.apiRegistry?.items?.[0]?.path).toBe('/api/modula/digital.modula.vault-notes/create-note')
  })
})

describe('Product UI SDK and testkit exports', () => {
  it('builds a neutral alpha semantic node and negotiates beta host support', () => {
    const node = defineProductUiNode({
      id: 'audit.alpha.create',
      type: 'Button',
      version: '1.0.0',
      capability: {id: 'ui.button', version: '1'},
      label: 'Create',
      actionId: 'audit.alpha.actions.create',
      role: 'prominent',
    })
    expect(node.type).toBe('Button')

    const negotiation = negotiateHostCapabilities({
      host: [{id: 'ui.button', version: '1.0.0', status: 'available', provenance: 'native', renderer: 'audit.beta.button'}],
      required: ['ui.button@1'],
    })
    expect(negotiation.ok).toBe(true)
    expect(negotiation.required[0]?.selected?.renderer).toBe('audit.beta.button')
  })
})
