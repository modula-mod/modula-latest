import {loadConfig} from '../config/index.js'
import {migrateUp} from '../database/migrate.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {createDb} from '../database/client.js'

const config = loadConfig()
const applied = await migrateUp(config.migratorDatabaseUrl)
console.log(JSON.stringify({applied}, null, 2))
if (applied.length) {
  const db = createDb(config.migratorDatabaseUrl)
  try {
    await new AuditRepository(db).append('database.migration.completed', {applied})
  } finally {
    await db.destroy()
  }
}
