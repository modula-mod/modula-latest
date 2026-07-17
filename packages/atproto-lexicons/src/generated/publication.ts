/**
 * Hand-written types mirroring lexicons/digital/modula/temp/publication.json.
 * Keep in sync with the JSON lexicon by hand until a codegen script replaces this file.
 */

export const PUBLICATION_NSID = 'digital.modula.temp.publication' as const

export interface ModulaPublicationPostRef {
  uri: string
  cid: string
}

export interface ModulaPublicationPresentation {
  mediaBacklight?: boolean
  profileTab?: string
}

export interface ModulaPublicationRecord {
  $type?: typeof PUBLICATION_NSID
  createdAt: string
  post: ModulaPublicationPostRef
  contentKind?: string
  moduleId?: string
  modulaCanonicalUrl?: string
  presentation?: ModulaPublicationPresentation
}

export function isModulaPublicationRecord(value: unknown): value is ModulaPublicationRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (typeof record.createdAt !== 'string') return false
  const post = record.post as Record<string, unknown> | undefined
  return typeof post?.uri === 'string' && typeof post?.cid === 'string'
}
