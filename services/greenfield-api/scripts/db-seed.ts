import {loadConfig} from '../src/config/index.js'
import {runSeed} from '../seeds/preview-seed.js'

const config = loadConfig()
await runSeed(config.migratorDatabaseUrl)
console.log(JSON.stringify({seeded: true}, null, 2))
