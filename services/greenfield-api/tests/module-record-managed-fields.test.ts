import {describe, expect, it} from 'vitest'
import type {GreenfieldModuleCollectionDefinition} from '@modula/greenfield-module-ui-contracts'
import {populateServerManagedFields} from '../src/modules/record-service.js'

const collection: GreenfieldModuleCollectionDefinition = {
  collection: 'folder',
  schemaRef: 'schemas/folder.json',
  defaultVisibility: 'private',
  fields: [
    {fieldId: 'id', name: 'id', type: 'text', label: 'ID', required: true},
    {fieldId: 'name', name: 'name', type: 'text', label: 'Name', required: true},
    {fieldId: 'createdAt', name: 'createdAt', type: 'dateTime', label: 'Created at', required: true},
    {fieldId: 'updatedAt', name: 'updatedAt', type: 'dateTime', label: 'Updated at', required: true},
  ],
  searchableFields: ['name'],
  filterableFields: [],
  sortableFields: ['name'],
  retentionPolicy: 'keepOnUninstall',
}

describe('server managed module record fields', () => {
  it('fills declared identity and timestamps without mutating the caller payload', () => {
    const supplied = {name: 'Work'}
    const filled = populateServerManagedFields(collection, supplied, 'server-record-1', new Date('2026-10-17T12:00:00.000Z'))
    expect(filled).toEqual({
      name: 'Work', id: 'server-record-1',
      createdAt: '2026-10-17T12:00:00.000Z', updatedAt: '2026-10-17T12:00:00.000Z',
    })
    expect(supplied).toEqual({name: 'Work'})
  })

  it('leaves explicit imported values and undeclared fields alone', () => {
    const filled = populateServerManagedFields(collection, {name: 'Archive', id: 'imported', createdAt: 'old'}, 'server-record-2', new Date('2026-10-17T12:00:00.000Z'))
    expect(filled.id).toBe('imported')
    expect(filled.createdAt).toBe('old')
    expect(filled.updatedAt).toBe('2026-10-17T12:00:00.000Z')
  })
})
