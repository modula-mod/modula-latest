import {describe, expect, it} from 'vitest'
import {validateGreenfieldModuleAction, validateGreenfieldModuleCollection, validateGreenfieldModuleView} from '../src/index.js'

const moduleId = 'audit.module.alpha'

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
          inputSchema: {schemaRef: 'schemas/alpha-note.v1.schema.json'},
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
      schemaRef: 'schemas/alpha-note.v1.schema.json',
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
      schemaRef: 'schemas/alpha-note.v1.schema.json',
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

  it('validates neutral query filters, rich-text transforms, and confirmed purge', () => {
    const taskModuleId = 'audit.module.beta'
    const action = {
      actionId: `${taskModuleId}.actions.purge-task`,
      kind: 'record.purge' as const,
      label: 'Delete permanently',
      inputSchema: {fields: [{fieldId: 'description', name: 'description', type: 'richText' as const, label: 'Description'}]},
      capability: `records:module.${taskModuleId}.task:delete`,
      confirmationPolicy: 'confirmDestructive' as const,
      destructive: true,
      successDestination: {kind: 'stay' as const},
      errorPresentation: {kind: 'inline' as const},
      requiresIdempotencyKey: true,
      inputDefaults: {completed: false},
      inputTransforms: [{target: 'plainTextProjection', source: 'description', transform: 'richText.plainText@1' as const}],
      target: {collection: 'task'},
    }
    const view = validateGreenfieldModuleView({
      viewId: `${taskModuleId}.views.trash`,
      moduleId: taskModuleId,
      kind: 'collection',
      title: 'Deleted tasks',
      collection: 'task',
      query: {
        collection: 'task',
        defaultLimit: 25,
        maxLimit: 100,
        allowedSortFields: ['updatedAt'],
        allowedFilterFields: ['completed'],
        searchableFields: ['title'],
        filters: {completed: false},
        recordState: 'deleted',
      },
      requiredCapabilities: [],
      toolbar: [action],
      layout: [{id: 'tasks', component: 'recordList', collection: 'task'}],
    })
    expect(view.valid).toBe(true)
    expect(validateGreenfieldModuleAction(action, taskModuleId).valid).toBe(true)
    expect(validateGreenfieldModuleAction({...action, destructive: false}, taskModuleId).issues.map(issue => issue.code)).toContain('PURGE_REQUIRES_CONFIRMATION')
  })
})
