import {describe, expect, it} from 'vitest'
import {
  CANONICAL_VAULT_NOTES_MODULE_ID,
  CANONICAL_VAULT_NOTES_REPOSITORY,
  isLegacyVaultNotesModuleId,
  resolveCanonicalModuleId,
  rewriteLegacyVaultNotesId,
  vaultNotesIdentityFamily,
} from '@modula/greenfield-contracts'
import {classifyBetaModule} from '../src/modules/beta-catalogue-policy.js'

describe('Vault Notes canonical identity', () => {
  it('maps every legacy ID onto one module ID', () => {
    expect(resolveCanonicalModuleId('modula.vault-notes')).toBe(CANONICAL_VAULT_NOTES_MODULE_ID)
    expect(resolveCanonicalModuleId('modula.module.vaultNotes')).toBe(CANONICAL_VAULT_NOTES_MODULE_ID)
    expect(resolveCanonicalModuleId('module-vault-notes')).toBe(CANONICAL_VAULT_NOTES_MODULE_ID)
    expect(resolveCanonicalModuleId(CANONICAL_VAULT_NOTES_MODULE_ID)).toBe(CANONICAL_VAULT_NOTES_MODULE_ID)
    expect(isLegacyVaultNotesModuleId('modula.vault-notes')).toBe(true)
    expect(isLegacyVaultNotesModuleId(CANONICAL_VAULT_NOTES_MODULE_ID)).toBe(false)
  })

  it('does not double-prefix digital.modula.vault-notes', () => {
    expect(rewriteLegacyVaultNotesId('digital.modula.vault-notes')).toBe(CANONICAL_VAULT_NOTES_MODULE_ID)
    expect(rewriteLegacyVaultNotesId('modula.vault-notes.views.home')).toBe('digital.modula.vault-notes.views.home')
    expect(rewriteLegacyVaultNotesId('records:module.modula.vault-notes.note:read')).toBe(
      'records:module.digital.modula.vault-notes.note:read',
    )
  })

  it('hides the legacy ID as a Product Hub product', () => {
    expect(classifyBetaModule({moduleId: 'modula.vault-notes', status: 'published'})).toMatchObject({
      classification: 'DUPLICATE',
      visibleInBeta: false,
      canonicalModuleId: CANONICAL_VAULT_NOTES_MODULE_ID,
    })
    expect(vaultNotesIdentityFamily()).toContain(CANONICAL_VAULT_NOTES_MODULE_ID)
    expect(CANONICAL_VAULT_NOTES_REPOSITORY).toBe('modula-mod/modula-vault-notes')
  })

  it('classifies registry rows so legacy IDs cannot stay active products', async () => {
    const {classifyVaultNotesRow} = await import('../../../scripts/dump-vault-notes-registry.mjs')
    expect(classifyVaultNotesRow({moduleId: 'digital.modula.vault-notes', sourceRepository: 'modula-mod/modula-vault-notes'})).toBe('CANONICAL')
    expect(classifyVaultNotesRow({moduleId: 'modula.vault-notes'})).toBe('LEGACY_ALIAS')
    expect(classifyVaultNotesRow({
      moduleId: 'digital.modula.vault-notes',
      sourceRepository: 'modula-mod/modula-module-vault-notes',
    })).toBe('STALE')
    expect(classifyVaultNotesRow({moduleId: 'something.else', name: 'Vault Notes'})).toBe('DUPLICATE_INVALID')
  })
})
