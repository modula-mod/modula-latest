/**
 * Hand-written types mirroring lexicons/digital/modula/temp/profileExtension.json.
 * Keep in sync with the JSON lexicon by hand until a codegen script replaces this file.
 */

export const PROFILE_EXTENSION_NSID = 'digital.modula.temp.profileExtension' as const

export interface ModulaProfileExtensionCapability {
  id: string
  label?: string
}

export interface ModulaProfileExtensionRecord {
  $type?: typeof PROFILE_EXTENSION_NSID
  createdAt: string
  profileKind?: string
  publicWebsite?: string
  publicFocusStatus?: string
  capabilities?: ModulaProfileExtensionCapability[]
}

export function isModulaProfileExtensionRecord(value: unknown): value is ModulaProfileExtensionRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.createdAt === 'string'
}
