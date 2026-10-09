import {describe, expect, it} from 'vitest'
import {convertLegacyVaultRecord, convertLegacyVaultSettings, legacyVaultTagId} from '../src/modules/legacy-vault-notes-conversion.js'

const createdAt = new Date('2024-01-02T03:04:05.000Z')
const updatedAt = new Date('2024-02-03T04:05:06.000Z')
const installationId = 'test-installation'

describe('historical Vault Notes 0.2 to 1.8 data conversion', () => {
  it('preserves the exact body, title, source and folder identity while creating stable tags', () => {
    const old = {title: 'Example', body: 'First line\n\nSecond line ', tags: ['Important', 'important'],
      folderId: 'old-folder-alias', sourceUri: 'https://example.test/post/1'}
    const result = convertLegacyVaultRecord({recordId: 'note-1', collection: 'note', data: old, revision: 3, createdAt, updatedAt},
      installationId, new Map([['old-folder-alias', 'folder-1']]))
    expect(result.data).toMatchObject({id: 'note-1', title: 'Example', folderId: 'folder-1',
      document: {schemaVersion: '1.0.0', blocks: [{id: 'block-1', type: 'paragraph', text: old.body}]},
      plainTextProjection: old.body.trim(), dataSchemaVersion: '1.0.0', revision: 4,
      source: {sourceType: 'web-url', sourceUrl: old.sourceUri}})
    expect(result.tags).toHaveLength(1)
    expect(result.data.tagIds).toEqual([legacyVaultTagId(installationId, 'Important')])
    expect(result.folderRef).toBe('folder-1')
  })

  it('keeps folder references and stable ordered positions', () => {
    const result = convertLegacyVaultRecord({recordId: 'folder-1', collection: 'folder',
      data: {name: 'Inbox', folderId: 'old-1', parentFolderId: 'old-2'}, revision: 1, createdAt, updatedAt},
      installationId, new Map([['old-2', 'folder-2']]), 2)
    expect(result.data).toMatchObject({id: 'folder-1', name: 'Inbox', parentFolderId: 'folder-2', position: 2,
      createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString()})
  })

  it('maps only settings supported by 1.8; old values remain in the version ledger', () => {
    expect(convertLegacyVaultSettings({autoCreateTitle: false, defaultFolderId: 'folder-1', defaultNoteSort: 'title',
      saveSourceLink: true, confirmBeforeSavingPost: false, showRecentNotesOnBoard: true})).toEqual({defaultSort: 'title'})
    expect(convertLegacyVaultSettings({autoCreateTitle: true, defaultFolderId: null, saveSourceLink: true,
      confirmBeforeSavingPost: true})).toEqual({})
  })

  it('fails closed on old data that cannot be represented without loss', () => {
    const base = {recordId: 'note-1', collection: 'note', revision: 1, createdAt, updatedAt}
    expect(() => convertLegacyVaultRecord({...base, data: {title: 'Example', body: 'x'.repeat(20_001), tags: []}}, installationId, new Map()))
      .toThrow(/cannot be represented losslessly/)
    expect(() => convertLegacyVaultRecord({...base, data: {title: 'Example', body: 'Body', tags: [], unknown: 'value'}}, installationId, new Map()))
      .toThrow(/unsupported field/)
    expect(() => convertLegacyVaultSettings({defaultNoteSort: 'random'})).toThrow(/invalid/)
  })
})
