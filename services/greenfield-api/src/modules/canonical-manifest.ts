import {
  CANONICAL_VAULT_NOTES_MODULE_ID,
  CANONICAL_VAULT_NOTES_PUBLISHER,
  CANONICAL_VAULT_NOTES_PUBLISHER_ID,
  CANONICAL_VAULT_NOTES_REPOSITORY,
  isVaultNotesModuleId,
  rewriteLegacyVaultNotesValue,
} from '@modula/greenfield-contracts'
import {manifestChecksum, type GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'

/**
 * Overlay a Vault Notes source manifest onto the single canonical product identity.
 * Source files may still declare `modula.vault-notes` until the GitHub repo is
 * updated; the registry must never publish that as a competing product.
 */
export function canonicalizeVaultNotesManifest(manifest: GreenfieldModuleManifest): GreenfieldModuleManifest {
  if (!isVaultNotesModuleId(manifest.moduleId)) return manifest
  const rewritten = rewriteLegacyVaultNotesValue(manifest)
  rewritten.moduleId = CANONICAL_VAULT_NOTES_MODULE_ID
  rewritten.name = 'Vault Notes'
  rewritten.publisher = {
    ...rewritten.publisher,
    publisherId: rewritten.publisher?.publisherId || CANONICAL_VAULT_NOTES_PUBLISHER_ID,
    displayName: rewritten.publisher?.displayName || CANONICAL_VAULT_NOTES_PUBLISHER,
  }
  rewritten.source = {
    ...rewritten.source,
    provider: rewritten.source?.provider ?? 'github',
    repository: CANONICAL_VAULT_NOTES_REPOSITORY,
    commit: rewritten.source?.commit ?? '',
    manifestPath: rewritten.source?.manifestPath ?? 'module.manifest.json',
  }
  const withoutChecksum = {
    ...rewritten,
    integrity: {...rewritten.integrity, manifestSha256: ''},
  }
  rewritten.integrity = {
    ...rewritten.integrity,
    manifestSha256: manifestChecksum(withoutChecksum),
  }
  return rewritten
}
