#!/usr/bin/env node
/**
 * Read-only Vault Notes registry dump helper.
 *
 * On VPS (do not mutate first):
 *   ssh modula-vps
 *   cd /root/modula-latest
 *   node scripts/dump-vault-notes-registry.mjs
 *
 * Classification:
 *   CANONICAL            digital.modula.vault-notes + modula-mod/modula-vault-notes
 *   LEGACY_ALIAS         modula.vault-notes / modula.module.vaultNotes / module-vault-notes
 *   HISTORICAL_RELEASE   older version of the canonical ID
 *   DUPLICATE_INVALID    second visible product
 *   TEST_ONLY            generated fixture
 *   STALE                canonical ID still pointing at inaccessible module-vault-notes
 */
const CANONICAL_ID = 'digital.modula.vault-notes'
const CANONICAL_REPO = 'modula-mod/modula-vault-notes'
const LEGACY_IDS = ['modula.vault-notes', 'modula.module.vaultNotes', 'module-vault-notes']

export function classifyVaultNotesRow(row) {
  if (LEGACY_IDS.includes(row.moduleId)) return 'LEGACY_ALIAS'
  if (row.testOnly) return 'TEST_ONLY'
  if (row.status === 'quarantined') return 'QUARANTINED'
  if (row.status === 'superseded' || row.historical) return 'HISTORICAL_RELEASE'
  if (row.moduleId === CANONICAL_ID && row.sourceRepository === CANONICAL_REPO) {
    return row.current === false ? 'HISTORICAL_RELEASE' : 'CANONICAL'
  }
  if (row.moduleId === CANONICAL_ID && String(row.sourceRepository ?? '').includes('modula-module-vault-notes')) {
    return 'STALE'
  }
  if (row.moduleId === CANONICAL_ID) return 'CANONICAL'
  if (String(row.name ?? '').toLowerCase() === 'vault notes') return 'DUPLICATE_INVALID'
  return 'UNRELATED'
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('dump-vault-notes-registry.mjs')
if (isMain) {
  console.log('Vault Notes registry classifier (read-only)')
  console.log(`CANONICAL MODULE ID   ${CANONICAL_ID}`)
  console.log(`CANONICAL REPOSITORY  ${CANONICAL_REPO}`)
  console.log(`LEGACY IDS            ${LEGACY_IDS.join(', ')}`)
  console.log('Inspect greenfield_module_releases / installations on VPS before any UPDATE.')
}
