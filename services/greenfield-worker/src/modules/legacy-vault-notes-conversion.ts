import {createHash} from 'node:crypto'

/**
 * Historical Vault Notes 0.1/0.2 -> 1.8 data adapter. This is deliberately
 * isolated from the generic host and applies only while leaving an unsigned
 * legacy installation. Unknown old data fails the migration before rebinding.
 */
export type LegacyVaultRecord = {
  recordId: string
  collection: string
  data: unknown
  revision: number
  createdAt: Date
  updatedAt: Date
}

export type ConvertedVaultRecord = {
  data: Record<string, unknown>
  searchText: string
  folderRef: string | null
  sourceUri: string | null
  tags: Array<{id: string; name: string; normalizedName: string}>
}

const NOTE_KEYS = new Set(['noteId', 'title', 'body', 'folderId', 'sourceUri', 'tags', 'visibility', 'createdAt', 'updatedAt'])
const FOLDER_KEYS = new Set(['folderId', 'name', 'parentFolderId', 'visibility', 'createdAt', 'updatedAt'])
const SETTINGS_KEYS = new Set(['defaultFolderId', 'autoCreateTitle', 'saveSourceLink', 'confirmBeforeSavingPost', 'defaultNoteSort', 'showRecentNotesOnBoard'])

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} is not an object`)
  return value as Record<string, unknown>
}

function knownKeys(data: Record<string, unknown>, allowed: Set<string>, label: string) {
  for (const key of Object.keys(data)) if (!allowed.has(key)) throw new Error(`${label} has an unsupported field ${key}`)
}

function date(value: unknown, fallback: Date, label: string): string {
  if (value === undefined || value === null) return fallback.toISOString()
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`${label} is not an ISO date`)
  return new Date(value).toISOString()
}

function text(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) throw new Error(`${label} is invalid`)
  return value
}

function optionalText(value: unknown, label: string, max: number): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} is invalid`)
  return value || null
}

export function legacyVaultTagId(installationId: string, label: string): string {
  return `legacy-tag-${createHash('sha256').update(`${installationId}\0${label.trim().toLocaleLowerCase('en-US')}`).digest('hex').slice(0, 40)}`
}

export function convertLegacyVaultRecord(input: LegacyVaultRecord, installationId: string, folderIds: ReadonlyMap<string, string>, folderPosition = 0): ConvertedVaultRecord {
  const old = object(input.data, `${input.collection} record`)
  if (input.collection === 'note') {
    knownKeys(old, NOTE_KEYS, 'Legacy note')
    const title = text(old.title, 'Legacy note title', 240)
    const body = typeof old.body === 'string' ? old.body : null
    if (body === null || body.length > 20_000) throw new Error('Legacy note body cannot be represented losslessly as one rich-text block')
    if (!Array.isArray(old.tags) || old.tags.length > 40) throw new Error('Legacy note tags are invalid')
    const tags = [...new Map(old.tags.map(value => {
      const name = text(value, 'Legacy note tag', 60)
      const normalizedName = name.trim().toLocaleLowerCase('en-US')
      if (!normalizedName) throw new Error('Legacy note tag is empty')
      return [normalizedName, {id: legacyVaultTagId(installationId, name), name, normalizedName}]
    })).values()]
    const oldFolderId = optionalText(old.folderId, 'Legacy note folder ID', 120)
    const folderRef = oldFolderId ? folderIds.get(oldFolderId) ?? oldFolderId : null
    const sourceUri = optionalText(old.sourceUri, 'Legacy note source URI', 1000)
    if (sourceUri) {
      try { new URL(sourceUri) } catch { throw new Error('Legacy note source URI is invalid') }
    }
    const createdAt = date(old.createdAt, input.createdAt, 'Legacy note createdAt')
    const updatedAt = date(old.updatedAt, input.updatedAt, 'Legacy note updatedAt')
    const data: Record<string, unknown> = {
      id: input.recordId,
      title,
      document: {schemaVersion: '1.0.0', blocks: body ? [{id: 'block-1', type: 'paragraph', text: body}] : []},
      plainTextProjection: body.trim(),
      tagIds: tags.map(tag => tag.id),
      pinned: false,
      favourite: false,
      archived: false,
      revision: input.revision + 1,
      createdAt,
      updatedAt,
      dataSchemaVersion: '1.0.0',
    }
    if (folderRef) data.folderId = folderRef
    if (sourceUri) data.source = {sourceType: /^https?:\/\//i.test(sourceUri) ? 'web-url' : 'manual', sourceUrl: sourceUri, capturedAt: createdAt}
    return {data, searchText: `${title} ${body} ${tags.map(tag => tag.name).join(' ')}`.trim(), folderRef, sourceUri, tags}
  }
  if (input.collection === 'folder') {
    knownKeys(old, FOLDER_KEYS, 'Legacy folder')
    const name = text(old.name, 'Legacy folder name', 120)
    const parent = optionalText(old.parentFolderId, 'Legacy parent folder ID', 120)
    const parentFolderId = parent ? folderIds.get(parent) ?? parent : null
    const data: Record<string, unknown> = {
      id: input.recordId,
      name,
      position: folderPosition,
      createdAt: date(old.createdAt, input.createdAt, 'Legacy folder createdAt'),
      updatedAt: date(old.updatedAt, input.updatedAt, 'Legacy folder updatedAt'),
    }
    if (parentFolderId) data.parentFolderId = parentFolderId
    return {data, searchText: name, folderRef: parentFolderId, sourceUri: null, tags: []}
  }
  throw new Error(`No legacy Vault conversion for collection ${input.collection}`)
}

export function convertLegacyVaultSettings(value: unknown): Record<string, unknown> {
  const old = object(value, 'Legacy Vault settings')
  knownKeys(old, SETTINGS_KEYS, 'Legacy Vault settings')
  const next: Record<string, unknown> = {}
  if (old.defaultNoteSort !== undefined) {
    if (!['updatedAt', 'createdAt', 'title'].includes(String(old.defaultNoteSort))) throw new Error('Legacy default note sort is invalid')
    next.defaultSort = old.defaultNoteSort
  }
  // Other v0 settings have no equivalent in the 1.8 settings schema. Their
  // exact values remain recoverable in greenfield_module_settings_versions.
  return next
}
