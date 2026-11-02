import {loadConfig} from '../src/config/index.js'
import {runCommunitiesQaSeed} from '../seeds/communities-qa-seed.js'

const config = loadConfig()
const result = await runCommunitiesQaSeed(config.migratorDatabaseUrl)
console.log(JSON.stringify({seeded: true, ...result}, null, 2))
