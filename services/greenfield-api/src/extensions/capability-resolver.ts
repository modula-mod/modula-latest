import type {ModulaDb} from '../database/client.js'
export async function installationCapabilities(db: ModulaDb, installationId: string): Promise<Set<string>> {
  const rows = await db.selectFrom('greenfield_extension_capabilities').select('capability').where('installation_id', '=', installationId).where('revoked_at', 'is', null).execute()
  return new Set(rows.map(row => row.capability))
}
export async function requireInstallationCapability(db: ModulaDb, installationId: string, capability: string) {
  if (!(await installationCapabilities(db, installationId)).has(capability)) throw Object.assign(new Error(`Missing extension capability ${capability}`), {code: 'FORBIDDEN'})
}
