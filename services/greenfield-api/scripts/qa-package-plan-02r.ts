import {createDb} from '../src/database/client.js'
import {loadConfig} from '../src/config/env.js'
import {GreenfieldModuleDistributionService} from '../src/modules/distribution-service.js'

const url = process.env.MODULA_TEST_DATABASE_URL
if (!url || process.env.NODE_ENV === 'production' || process.env.MODULA_ENVIRONMENT === 'production') {
  throw new Error('Only an explicit nonproduction test database is permitted')
}
process.env.NODE_ENV = 'test'
process.env.MODULA_ENVIRONMENT = 'development'
process.env.MODULA_PUBLIC_API_URL ??= 'http://127.0.0.1:14023'
process.env.MODULA_DATABASE_URL = url
process.env.MODULA_DATABASE_MIGRATOR_URL = url
process.env.MODULA_ALLOWED_ORIGINS ??= 'https://modula.digital'
process.env.MODULA_CHECKPOINT_SIGNING_KEY ??= 'qa-plan-ephemeral'
const config = loadConfig()
const db = createDb(url)
try {
  const service = new GreenfieldModuleDistributionService(db, config)
  for (const moduleId of ['digital.modula.orbit-phaser', 'digital.modula.orbit-dash']) {
    for (const cachedPublicDigests of [[], ['70b3ae149b9eec18c2fdabf69a9cf3e05a15dc2a2c2255929e10c4aa5f7fa28b']]) {
      const {lock, lockSha256} = await service.packageInstallPlan(moduleId, null,
        {hostVersion: '1.1.0', platform: 'ios'}, cachedPublicDigests)
      console.log(JSON.stringify({moduleId, cached: cachedPublicDigests.length > 0, lockSha256,
        packages: lock.packages.map(item => ({packageId: item.packageId, version: item.version,
          sha256: item.artifact.sha256, bytes: item.artifact.compressedSizeBytes,
          verified: item.trust.verified, revoked: item.trust.revoked})),
        aggregateCompressedBytes: lock.aggregateCompressedBytes, newDownloadBytes: lock.newDownloadBytes}))
    }
  }
} finally {
  await db.destroy()
}
