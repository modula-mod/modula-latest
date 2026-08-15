/**
 * Canonical Vault Notes identity.
 *
 * There is one Vault Notes product. Git repository names are not module IDs.
 * Legacy identifiers exist only as migration aliases / tombstones.
 */

export const CANONICAL_VAULT_NOTES_PRODUCT_NAME = 'Vault Notes'
export const CANONICAL_VAULT_NOTES_MODULE_ID = 'digital.modula.vault-notes'
export const CANONICAL_VAULT_NOTES_REPOSITORY = 'modula-mod/modula-vault-notes'
export const CANONICAL_VAULT_NOTES_PUBLISHER = 'Modula'
export const CANONICAL_VAULT_NOTES_PUBLISHER_ID = 'modula'
export const CANONICAL_VAULT_NOTES_CURRENT_VERSION = '1.1.0'
export const CANONICAL_VAULT_NOTES_CURRENT_TAG = 'vault-notes-v1.1.0'
export const CANONICAL_VAULT_NOTES_DATA_NAMESPACE = 'module.digital.modula.vault-notes'
export const CANONICAL_VAULT_NOTES_RELEASE_LINEAGE = 'digital.modula.vault-notes'

export const LEGACY_VAULT_NOTES_MODULE_IDS = [
  'modula.vault-notes',
  'modula.module.vaultNotes',
  'module-vault-notes',
] as const

export const LEGACY_VAULT_NOTES_REPOSITORIES = ['modula-mod/modula-module-vault-notes'] as const

export const HISTORICAL_VAULT_NOTES_REGISTRY_VERSION = '0.2.0'

export type LegacyVaultNotesModuleId = (typeof LEGACY_VAULT_NOTES_MODULE_IDS)[number]

const LEGACY_MODULE_ID_SET = new Set<string>(LEGACY_VAULT_NOTES_MODULE_IDS)

export function isLegacyVaultNotesModuleId(moduleId: string): boolean {
  return LEGACY_MODULE_ID_SET.has(moduleId)
}

export function isVaultNotesModuleId(moduleId: string): boolean {
  return moduleId === CANONICAL_VAULT_NOTES_MODULE_ID || isLegacyVaultNotesModuleId(moduleId)
}

export function resolveCanonicalModuleId(moduleId: string): string {
  return isLegacyVaultNotesModuleId(moduleId) ? CANONICAL_VAULT_NOTES_MODULE_ID : moduleId
}

export function vaultNotesIdentityFamily(): readonly string[] {
  return [CANONICAL_VAULT_NOTES_MODULE_ID, ...LEGACY_VAULT_NOTES_MODULE_IDS]
}

export function moduleIdFamily(moduleId: string): readonly string[] {
  return isVaultNotesModuleId(moduleId) ? vaultNotesIdentityFamily() : [resolveCanonicalModuleId(moduleId)]
}

/**
 * Rewrite a single string that may contain a legacy Vault Notes module ID.
 * `digital.modula.vault-notes` contains the substring `modula.vault-notes`,
 * so replacements must not touch the already-canonical form.
 */
export function rewriteLegacyVaultNotesId(value: string): string {
  return value
    .replaceAll('modula.module.vaultNotes', CANONICAL_VAULT_NOTES_MODULE_ID)
    .replaceAll('module-vault-notes', CANONICAL_VAULT_NOTES_MODULE_ID)
    .replace(/(?<!digital\.)modula\.vault-notes/g, CANONICAL_VAULT_NOTES_MODULE_ID)
}

export function rewriteLegacyVaultNotesValue<T>(value: T): T {
  if (typeof value === 'string') return rewriteLegacyVaultNotesId(value) as T
  if (Array.isArray(value)) return value.map(item => rewriteLegacyVaultNotesValue(item)) as T
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      rewriteLegacyVaultNotesId(key),
      rewriteLegacyVaultNotesValue(nested),
    ])
    return Object.fromEntries(entries) as T
  }
  return value
}

export function isCanonicalVaultNotesRepository(repository: string): boolean {
  const normalised = repository
    .replace(/^https:\/\/github\.com\//, '')
    .replace(/^git@github\.com:/, '')
    .replace(/\.git$/, '')
  return normalised === CANONICAL_VAULT_NOTES_REPOSITORY
}

export function isLegacyVaultNotesRepository(repository: string): boolean {
  const normalised = repository
    .replace(/^https:\/\/github\.com\//, '')
    .replace(/^git@github\.com:/, '')
    .replace(/\.git$/, '')
  return (LEGACY_VAULT_NOTES_REPOSITORIES as readonly string[]).includes(normalised)
}
