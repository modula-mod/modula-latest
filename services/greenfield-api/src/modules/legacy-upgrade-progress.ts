import {sql, type Transaction} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import type {Database} from '../database/types.js'

/** Completed exact-ID updates count toward the original bootstrap inventory. */
export async function completedLegacyUpgradeStates(db: ModulaDb | Transaction<Database>, input: {
  moduleId: string; fromVersion: string; toVersion: string; targetReleaseId: string
}): Promise<Record<string, number>> {
  const plans = await sql<{
    installation_id: string; plan_status: string; installation_status: string; current_version: string
  }>`
    SELECT installation.installation_id, plan.status AS plan_status,
      installation.status AS installation_status, current_release.version AS current_version
    FROM greenfield_module_install_plans plan
    JOIN greenfield_extension_installations installation ON installation.installation_id = plan.installation_id
      AND installation.account_id = plan.account_id
    JOIN greenfield_module_releases current_release ON current_release.extension_version_id = installation.extension_version_id
    WHERE plan.idempotency_key LIKE 'module-switch:api-fix-01c:%'
      AND plan.release_id = ${input.targetReleaseId}
      AND plan.requested_version = ${input.toVersion}
      AND plan.permission_decision ->> 'fromVersion' = ${input.fromVersion}
      AND current_release.module_id = ${input.moduleId}
  `.execute(db)
  const seen = new Set<string>()
  const states: Record<string, number> = {}
  for (const plan of plans.rows) {
    if (seen.has(plan.installation_id) || plan.plan_status !== 'completed' || plan.current_version !== input.toVersion) {
      throw new Error(`Historical installation update is not complete: ${input.moduleId}@${input.fromVersion}`)
    }
    seen.add(plan.installation_id)
    states[plan.installation_status] = (states[plan.installation_status] ?? 0) + 1
  }
  return states
}

export function addStateCounts(...counts: Array<Record<string, number>>): Record<string, number> {
  const result: Record<string, number> = {}
  for (const group of counts) {
    for (const [state, count] of Object.entries(group)) result[state] = (result[state] ?? 0) + count
  }
  return result
}
