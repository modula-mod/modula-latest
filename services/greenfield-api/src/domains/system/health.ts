import {constants as fsConstants} from 'node:fs'
import {access, statfs} from 'node:fs/promises'
import type {ModulaDb} from '../../database/client.js'
import type {AppConfig} from '../../config/index.js'
import {migrateStatus} from '../../database/migrate.js'

export async function checkReadiness(db: ModulaDb, config: AppConfig) {
  await db.selectFrom('schema_metadata').select('key').limit(1).execute()
  const status = await migrateStatus(config.migratorDatabaseUrl)
  if (status.unknown.length > 0) {
    return {ok: false as const, reason: 'unknown migrations'}
  }
  if (status.pending.length > 0) {
    return {ok: false as const, reason: 'pending migrations'}
  }
  const currentMigration = status.applied.at(-1) ?? null
  if (config.expectedMigration && currentMigration !== config.expectedMigration) {
    return {ok: false as const, reason: 'migration mismatch'}
  }
  const seed = await db
    .selectFrom('schema_metadata')
    .select('value')
    .where('key', '=', 'seed_version')
    .executeTakeFirst()
  if (!seed || seed.value === 'none') {
    return {ok: false as const, reason: 'seed missing'}
  }
  try {
    await access(config.mediaRoot, fsConstants.R_OK | fsConstants.W_OK)
    const filesystem = await statfs(config.mediaRoot)
    const freeBytes = Number(filesystem.bavail) * Number(filesystem.bsize)
    if (!Number.isSafeInteger(freeBytes) || freeBytes < config.minStorageFreeBytes) {
      return {ok: false as const, reason: 'critical storage pressure'}
    }
  } catch {
    return {ok: false as const, reason: 'critical storage unavailable'}
  }
  return {ok: true as const}
}
