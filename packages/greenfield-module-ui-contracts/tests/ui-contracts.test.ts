import {describe, expect, it} from 'vitest'
import {validateGreenfieldModuleCollection, validateGreenfieldModuleView} from '../src/index.js'

const moduleId = 'digital.modula.vault-notes'

describe('Greenfield module UI contracts', () => {
  it('accepts declarative module views and actions', () => {
    const result = validateGreenfieldModuleView({
      viewId: `${moduleId}.views.note-list`,
      moduleId,
      kind: 'collection',
      title: 'Notes',
      collection: 'note',
      query: {
        collection: 'note',
        defaultLimit: 25,
        maxLimit: 50,
        allowedSortFields: ['updatedAt', 'title'],
        allowedFilterFields: ['folderId'],
        searchableFields: ['title', 'body', 'tags', 'sourceUri'],
      },
      requiredCapabilities: [`records:module.${moduleId}.note:read`],
      toolbar: [
        {
          actionId: `${moduleId}.actions.create-note`,
          kind: 'record.create',
          label: 'Create note',
          inputSchema: {schemaRef: 'schemas/vault-note.v1.schema.json'},
          capability: `records:module.${moduleId}.note:write`,
          confirmationPolicy: 'none',
          destructive: false,
          successDestination: {kind: 'view', viewId: `${moduleId}.views.note-detail`},
          errorPresentation: {kind: 'inline'},
          requiresIdempotencyKey: true,
          target: {collection: 'note'},
        },
      ],
      layout: [{id: 'notes', component: 'recordList', collection: 'note'}],
    })
    expect(result.valid).toBe(true)
  })

  it('rejects executable and remote UI declarations', () => {
    const result = validateGreenfieldModuleView({
      viewId: `${moduleId}.views.bad`,
      moduleId,
      kind: 'detail',
      title: 'Bad',
      requiredCapabilities: [],
      layout: [{id: 'bad', component: 'text', html: '<script>alert(1)</script>'}],
    })
    expect(result.valid).toBe(false)
    expect(result.issues.map(issue => issue.code)).toContain('FORBIDDEN_DECLARATIVE_KEY')
  })

  it('requires secret references for sensitive fields', () => {
    const result = validateGreenfieldModuleCollection({
      collection: 'note',
      schemaRef: 'schemas/vault-note.v1.schema.json',
      defaultVisibility: 'private',
      fields: [{fieldId: 'apiKey', name: 'apiKey', type: 'text', label: 'API key', sensitive: true}],
      searchableFields: ['title'],
      filterableFields: ['folderId'],
      sortableFields: ['updatedAt'],
    })
    expect(result.valid).toBe(false)
    expect(result.issues.map(issue => issue.code)).toContain('SENSITIVE_FIELD_REQUIRES_SECRET_REF')
  })

  it('accepts persisted JSON schema definitions for server-side record validation', () => {
    const result = validateGreenfieldModuleCollection({
      collection: 'note',
      schemaRef: 'schemas/vault-note.v1.schema.json',
      defaultVisibility: 'private',
      fields: [{fieldId: 'title', name: 'title', type: 'text', label: 'Title', required: true}],
      searchableFields: ['title'],
      filterableFields: ['folderId'],
      sortableFields: ['updatedAt'],
      schemaDefinition: {
        type: 'object',
        required: ['title'],
        properties: {
          title: {type: 'string', maxLength: 160},
        },
      },
      retentionPolicy: 'keepOnUninstall',
    })
    expect(result.valid).toBe(true)
  })
})
