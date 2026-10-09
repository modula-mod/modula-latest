import type {ModulaDb} from '../database/client.js'

export async function requireInstallationForAccount(db: ModulaDb, accountId: string, installationId: string) {
  const installation = await db
    .selectFrom('greenfield_extension_installations')
    .select(['installation_id', 'extension_version_id', 'status'])
    .where('installation_id', '=', installationId)
    .where('account_id', '=', accountId)
    .executeTakeFirst()
  if (!installation) throw Object.assign(new Error('Installation not found'), {code: 'NOT_FOUND'})
  return installation
}

export async function installationCapabilities(db: ModulaDb, installationId: string): Promise<Set<string>> {
  const rows = await db.selectFrom('greenfield_extension_capabilities').select('capability').where('installation_id', '=', installationId).where('revoked_at', 'is', null).execute()
  return new Set(rows.map(row => row.capability))
}
export async function requireInstallationCapability(db: ModulaDb, installationId: string, capability: string) {
  if (!(await installationCapabilities(db, installationId)).has(capability)) throw Object.assign(new Error(`Missing extension capability ${capability}`), {code: 'FORBIDDEN'})
}

export async function requireInstallationCapabilityForAccount(
  db: ModulaDb,
  accountId: string,
  installationId: string,
  capability: string,
) {
  const installation = await requireInstallationForAccount(db, accountId, installationId)
  await requireInstallationCapability(db, installation.installation_id, capability)
  return installation
}
