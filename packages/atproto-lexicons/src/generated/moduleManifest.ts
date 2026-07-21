/**
 * Hand-written types mirroring lexicons/digital/modula/temp/moduleManifest.json.
 * Keep in sync with the JSON lexicon by hand until a codegen script replaces this file.
 */

export const MODULE_MANIFEST_NSID = 'digital.modula.temp.moduleManifest' as const

export interface ModulaModuleManifestRecord {
  $type?: typeof MODULE_MANIFEST_NSID
  createdAt: string
  moduleId: string
  name: string
  publicDescription?: string
  publicVersion: string
  publisherDid: string
  repository?: string
  homepage?: string
  permissionSummary?: string
  compatibility?: string
}

export function isModulaModuleManifestRecord(value: unknown): value is ModulaModuleManifestRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.createdAt === 'string' &&
    typeof record.moduleId === 'string' &&
    typeof record.name === 'string' &&
    typeof record.publicVersion === 'string' &&
    typeof record.publisherDid === 'string'
  )
}
