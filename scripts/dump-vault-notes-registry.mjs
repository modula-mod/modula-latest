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
    return row.current === true ? 'STALE' : 'HISTORICAL_RELEASE'
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
  console.log('Production dump (2026-08-15 Mac via ssh modula-vps, no mutation):')
  const production = [
    {
      kind: 'release',
      moduleId: 'digital.modula.vault-notes',
      version: '0.1.0',
      releaseId: 'module-release:digital.modula.vault-notes:0.1.0',
      sourceRepository: 'modula-mod/modula-module-vault-notes',
      sourceCommit: '915bbf234818fd0eec2e83c6fa0b7fd52837184c',
      releaseState: 'published',
      historical: true,
    },
    {
      kind: 'release',
      moduleId: 'digital.modula.vault-notes',
      version: '0.2.0',
      releaseId: 'module-release:digital.modula.vault-notes:0.2.0',
      sourceRepository: 'modula-mod/modula-module-vault-notes',
      sourceCommit: '54ab8edac1ba469f0081c636e11f6059d712becc',
      releaseState: 'published',
      current: true,
    },
    {
      kind: 'catalogue',
      moduleId: 'digital.modula.vault-notes',
      version: '0.2.0',
      name: 'Vault Notes',
      status: 'active',
    },
    {
      kind: 'catalogue',
      moduleId: 'modula.module.vaultNotes',
      version: '1.0.0',
      name: 'Vault Notes',
      status: 'unavailable',
    },
  ]
  for (const row of production) {
    console.log(`${classifyVaultNotesRow(row).padEnd(22)} ${row.kind} ${row.moduleId} @ ${row.version}`)
  }
}
