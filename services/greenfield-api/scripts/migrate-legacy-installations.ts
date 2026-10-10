/**
 * Enqueues exact historical installations through the ordinary module update
 * domain service. Run only after the target signatures have been bootstrapped
 * and the old worker has been stopped; the new worker performs data conversion.
 * This script never edits release pointers directly.
 */
import {readFileSync} from 'node:fs'
import {createDb} from '../src/database/client.js'
import {loadConfig} from '../src/config/index.js'
import {GreenfieldModuleUpdateService} from '../src/modules/update-service.js'
import {GreenfieldModuleRegistryService} from '../src/modules/registry-service.js'
import {GreenfieldRegistryTrustService} from '../src/modules/registry-trust-service.js'
import {addStateCounts, completedLegacyUpgradeStates} from '../src/modules/legacy-upgrade-progress.js'

type Upgrade = {moduleId: string; fromVersion: string; toVersion: string; expectedStates: Record<string, number>}

const fileIndex = process.argv.indexOf('--file')
if (fileIndex < 0 || !process.argv[fileIndex + 1]) throw new Error('--file <public bootstrap bundle> is required')
const apply = process.argv.includes('--apply')
if (apply && !process.argv.includes('--worker-paused')) throw new Error('--apply requires --worker-paused after verifying the old worker is stopped')
const bundle = JSON.parse(readFileSync(process.argv[fileIndex + 1], 'utf8')) as {schemaVersion?: unknown; legacyUpgrades?: unknown}
if (bundle.schemaVersion !== '1.0.0' || !Array.isArray(bundle.legacyUpgrades) || !bundle.legacyUpgrades.length) {
  throw new Error('Bundle has no supported legacy upgrade mappings')
}
const upgrades = bundle.legacyUpgrades as Upgrade[]
for (const item of upgrades) {
  if (!item || typeof item.moduleId !== 'string' || typeof item.fromVersion !== 'string' || typeof item.toVersion !== 'string'
    || !item.expectedStates || typeof item.expectedStates !== 'object') throw new Error('Invalid legacy upgrade mapping')
}
const databaseUrl = process.env.MODULA_DATABASE_MIGRATOR_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) throw new Error('MODULA_DATABASE_MIGRATOR_URL or MODULA_DATABASE_URL is required')
const db = createDb(databaseUrl)

try {
  if (apply) {
    const recentHeartbeat = await db.selectFrom('greenfield_worker_heartbeats').select('worker_id')
      .where('last_seen_at', '>=', new Date(Date.now() - 45_000)).executeTakeFirst()
    if (recentHeartbeat) throw new Error('A worker heartbeat is still fresh; stop the old worker before enqueueing historical updates')
  }
  const registry = new GreenfieldModuleRegistryService(db)
  const trust = new GreenfieldRegistryTrustService(db)
  const planned: Array<{upgrade: Upgrade; completed: Record<string, number>; installations: Array<{installationId: string; accountId: string; status: string}>}> = []
  for (const upgrade of upgrades) {
    const target = await registry.getVersion(upgrade.moduleId, upgrade.toVersion)
    const targetTrust = await trust.forRelease(target)
    if (target.releaseState !== 'published' || !targetTrust.verified) throw new Error(`Target is not production-trusted: ${upgrade.moduleId}@${upgrade.toVersion}`)
    const source = await registry.getVersion(upgrade.moduleId, upgrade.fromVersion)
    if ((await trust.forRelease(source)).verified) throw new Error(`Source is already trusted: ${upgrade.moduleId}@${upgrade.fromVersion}`)
    const rows = await db.selectFrom('greenfield_extension_installations as installation')
      .innerJoin('greenfield_module_releases as release', 'release.extension_version_id', 'installation.extension_version_id')
      .select(['installation.installation_id', 'installation.account_id', 'installation.status'])
      .where('release.module_id', '=', upgrade.moduleId).where('release.version', '=', upgrade.fromVersion)
      .where('installation.status', 'not in', ['removed', 'uninstalled', 'notInstalled'])
      .orderBy('installation.installation_id').execute()
    const currentStates: Record<string, number> = {}
    for (const row of rows) currentStates[row.status] = (currentStates[row.status] ?? 0) + 1
    const completed = await completedLegacyUpgradeStates(db, {
      moduleId: upgrade.moduleId, fromVersion: upgrade.fromVersion,
      toVersion: upgrade.toVersion, targetReleaseId: target.releaseId,
    })
    const actualStates = addStateCounts(currentStates, completed)
    if (JSON.stringify(Object.entries(actualStates).sort()) !== JSON.stringify(Object.entries(upgrade.expectedStates).sort())) {
      throw new Error(`Historical installation state changed: ${upgrade.moduleId}@${upgrade.fromVersion}`)
    }
    planned.push({upgrade, completed, installations: rows.map(row => ({installationId: row.installation_id, accountId: row.account_id, status: row.status}))})
  }
  if (!apply) {
    process.stdout.write(`${JSON.stringify({mode: 'dry-run', upgrades: planned.map(item => ({moduleId: item.upgrade.moduleId,
      fromVersion: item.upgrade.fromVersion, toVersion: item.upgrade.toVersion,
      states: item.upgrade.expectedStates, completed: item.completed, remaining: item.installations.length}))}, null, 2)}\n`)
  } else {
    const updates = new GreenfieldModuleUpdateService(db, loadConfig())
    const results: Array<{moduleId: string; fromVersion: string; toVersion: string; queued: number}> = []
    for (const item of planned) {
      let queued = 0
      for (const installation of item.installations) {
        const result = await updates.migrateLegacyInstallation(installation.accountId, item.upgrade.moduleId, {
          installationId: installation.installationId,
          version: item.upgrade.toVersion,
          idempotencyKey: `api-fix-01c:${installation.installationId}:${item.upgrade.toVersion}`,
        })
        if (result.installationId !== installation.installationId) throw new Error('Update service selected a different installation')
        queued += 1
      }
      results.push({moduleId: item.upgrade.moduleId, fromVersion: item.upgrade.fromVersion, toVersion: item.upgrade.toVersion, queued})
    }
    process.stdout.write(`${JSON.stringify({mode: 'enqueued', results}, null, 2)}\n`)
  }
} finally {
  await db.destroy()
}
