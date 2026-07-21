import {describe, expect, it} from 'vitest'
import {defineFunction, defineSchema, defineTool, moduleRecordCollection} from '../src/index.js'

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
})
