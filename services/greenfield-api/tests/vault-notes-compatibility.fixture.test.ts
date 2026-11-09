import {describe, expect, it} from 'vitest'
import {projectAiCallableAvailableActions} from '../src/intelligence/action-boundary.js'

// Optional compatibility fixture only. This snapshots the Vault Notes product's
// declared AI surface for note.list-recent from github.com/modula-mod/modula-vault-notes
// (aiCallable: false, empty ai[]). It does not invent an AI-callable declaration,
// does not map RECENT_VAULT_NOTES_OBJECTIVE, and does not change Vault Notes product
// code. If the product should expose this action later, that change belongs in
// the Vault Notes repository, not here.
const moduleId = 'digital.modula.vault-notes'
const collection = 'note'
const noteCollection = {
  collection,
  schemaRef: 'schemas/note.json',
  defaultVisibility: 'private' as const,
  fields: [],
  searchableFields: [],
  filterableFields: [],
  sortableFields: [],
}

const vaultNotesListRecentSurface = {
  ai: [] as unknown[],
  actions: [{
    id: 'digital.modula.vault-notes.action.note.list-recent',
    title: 'List recent notes',
    functionId: 'digital.modula.vault-notes.function.note.list-recent',
    permissions: ['module.records.read'],
    confirmationPolicy: {required: false, policyMode: 'warn'},
    sideEffects: ['record.query'],
    audit: {event: 'vault-notes.note.list-recent', includeInput: false},
  }],
  functions: [{
    id: 'digital.modula.vault-notes.function.note.list-recent',
    title: 'List recent notes',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: [],
      properties: {
        cursor: {type: ['string', 'null'], maxLength: 180},
        limit: {type: 'integer', minimum: 1, maximum: 100},
      },
    },
    outputSchema: {type: 'object'},
    permissions: ['module.records.read'],
    aiCallable: false,
    automationCallable: false,
    idempotent: true,
    sideEffects: ['record.query'],
    timeoutMs: 30_000,
    rateLimit: {windowSeconds: 60, maxCalls: 60},
    audit: {event: 'vault-notes.note.list-recent', includeInput: false, includeOutput: false},
    confirmationPolicy: {required: false, risk: 'medium'},
  }],
}

describe('optional Vault Notes compatibility fixture', () => {
  it('leaves note.list-recent unexposed while the product keeps aiCallable false and empty ai[]', () => {
    const actions = projectAiCallableAvailableActions({
      moduleId,
      collections: [noteCollection],
      grantedPermissions: [
        `records:module.${moduleId}.${collection}:read`,
        `records:module.${moduleId}.${collection}:write`,
      ],
      manifest: vaultNotesListRecentSurface,
    })
    expect(vaultNotesListRecentSurface.ai).toEqual([])
    expect(vaultNotesListRecentSurface.functions[0]?.aiCallable).toBe(false)
    expect(actions).toEqual([])
    expect(actions.some(action => action.family === 'record.query')).toBe(false)
    expect(actions.some(action => action.actionId?.includes('list-recent'))).toBe(false)
  })
})
