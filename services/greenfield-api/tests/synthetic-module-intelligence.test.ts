import {readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'
import {
  DETERMINISTIC_TEST_PROVIDER_ID,
  DeterministicTestProvider,
  IntelligenceProviderRegistry,
} from '@modula/intelligence-core'
import {
  DETERMINISTIC_TEST_ADAPTER_LIMITATION,
  DETERMINISTIC_TEST_ADAPTER_STATUS,
  createGovernedIntelligenceRouter,
  selectGovernedIntelligenceProvider,
} from '../src/intelligence/provider-selection.js'
import {projectAiCallableAvailableActions} from '../src/intelligence/action-boundary.js'

const boundarySource = readFileSync(new URL('../src/intelligence/action-boundary.ts', import.meta.url), 'utf8')
const serviceSource = readFileSync(new URL('../src/intelligence/service.ts', import.meta.url), 'utf8')
const bindingSource = readFileSync(new URL('../src/intelligence/mission-runtime-binding.ts', import.meta.url), 'utf8')

describe('generic intelligence discovery and router selection', () => {
  it('projects declared AI-callable actions rather than synthesizing collection permissions or product IDs', () => {
    expect(boundarySource).toContain('projectAiCallableAvailableActions')
    expect(boundarySource).toContain('aiCallable')
    expect(boundarySource).toContain('collectionsForRelease')
    expect(boundarySource).toContain('collectionPermission')
    expect(boundarySource).not.toContain('digital.modula.vault-notes')
    expect(boundarySource).not.toContain('RECENT_VAULT_NOTES')
    expect(serviceSource).toContain('selectGovernedIntelligenceProvider')
    expect(serviceSource).toContain('this.runtime.start')
    expect(bindingSource).toContain('boundary.availableActions')
  })

  it('selects the deterministic test adapter through IntelligenceRouter and never presents it as a live model', async () => {
    const {router, providers} = createGovernedIntelligenceRouter()
    expect(providers.get(DETERMINISTIC_TEST_PROVIDER_ID)).toBeInstanceOf(DeterministicTestProvider)
    const selection = await selectGovernedIntelligenceProvider(router)
    expect(selection).toMatchObject({
      planner: 'deterministic-test-v0',
      router: 'selection-only',
      selectedProviderId: DETERMINISTIC_TEST_PROVIDER_ID,
      selectedProviderExecution: 'local',
      modelProviderStatus: DETERMINISTIC_TEST_ADAPTER_STATUS,
      limitation: DETERMINISTIC_TEST_ADAPTER_LIMITATION,
    })
    expect(selection.modelProviderStatus).toBe(DETERMINISTIC_TEST_ADAPTER_STATUS)
    expect(selection.modelProviderStatus).not.toBe('live-model')
  })

  it('prefers a registered non-test provider when one is available', async () => {
    const providers = new IntelligenceProviderRegistry()
    providers.register({
      id: 'test.modula.registered-local',
      execution: 'local',
      capabilities: ['tool-call'],
      availability: async () => ({state: 'available'}),
      execute: async () => {
        throw new Error('selection-only test stub must not execute')
      },
    })
    const selection = await selectGovernedIntelligenceProvider(createGovernedIntelligenceRouter(providers).router)
    expect(selection.selectedProviderId).toBe('test.modula.registered-local')
    expect(selection.modelProviderStatus).toBe('registered-provider')
    expect(selection.limitation).toBeUndefined()
  })
})

const syntheticModuleId = 'test.modula.synthetic-records'
const syntheticCollection = 'item'
const syntheticRead = `records:module.${syntheticModuleId}.${syntheticCollection}:read`
const itemCollection = {
  collection: syntheticCollection,
  schemaRef: 'schemas/item.json',
  defaultVisibility: 'private' as const,
  fields: [],
  searchableFields: [],
  filterableFields: [],
  sortableFields: [],
}
const undeclaredCollection = {
  ...itemCollection,
  collection: 'plain',
  schemaRef: 'schemas/plain.json',
}

describe('generic AI-callable action projection', () => {
  it('projects an explicit AI-callable record.query onto the declared collection', () => {
    const actions = projectAiCallableAvailableActions({
      moduleId: syntheticModuleId,
      collections: [itemCollection, undeclaredCollection],
      grantedPermissions: [syntheticRead, `records:module.${syntheticModuleId}.plain:read`],
      manifest: {
        actions: [{
          id: `${syntheticModuleId}.action.item.query`,
          functionId: `${syntheticModuleId}.function.item.query`,
          permissions: [syntheticRead],
          sideEffects: ['record.query'],
        }],
        functions: [{
          id: `${syntheticModuleId}.function.item.query`,
          aiCallable: true,
          sideEffects: ['record.query'],
          permissions: [syntheticRead],
          inputSchema: {
            type: 'object',
            properties: {
              collection: {type: 'string', const: syntheticCollection},
              limit: {type: 'integer', minimum: 1, maximum: 100, default: 25},
            },
          },
        }],
        ai: [],
      },
    })
    expect(actions).toEqual([{
      family: 'record.query',
      capability: syntheticRead,
      moduleId: syntheticModuleId,
      actionId: `${syntheticModuleId}.action.item.query`,
      collection: syntheticCollection,
      limits: {min: 1, max: 100, default: 25},
    }])
  })

  it('does not discover a readable collection that has no AI-callable declaration', () => {
    const actions = projectAiCallableAvailableActions({
      moduleId: syntheticModuleId,
      collections: [itemCollection, undeclaredCollection],
      grantedPermissions: [syntheticRead, `records:module.${syntheticModuleId}.plain:read`],
      manifest: {
        actions: [],
        functions: [],
        ai: [],
      },
    })
    expect(actions).toEqual([])
  })

  it('does not project a record.query that is not marked AI-callable', () => {
    const actions = projectAiCallableAvailableActions({
      moduleId: syntheticModuleId,
      collections: [itemCollection],
      grantedPermissions: [syntheticRead],
      manifest: {
        actions: [{
          id: `${syntheticModuleId}.action.item.list-recent`,
          functionId: `${syntheticModuleId}.function.item.list-recent`,
          permissions: [syntheticRead],
          sideEffects: ['record.query'],
        }],
        functions: [{
          id: `${syntheticModuleId}.function.item.list-recent`,
          aiCallable: false,
          sideEffects: ['record.query'],
          permissions: [syntheticRead],
          inputSchema: {type: 'object', properties: {collection: {const: syntheticCollection}}},
        }],
        ai: [],
      },
    })
    expect(actions).toEqual([])
  })

  it('projects a function referenced from Standard ai[].toolDefinitions', () => {
    const actions = projectAiCallableAvailableActions({
      moduleId: syntheticModuleId,
      collections: [itemCollection],
      grantedPermissions: [syntheticRead],
      manifest: {
        functions: [{
          id: `${syntheticModuleId}.function.item.query`,
          sideEffects: ['record.query'],
          permissions: [syntheticRead],
          inputSchema: {type: 'object', properties: {collection: {const: syntheticCollection}}},
        }],
        ai: [{id: 'assistant', toolDefinitions: [{functionId: `${syntheticModuleId}.function.item.query`}]}],
      },
    })
    expect(actions).toEqual([expect.objectContaining({
      family: 'record.query',
      actionId: `${syntheticModuleId}.function.item.query`,
      collection: syntheticCollection,
    })])
  })

  it('does not advertise families the governed boundary cannot execute', () => {
    const actions = projectAiCallableAvailableActions({
      moduleId: syntheticModuleId,
      collections: [itemCollection],
      grantedPermissions: [syntheticRead],
      manifest: {
        functions: [{
          id: `${syntheticModuleId}.function.item.invoke`,
          aiCallable: true,
          sideEffects: ['function.invoke'],
          permissions: [syntheticRead],
          inputSchema: {type: 'object', properties: {collection: {const: syntheticCollection}}},
        }],
        ai: [],
      },
    })
    expect(actions).toEqual([])
  })

  it('keeps a declared AI-callable action unavailable when the matching permission is not granted', () => {
    const actions = projectAiCallableAvailableActions({
      moduleId: syntheticModuleId,
      collections: [itemCollection],
      grantedPermissions: [`records:module.${syntheticModuleId}.${syntheticCollection}:write`],
      manifest: {
        functions: [{
          id: `${syntheticModuleId}.function.item.query`,
          aiCallable: true,
          sideEffects: ['record.query'],
          permissions: [syntheticRead],
          inputSchema: {type: 'object', properties: {collection: {const: syntheticCollection}}},
        }],
        ai: [],
      },
    })
    expect(actions).toEqual([])
  })
})
