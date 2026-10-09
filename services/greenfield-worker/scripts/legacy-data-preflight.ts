/** Read-only compatibility proof for historical installations before jobs are enqueued. */
import {readFileSync} from 'node:fs'
import {createDb} from '../src/database.js'
import {migrateHistoricalInstallationData} from '../src/modules/legacy-installation-data-migration.js'

const fileIndex = process.argv.indexOf('--file')
if (fileIndex < 0 || !process.argv[fileIndex + 1]) throw new Error('--file <public bootstrap bundle> is required')
const databaseUrl = process.env.MODULA_DATABASE_URL
if (!databaseUrl) throw new Error('MODULA_DATABASE_URL is required')
const bundle = JSON.parse(readFileSync(process.argv[fileIndex + 1], 'utf8')) as {
  schemaVersion?: string
  legacyUpgrades?: Array<{moduleId: string; fromVersion: string; toVersion: string; expectedStates: Record<string, number>}>
}
if (bundle.schemaVersion !== '1.0.0' || !Array.isArray(bundle.legacyUpgrades)) throw new Error('Unsupported bootstrap bundle')
const db = createDb(databaseUrl)
try {
  const results = []
  for (const mapping of bundle.legacyUpgrades) {
    const target = await db.selectFrom('greenfield_module_releases').select(['release_id'])
      .where('module_id', '=', mapping.moduleId).where('version', '=', mapping.toVersion).executeTakeFirst()
    if (!target) throw new Error(`Target release is missing: ${mapping.moduleId}@${mapping.toVersion}`)
    const rows = await db.selectFrom('greenfield_extension_installations as installation')
      .innerJoin('greenfield_module_releases as release', 'release.extension_version_id', 'installation.extension_version_id')
      .select(['installation.installation_id', 'installation.account_id', 'installation.status'])
      .where('release.module_id', '=', mapping.moduleId).where('release.version', '=', mapping.fromVersion)
      .where('installation.status', 'not in', ['removed', 'uninstalled', 'notInstalled']).execute()
    const states: Record<string, number> = {}
    for (const row of rows) states[row.status] = (states[row.status] ?? 0) + 1
    if (JSON.stringify(Object.entries(states).sort()) !== JSON.stringify(Object.entries(mapping.expectedStates).sort())) {
      throw new Error(`Historical installation counts changed: ${mapping.moduleId}@${mapping.fromVersion}`)
    }
    const totals = {installations: rows.length, records: 0, tags: 0, settings: 0}
    for (const row of rows) {
      const result = await migrateHistoricalInstallationData(db, {
        installationId: row.installation_id, accountId: row.account_id, moduleId: mapping.moduleId,
        fromVersion: mapping.fromVersion, toVersion: mapping.toVersion, targetReleaseId: target.release_id,
        dryRun: true,
      })
      totals.records += result.records
      totals.tags += result.tags
      totals.settings += result.settings
    }
    results.push({moduleId: mapping.moduleId, fromVersion: mapping.fromVersion, toVersion: mapping.toVersion, states, totals})
  }
  process.stdout.write(`${JSON.stringify({mode: 'read-only-preflight', results}, null, 2)}\n`)
} finally {
  await db.destroy()
}
