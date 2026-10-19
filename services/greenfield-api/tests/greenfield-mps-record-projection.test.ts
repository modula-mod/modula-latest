import {describe, expect, it} from 'vitest'
import {projectMpsRecordCollections} from '../src/product-standard/record-projection.js'

const manifest = {
  backend: {
    mode: 'greenfield-records',
    records: [{id: 'task', schemaPath: 'schemas/task.schema.json', schemaVersion: '1.0.0'}],
  },
}

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'completed'],
  properties: {
    title: {type: 'string', maxLength: 160},
    description: {type: 'string', maxLength: 4000},
    completed: {type: 'boolean'},
    priority: {type: 'string', enum: ['low', 'normal', 'high']},
    dueDate: {type: 'string', format: 'date'},
  },
}

const frontend = {
  views: [
    {
      id: 'home',
      bindings: [{
        source: 'record.query',
        recordType: 'task',
        query: {searchParam: 'q', filterParam: 'filter', sortParam: 'sort', filters: {completed: false}},
      }],
    },
    {
      id: 'editor',
      bindings: [{source: 'record.detail', recordType: 'task', recordIdParam: 'taskId'}],
      root: {
        type: 'section',
        children: [
          {type: 'field', field: {id: 'title', type: 'text', label: 'Task title', required: true}},
          {type: 'field', field: {id: 'description', type: 'multilineText', label: 'Description'}},
          {type: 'field', field: {id: 'priority', type: 'singleSelect', label: 'Priority', options: [{value: 'normal', label: 'Normal'}]}},
        ],
      },
    },
  ],
}

describe('MPS record runtime projection', () => {
  it('projects closed product schemas and frontend query policy without a product branch', () => {
    const [collection] = projectMpsRecordCollections({
      manifest,
      frontend,
      schemas: [{path: 'schemas/task.schema.json', bytes: JSON.stringify(schema)}],
    })
    expect(collection).toMatchObject({
      collection: 'task',
      schemaRef: 'schemas/task.schema.json',
      defaultVisibility: 'private',
      searchableFields: ['title', 'description'],
      filterableFields: ['title', 'description', 'completed', 'priority', 'dueDate'],
      sortableFields: ['title', 'description', 'completed', 'priority', 'dueDate'],
    })
    expect(collection.fields).toMatchObject([
      {fieldId: 'title', type: 'text', label: 'Task title', required: true},
      {fieldId: 'description', type: 'multilineText'},
      {fieldId: 'completed', type: 'boolean', required: true},
      {fieldId: 'priority', type: 'singleSelect'},
      {fieldId: 'dueDate', type: 'date'},
    ])
  })

  it('rejects missing, traversing, oversized, and open record schema artifacts', () => {
    expect(() => projectMpsRecordCollections({manifest, frontend, schemas: []})).toThrow(/schema .* is required/i)
    expect(() => projectMpsRecordCollections({
      manifest: {backend: {mode: 'greenfield-records', records: [{id: 'task', schemaPath: '../task.json'}]}},
      frontend,
      schemas: [{path: '../task.json', bytes: JSON.stringify(schema)}],
    })).toThrow(/schemaPath is invalid|Unsafe MPS record schema path/)
    expect(() => projectMpsRecordCollections({
      manifest,
      frontend,
      schemas: [{path: 'schemas/task.schema.json', bytes: Buffer.alloc(256 * 1024 + 1)}],
    })).toThrow(/exceeds safety limits/)
    expect(() => projectMpsRecordCollections({
      manifest,
      frontend,
      schemas: [{path: 'schemas/task.schema.json', bytes: JSON.stringify({...schema, additionalProperties: true})}],
    })).toThrow(/closed object schema/)
  })

  it('rejects frontend filters outside the declared record schema', () => {
    const unsafeFrontend = structuredClone(frontend)
    unsafeFrontend.views[0].bindings[0].query.filters = {otherProductField: true}
    expect(() => projectMpsRecordCollections({
      manifest,
      frontend: unsafeFrontend,
      schemas: [{path: 'schemas/task.schema.json', bytes: JSON.stringify(schema)}],
    })).toThrow(/not declared by record schema/)
  })

  it('projects generic local JSON Schema references and scalar constants', () => {
    const referencedSchema = {
      ...schema,
      required: [...schema.required, 'source', 'schemaVersion'],
      properties: {
        ...schema.properties,
        source: {$ref: './source.schema.json'},
        schemaVersion: {const: '1.0.0'},
      },
    }
    const [collection] = projectMpsRecordCollections({
      manifest,
      frontend,
      schemas: [{path: 'schemas/task.schema.json', bytes: JSON.stringify(referencedSchema)}],
    })
    expect(collection.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({fieldId: 'source', type: 'json', required: true}),
      expect.objectContaining({fieldId: 'schemaVersion', type: 'text', required: true}),
    ]))
    expect(() => projectMpsRecordCollections({
      manifest,
      frontend,
      schemas: [{
        path: 'schemas/task.schema.json',
        bytes: JSON.stringify({
          ...schema,
          properties: {...schema.properties, source: {$ref: 'https://untrusted.example/source.schema.json'}},
        }),
      }],
    })).toThrow(/Unsafe MPS record schema field reference/)
  })

  it('projects bounded legacy scalar and structured-reference unions without widening schema validation', () => {
    const compatibleSchema = {
      ...schema,
      properties: {
        ...schema.properties,
        parentId: {oneOf: [{type: 'string'}, {$ref: '#/$defs/recordReference'}, {type: 'null'}]},
      },
    }
    const [collection] = projectMpsRecordCollections({
      manifest,
      frontend,
      schemas: [{path: 'schemas/task.schema.json', bytes: JSON.stringify(compatibleSchema)}],
    })
    expect(collection.fields).toEqual(expect.arrayContaining([expect.objectContaining({fieldId: 'parentId', type: 'json'})]))
    expect(collection.schemaDefinition).toEqual(compatibleSchema)
    const invalid = structuredClone(compatibleSchema)
    invalid.properties.parentId.oneOf[1] = {$ref: 'https://unsafe.example/ref.json'}
    expect(() => projectMpsRecordCollections({manifest, frontend, schemas: [{path: 'schemas/task.schema.json', bytes: JSON.stringify(invalid)}]})).toThrow(/Unsafe MPS record schema field reference/)
  })

  it('projects declared array membership used by generic tag routes', () => {
    const taggedSchema = {
      ...schema,
      properties: {...schema.properties, tagIds: {type: 'array', items: {type: 'string'}}},
    }
    const taggedFrontend = structuredClone(frontend) as any
    taggedFrontend.views[0].bindings[0].query.membership = {field: 'tagIds', param: 'tagId'}
    const [collection] = projectMpsRecordCollections({
      manifest, frontend: taggedFrontend,
      schemas: [{path: 'schemas/task.schema.json', bytes: JSON.stringify(taggedSchema)}],
    })
    expect(collection.filterableFields).toContain('tagIds')
    taggedFrontend.views[0].bindings[0].query.membership.field = 'undeclared'
    expect(() => projectMpsRecordCollections({
      manifest, frontend: taggedFrontend,
      schemas: [{path: 'schemas/task.schema.json', bytes: JSON.stringify(taggedSchema)}],
    })).toThrow(/not declared by record schema/)
  })
})
