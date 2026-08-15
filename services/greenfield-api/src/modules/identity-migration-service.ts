import {
  CANONICAL_VAULT_NOTES_MODULE_ID,
  LEGACY_VAULT_NOTES_MODULE_IDS,
  isVaultNotesModuleId,
  rewriteLegacyVaultNotesValue,
} from '@modula/greenfield-contracts'
import type {ModulaDb} from '../database/client.js'

const LEGACY_IDS = [...LEGACY_VAULT_NOTES_MODULE_IDS]

export type VaultNotesIdentityMigrationReport = {
  recordsMoved: number
  recordsMerged: number
  collectionsMoved: number
  viewsMoved: number
  actionsMoved: number
  releasesRelabeled: number
  versionsRelabeled: number
  settingsMoved: number
}

/**
 * Move Vault Notes rows from legacy module IDs onto the single canonical ID.
 * Does not duplicate notes. Same account, same record_id → one row.
 */
export class GreenfieldModuleIdentityMigrationService {
  constructor(private readonly db: ModulaDb) {}

  async normalizeAccount(accountId: string): Promise<VaultNotesIdentityMigrationReport> {
    const report = emptyReport()
    report.recordsMerged += await this.mergeRecords(accountId)
    report.recordsMoved += await this.relabel('greenfield_module_records', 'module_id', {accountId})
    report.settingsMoved += await this.collapseExtraInstallations(accountId)
    return report
  }

  async normalizeRegistry(): Promise<VaultNotesIdentityMigrationReport> {
    const report = emptyReport()
    report.versionsRelabeled += await this.relabel('greenfield_module_versions', 'module_id')
    report.releasesRelabeled += await this.relabel('greenfield_module_releases', 'module_id')
    report.collectionsMoved += await this.relabel('greenfield_module_record_collections', 'module_id')
    report.viewsMoved += await this.relabel('greenfield_module_views', 'module_id')
    report.actionsMoved += await this.relabel('greenfield_module_actions', 'module_id')
    await this.rewriteStoredManifests()
    return report
  }

  private async mergeRecords(accountId: string): Promise<number> {
    const canonical = await this.db
      .selectFrom('greenfield_module_records')
      .select(['collection', 'record_id'])
      .where('account_id', '=', accountId)
      .where('module_id', '=', CANONICAL_VAULT_NOTES_MODULE_ID)
      .execute()
    const existing = new Set(canonical.map(row => `${row.collection}:${row.record_id}`))
    const legacy = await this.db
      .selectFrom('greenfield_module_records')
      .select(['collection', 'record_id'])
      .where('account_id', '=', accountId)
      .where('module_id', 'in', LEGACY_IDS)
      .execute()
    let merged = 0
    for (const row of legacy) {
      const key = `${row.collection}:${row.record_id}`
      if (!existing.has(key)) continue
      await this.db
        .deleteFrom('greenfield_module_records')
        .where('account_id', '=', accountId)
        .where('module_id', 'in', LEGACY_IDS)
        .where('collection', '=', row.collection)
        .where('record_id', '=', row.record_id)
        .execute()
      merged += 1
    }
    return merged
  }

  /**
   * One logical Vault Notes installation per account. Extra family rows are
   * tombstoned as identity repair, not a second product.
   */
  private async collapseExtraInstallations(accountId: string): Promise<number> {
    const rows = await this.db
      .selectFrom('greenfield_extension_installations')
      .innerJoin('greenfield_module_releases', 'greenfield_module_releases.extension_version_id', 'greenfield_extension_installations.extension_version_id')
      .select([
        'greenfield_extension_installations.installation_id',
        'greenfield_extension_installations.status',
      ])
      .where('greenfield_extension_installations.account_id', '=', accountId)
      .where('greenfield_module_releases.module_id', 'in', [CANONICAL_VAULT_NOTES_MODULE_ID, ...LEGACY_IDS])
      .where('greenfield_extension_installations.status', '!=', 'removed')
      .execute()
    if (rows.length <= 1) return 0
    const preferred = rows.find(row => row.status === 'enabled') ?? rows[0]!
    let collapsed = 0
    for (const row of rows) {
      if (row.installation_id === preferred.installation_id) continue
      await this.db
        .updateTable('greenfield_extension_installations')
        .set({status: 'removed', updated_at: new Date()})
        .where('installation_id', '=', row.installation_id)
        .execute()
      collapsed += 1
    }
    return collapsed
  }

  private async relabel(
    table:
      | 'greenfield_module_records'
      | 'greenfield_module_releases'
      | 'greenfield_module_versions'
      | 'greenfield_module_record_collections'
      | 'greenfield_module_views'
      | 'greenfield_module_actions'
      | 'greenfield_module_installation_settings',
    column: 'module_id',
    filter: {accountId?: string} = {},
  ): Promise<number> {
    let query = this.db.updateTable(table).set({[column]: CANONICAL_VAULT_NOTES_MODULE_ID} as never).where(column, 'in', LEGACY_IDS)
    if (filter.accountId && table === 'greenfield_module_records') {
      query = query.where('account_id', '=', filter.accountId)
    }
    const result = await query.executeTakeFirst()
    return Number(result.numUpdatedRows ?? 0)
  }

  private async rewriteStoredManifests(): Promise<void> {
    const rows = await this.db
      .selectFrom('greenfield_module_versions')
      .select(['module_version_id', 'module_id', 'manifest'])
      .where('module_id', 'in', [...LEGACY_IDS, CANONICAL_VAULT_NOTES_MODULE_ID])
      .execute()
    for (const row of rows) {
      if (!isVaultNotesModuleId(row.module_id)) continue
      const next = rewriteLegacyVaultNotesValue(row.manifest)
      await this.db
        .updateTable('greenfield_module_versions')
        .set({manifest: next as never, module_id: CANONICAL_VAULT_NOTES_MODULE_ID})
        .where('module_version_id', '=', row.module_version_id)
        .execute()
    }
  }
}

function emptyReport(): VaultNotesIdentityMigrationReport {
  return {
    recordsMoved: 0,
    recordsMerged: 0,
    collectionsMoved: 0,
    viewsMoved: 0,
    actionsMoved: 0,
    releasesRelabeled: 0,
    versionsRelabeled: 0,
    settingsMoved: 0,
  }
}
