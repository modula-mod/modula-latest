import type {ModulaDb} from '../../database/client.js'
import type {AppConfig} from '../../config/index.js'
import {migrateStatus} from '../../database/migrate.js'

export async function checkReadiness(db: ModulaDb, config: AppConfig) {
  await db.selectFrom('schema_metadata').select('key').limit(1).execute()
  const status = await migrateStatus(config.migratorDatabaseUrl)
  if (status.pending.length > 0) {
    return {ok: false as const, reason: 'pending migrations'}
  }
  const seed = await db
    .selectFrom('schema_metadata')
    .select('value')
    .where('key', '=', 'seed_version')
    .executeTakeFirst()
  if (!seed || seed.value === 'none') {
    return {ok: false as const, reason: 'seed missing'}
  }
  return {ok: true as const}
}
