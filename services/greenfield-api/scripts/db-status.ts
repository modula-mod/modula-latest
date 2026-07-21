import {loadConfig} from '../src/config/index.js'
import {migrateStatus} from '../src/database/migrate.js'

const config = loadConfig()
const status = await migrateStatus(config.migratorDatabaseUrl)
console.log(JSON.stringify(status, null, 2))
