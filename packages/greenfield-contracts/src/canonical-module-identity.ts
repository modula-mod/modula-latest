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
export const CANONICAL_VAULT_NOTES_CURRENT_VERSION = '2.0.2'
export const CANONICAL_VAULT_NOTES_CURRENT_TAG = 'vault-notes-v2.0.2'
export const CANONICAL_VAULT_NOTES_CURRENT_COMMIT = 'bd5440278831cf97dfa2a6882125d207af013def'
export const CANONICAL_VAULT_NOTES_SOURCE_HEAD = 'bd5440278831cf97dfa2a6882125d207af013def'
export const CANONICAL_VAULT_NOTES_ARTIFACT_SHA256 =
  '2134d04aee1f3f59408f1fbab28c6de2a85aab314515941e16239a74a694c789'
export const CANONICAL_VAULT_NOTES_MANIFEST_SHA256 =
  'b51470ea0ec8a3802557ac776675a12ec5f0bc9e13e6b885af3277d3cc78eae0'
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

// ---------------------------------------------------------------------------
// Generic product identity aliases.
//
// Registry core resolves identities through this data-driven alias map rather
// than product-specific code. The historical aliases below are DATA: they are
// the published identity aliases that already exist in production
// (greenfield_product_identity_aliases) and are seeded here so every process
// resolves them even before the database-backed aliases are loaded. Further
// aliases come from modula.product.json `identity.aliases` via
// registerModuleIdentityAliases().
// ---------------------------------------------------------------------------

export type ModuleIdentityAlias = {alias: string; canonicalId: string}

export const HISTORICAL_MODULE_IDENTITY_ALIASES: readonly ModuleIdentityAlias[] = LEGACY_VAULT_NOTES_MODULE_IDS.map(alias => ({
  alias,
  canonicalId: CANONICAL_VAULT_NOTES_MODULE_ID,
}))

const aliasToCanonical = new Map<string, string>()
const IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/

/**
 * Registers identity aliases. First registration wins: an alias already bound
 * to a different canonical product, an alias that is itself a canonical target,
 * or a canonical id that is itself an alias (a chain) is rejected, never
 * silently re-pointed.
 */
export function registerModuleIdentityAliases(entries: Iterable<ModuleIdentityAlias>): {registered: number; rejected: Array<ModuleIdentityAlias & {reason: string}>} {
  let registered = 0
  const rejected: Array<ModuleIdentityAlias & {reason: string}> = []
  const canonicalTargets = new Set(aliasToCanonical.values())
  for (const entry of entries) {
    const alias = entry.alias?.trim()
    const canonicalId = entry.canonicalId?.trim()
    const reject = (reason: string) => rejected.push({alias: entry.alias, canonicalId: entry.canonicalId, reason})
    if (!alias || !canonicalId || !IDENTITY.test(alias) || !IDENTITY.test(canonicalId)) { reject('malformed identity'); continue }
    if (alias === canonicalId) { reject('alias equals canonical id'); continue }
    const existing = aliasToCanonical.get(alias)
    if (existing === canonicalId) continue
    if (existing) { reject(`alias already resolves to ${existing}`); continue }
    if (canonicalTargets.has(alias)) { reject('alias is a canonical product id'); continue }
    if (aliasToCanonical.has(canonicalId)) { reject('canonical id is itself an alias'); continue }
    aliasToCanonical.set(alias, canonicalId)
    canonicalTargets.add(canonicalId)
    registered += 1
  }
  return {registered, rejected}
}

registerModuleIdentityAliases(HISTORICAL_MODULE_IDENTITY_ALIASES)

export function isModuleIdentityAlias(moduleId: string): boolean {
  return aliasToCanonical.has(moduleId)
}

export function moduleIdentityAliasesFor(canonicalId: string): string[] {
  const aliases: string[] = []
  for (const [alias, target] of aliasToCanonical) if (target === canonicalId) aliases.push(alias)
  return aliases
}

export function moduleIdentityAliases(): ModuleIdentityAlias[] {
  return [...aliasToCanonical].map(([alias, canonicalId]) => ({alias, canonicalId}))
}

export function resolveCanonicalModuleId(moduleId: string): string {
  return aliasToCanonical.get(moduleId) ?? moduleId
}

/** The canonical id followed by every registered alias of it. */
export function moduleIdFamily(moduleId: string): readonly string[] {
  const canonicalId = resolveCanonicalModuleId(moduleId)
  return [canonicalId, ...moduleIdentityAliasesFor(canonicalId)]
}

/**
 * Rewrites registered aliases embedded in identifiers (permission keys, record
 * namespaces, view ids). Canonical ids are protected first, so an alias that is
 * a substring of its canonical id (e.g. `modula.vault-notes` inside
 * `digital.modula.vault-notes`) is never double-prefixed.
 */
export function rewriteModuleIdentityAliases(value: string): string {
  if (!aliasToCanonical.size || !value) return value
  const canonicalIds = [...new Set(aliasToCanonical.values())].sort((a, b) => b.length - a.length)
  const protectedTokens: string[] = []
  let output = value
  for (const canonicalId of canonicalIds) {
    output = output.replace(new RegExp(`(?<![A-Za-z0-9_-])${escapeRegExp(canonicalId)}(?![A-Za-z0-9_-])`, 'g'), () => {
      protectedTokens.push(canonicalId)
      return `\u0000${protectedTokens.length - 1}\u0000`
    })
  }
  // One pass over all aliases (longest first) so replaced text is never rescanned.
  const aliases = [...aliasToCanonical.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp)
  output = output.replace(new RegExp(`(?<![A-Za-z0-9_-])(?:${aliases.join('|')})(?![A-Za-z0-9_-])`, 'g'), match => aliasToCanonical.get(match) ?? match)
  return output.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => protectedTokens[Number(index)]!)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** @deprecated Vault-specific; use moduleIdFamily(). Kept for callers outside registry core. */
export function vaultNotesIdentityFamily(): readonly string[] {
  return [CANONICAL_VAULT_NOTES_MODULE_ID, ...LEGACY_VAULT_NOTES_MODULE_IDS]
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

export function selectCanonicalVaultNotesInstallation<T extends {moduleId: string; status: string}>(
  rows: readonly T[],
): T | undefined {
  const vault = rows.filter(row => isVaultNotesModuleId(row.moduleId) && row.status !== 'removed')
  if (!vault.length) return undefined
  return vault.find(row => row.status === 'enabled') ?? vault[0]
}
