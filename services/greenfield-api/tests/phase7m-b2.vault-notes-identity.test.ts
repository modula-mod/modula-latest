import {describe, expect, it} from 'vitest'
import {
  CANONICAL_VAULT_NOTES_ARTIFACT_SHA256,
  CANONICAL_VAULT_NOTES_CURRENT_COMMIT,
  CANONICAL_VAULT_NOTES_CURRENT_TAG,
  CANONICAL_VAULT_NOTES_CURRENT_VERSION,
  CANONICAL_VAULT_NOTES_MANIFEST_SHA256,
  CANONICAL_VAULT_NOTES_DATA_NAMESPACE,
  CANONICAL_VAULT_NOTES_MODULE_ID,
  CANONICAL_VAULT_NOTES_REPOSITORY,
  isCanonicalVaultNotesRepository,
  isLegacyVaultNotesModuleId,
  isLegacyVaultNotesRepository,
  resolveCanonicalModuleId,
  rewriteLegacyVaultNotesId,
  rewriteLegacyVaultNotesValue,
  selectCanonicalVaultNotesInstallation,
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
      current: true,
    })).toBe('STALE')
    expect(classifyVaultNotesRow({
      moduleId: 'digital.modula.vault-notes',
      sourceRepository: 'modula-mod/modula-module-vault-notes',
      version: '0.1.0',
      historical: true,
    })).toBe('HISTORICAL_RELEASE')
    expect(classifyVaultNotesRow({moduleId: 'something.else', name: 'Vault Notes'})).toBe('DUPLICATE_INVALID')
  })

  it('legacy product is hidden so Product Hub count is 1', () => {
    const rows = [
      {moduleId: CANONICAL_VAULT_NOTES_MODULE_ID, status: 'published', name: 'Vault Notes'},
      {moduleId: 'modula.vault-notes', status: 'published', name: 'Vault Notes'},
      {moduleId: 'modula.module.vaultNotes', status: 'unavailable', name: 'Vault Notes'},
      {moduleId: CANONICAL_VAULT_NOTES_MODULE_ID, status: 'superseded', name: 'Vault Notes'},
    ]
    const visible = rows.filter(row => classifyBetaModule(row).visibleInBeta)
    expect(visible).toHaveLength(1)
    expect(visible[0]!.moduleId).toBe(CANONICAL_VAULT_NOTES_MODULE_ID)
  })

  it('search result count is 1 for the Vault Notes family', () => {
    const hits = [
      {moduleId: CANONICAL_VAULT_NOTES_MODULE_ID, name: 'Vault Notes'},
      {moduleId: 'modula.vault-notes', name: 'Vault Notes'},
      {moduleId: 'modula.module.vaultNotes', name: 'Vault Notes'},
    ].filter(row => classifyBetaModule({moduleId: row.moduleId, status: 'published'}).visibleInBeta)
    expect(hits).toHaveLength(1)
  })

  it('refuses a second family install by collapsing to one logical row', () => {
    const selected = selectCanonicalVaultNotesInstallation([
      {moduleId: 'modula.vault-notes', status: 'enabled', installationId: 'legacy'},
      {moduleId: CANONICAL_VAULT_NOTES_MODULE_ID, status: 'installedDisabled', installationId: 'canonical'},
      {moduleId: CANONICAL_VAULT_NOTES_MODULE_ID, status: 'removed', installationId: 'gone'},
    ])
    expect(selected).toMatchObject({installationId: 'legacy', status: 'enabled'})
    expect(selectCanonicalVaultNotesInstallation([
      {moduleId: 'modula.vault-notes', status: 'removed'},
      {moduleId: CANONICAL_VAULT_NOTES_MODULE_ID, status: 'removed'},
    ])).toBeUndefined()
  })

  it('migrates note ownership onto the canonical namespace without duplicating', () => {
    const before = [
      {accountId: 'A', moduleId: 'modula.vault-notes', recordId: 'note-a', title: 'Note A'},
      {accountId: 'A', moduleId: 'modula.vault-notes', recordId: 'note-b', title: 'Note B'},
    ]
    const after = rewriteLegacyVaultNotesValue(before)
    expect(after.map(row => row.moduleId)).toEqual([CANONICAL_VAULT_NOTES_MODULE_ID, CANONICAL_VAULT_NOTES_MODULE_ID])
    expect(after.map(row => row.title)).toEqual(['Note A', 'Note B'])
    expect(new Set(after.map(row => `${row.accountId}:${row.recordId}`)).size).toBe(2)
    expect(CANONICAL_VAULT_NOTES_DATA_NAMESPACE).toBe('module.digital.modula.vault-notes')
  })

  it('records canonical source provenance for the current release', () => {
    expect(isCanonicalVaultNotesRepository(CANONICAL_VAULT_NOTES_REPOSITORY)).toBe(true)
    expect(isLegacyVaultNotesRepository('modula-mod/modula-module-vault-notes')).toBe(true)
    expect(CANONICAL_VAULT_NOTES_CURRENT_VERSION).toBe('2.0.2')
    expect(CANONICAL_VAULT_NOTES_CURRENT_TAG).toBe('vault-notes-v2.0.2')
    expect(CANONICAL_VAULT_NOTES_CURRENT_COMMIT).toBe('bd5440278831cf97dfa2a6882125d207af013def')
  })

  it('records the current release artifact checksum', () => {
    expect(CANONICAL_VAULT_NOTES_ARTIFACT_SHA256).toMatch(/^[0-9a-f]{64}$/)
    expect(CANONICAL_VAULT_NOTES_ARTIFACT_SHA256).toBe(
      '2134d04aee1f3f59408f1fbab28c6de2a85aab314515941e16239a74a694c789',
    )
    expect(CANONICAL_VAULT_NOTES_MANIFEST_SHA256).toBe('b51470ea0ec8a3802557ac776675a12ec5f0bc9e13e6b885af3277d3cc78eae0')
  })

  it('treats an old family installation as an alias of the canonical product', () => {
    const upgraded = selectCanonicalVaultNotesInstallation([
      {moduleId: 'modula.vault-notes', status: 'enabled', version: '1.1.0'},
    ])
    expect(resolveCanonicalModuleId(upgraded!.moduleId)).toBe(CANONICAL_VAULT_NOTES_MODULE_ID)
    expect(upgraded!.version).toBe('1.1.0')
  })

  it('uses the real immutable 2.0.2 release created for the current product contract', () => {
    expect(CANONICAL_VAULT_NOTES_CURRENT_VERSION).toBe('2.0.2')
    expect(CANONICAL_VAULT_NOTES_CURRENT_TAG).toBe('vault-notes-v2.0.2')
    expect(CANONICAL_VAULT_NOTES_CURRENT_COMMIT).toMatch(/^[0-9a-f]{40}$/)
    expect(CANONICAL_VAULT_NOTES_ARTIFACT_SHA256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('keep-data uninstall then reinstall restores the same notes', () => {
    const retained = [
      {accountId: 'A', moduleId: 'modula.vault-notes', recordId: 'note-a', title: 'Note A', deleted: false},
      {accountId: 'A', moduleId: 'modula.vault-notes', recordId: 'note-b', title: 'Note B', deleted: false},
    ]
    const afterReinstall = rewriteLegacyVaultNotesValue(retained)
    expect(afterReinstall.map(row => row.title)).toEqual(['Note A', 'Note B'])
    expect(afterReinstall.every(row => row.moduleId === CANONICAL_VAULT_NOTES_MODULE_ID)).toBe(true)
    expect(afterReinstall.every(row => row.deleted === false)).toBe(true)
    expect(afterReinstall).toHaveLength(2)
  })

  it('does not leak notes across accounts during identity migration', () => {
    const rows = [
      {accountId: 'A', moduleId: 'modula.vault-notes', title: 'Note A'},
      {accountId: 'B', moduleId: CANONICAL_VAULT_NOTES_MODULE_ID, title: 'Note B'},
    ]
    const after = rewriteLegacyVaultNotesValue(rows)
    expect(after.find(row => row.title === 'Note A')?.accountId).toBe('A')
    expect(after.find(row => row.title === 'Note B')?.accountId).toBe('B')
    expect(after.filter(row => row.accountId === 'A')).toHaveLength(1)
    expect(after.filter(row => row.accountId === 'B')).toHaveLength(1)
  })

  it('Settings → Modules collapses the family to one installation identity', () => {
    const listed = [
      {moduleId: 'modula.vault-notes', status: 'enabled', version: '1.1.0'},
      {moduleId: CANONICAL_VAULT_NOTES_MODULE_ID, status: 'installedDisabled', version: '0.2.0'},
    ]
    const selected = selectCanonicalVaultNotesInstallation(listed)
    expect(selected).toMatchObject({status: 'enabled'})
    expect(resolveCanonicalModuleId(selected!.moduleId)).toBe(CANONICAL_VAULT_NOTES_MODULE_ID)
    expect(listed.filter(row => row.status !== 'removed')).toHaveLength(2)
  })
})
