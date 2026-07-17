import {loadConfig} from '../src/config/index.js'
import {migrateDown} from '../src/database/migrate.js'

const config = loadConfig()
const rolledBack = await migrateDown(config.migratorDatabaseUrl)
console.log(JSON.stringify({rolledBack}, null, 2))
