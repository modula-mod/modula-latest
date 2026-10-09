/** Read-only hard gate before replacing the old API/worker with strict trust. */
import {readFileSync} from 'node:fs'
import {sql} from 'kysely'
import {createDb} from '../src/database/client.js'
import {GreenfieldModuleRegistryService} from '../src/modules/registry-service.js'
import {GreenfieldRegistryTrustService} from '../src/modules/registry-trust-service.js'

type Mapping = {moduleId: string; fromVersion: string; toVersion: string; expectedStates: Record<string, number>}

const fileIndex = process.argv.indexOf('--file')
if (fileIndex < 0 || !process.argv[fileIndex + 1]) throw new Error('--file <public bootstrap bundle> is required')
const bundle = JSON.parse(readFileSync(process.argv[fileIndex + 1], 'utf8')) as {legacyUpgrades?: Mapping[]}
if (!Array.isArray(bundle.legacyUpgrades) || !bundle.legacyUpgrades.length) throw new Error('Legacy upgrade mappings are required')
const databaseUrl = process.env.MODULA_DATABASE_MIGRATOR_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) throw new Error('MODULA_DATABASE_MIGRATOR_URL or MODULA_DATABASE_URL is required')
const db = createDb(databaseUrl)

try {
  const active = await sql<{module_id: string; version: string; status: string; count: number}>`
    SELECT release.module_id, release.version, installation.status, COUNT(*)::int AS count
    FROM greenfield_extension_installations installation
    JOIN greenfield_module_releases release ON release.extension_version_id = installation.extension_version_id
    WHERE installation.status NOT IN ('removed', 'uninstalled', 'notInstalled')
    GROUP BY release.module_id, release.version, installation.status
    ORDER BY release.module_id, release.version, installation.status
  `.execute(db)
  const registry = new GreenfieldModuleRegistryService(db)
  const trust = new GreenfieldRegistryTrustService(db)
  const untrusted = []
  for (const identity of new Set(active.rows.map(row => `${row.module_id}@${row.version}`))) {
    const row = active.rows.find(item => `${item.module_id}@${item.version}` === identity)!
    const release = await registry.getVersion(row.module_id, row.version)
    const result = await trust.forRelease(release)
    if (!result.verified) untrusted.push({moduleId: row.module_id, version: row.version, signatureState: result.signature.state,
      installations: active.rows.filter(item => item.module_id === row.module_id && item.version === row.version)
        .reduce((sum, item) => sum + item.count, 0)})
  }
  const migrationPlans = await sql<{module_id: string; from_version: string; to_version: string; plan_status: string; current_version: string; installation_status: string; count: number}>`
    SELECT release.module_id, plan.permission_decision ->> 'fromVersion' AS from_version,
      plan.requested_version AS to_version, plan.status AS plan_status,
      release.version AS current_version, installation.status AS installation_status,
      COUNT(*)::int AS count
    FROM greenfield_module_install_plans plan
    JOIN greenfield_extension_installations installation ON installation.installation_id = plan.installation_id
    JOIN greenfield_module_releases release ON release.extension_version_id = installation.extension_version_id
    WHERE plan.idempotency_key LIKE 'module-switch:api-fix-01c:%'
    GROUP BY release.module_id, plan.permission_decision ->> 'fromVersion', plan.requested_version,
      plan.status, release.version, installation.status
  `.execute(db)
  const migrations = bundle.legacyUpgrades.map(mapping => {
    const matching = migrationPlans.rows.filter(row => row.module_id === mapping.moduleId
      && row.from_version === mapping.fromVersion && row.to_version === mapping.toVersion)
    const states: Record<string, number> = {}
    for (const row of matching) {
      if (row.plan_status !== 'completed' || row.current_version !== mapping.toVersion) {
        throw new Error(`Historical update has not completed: ${mapping.moduleId}@${mapping.fromVersion}`)
      }
      states[row.installation_status] = (states[row.installation_status] ?? 0) + row.count
    }
    if (JSON.stringify(Object.entries(states).sort()) !== JSON.stringify(Object.entries(mapping.expectedStates).sort())) {
      throw new Error(`Historical installation state is not preserved: ${mapping.moduleId}@${mapping.fromVersion}`)
    }
    return {moduleId: mapping.moduleId, fromVersion: mapping.fromVersion, toVersion: mapping.toVersion, states}
  })
  if (untrusted.length) throw new Error(`Active installations still reference untrusted releases: ${JSON.stringify(untrusted)}`)
  process.stdout.write(`${JSON.stringify({result: 'PASS', activeInstallations: active.rows, migrations, untrusted: 0}, null, 2)}\n`)
} finally {
  await db.destroy()
}
