import {performance} from 'node:perf_hooks'
import {type KyselyPlugin} from 'kysely'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {loadConfig} from '../src/config/env.js'
import {GreenfieldModuleDistributionService} from '../src/modules/distribution-service.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
if (!databaseUrl) throw new Error('MODULA_TEST_DATABASE_URL is required')
if (process.env.NODE_ENV === 'production' || process.env.MODULA_ENVIRONMENT === 'production') {
  throw new Error('Distribution benchmark refuses production mode')
}

process.env.NODE_ENV = 'test'
process.env.MODULA_ENVIRONMENT = 'development'
process.env.MODULA_PUBLIC_API_URL ??= 'https://api.test.modula.digital'
process.env.MODULA_DATABASE_URL = databaseUrl
process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl
process.env.MODULA_ALLOWED_ORIGINS ??= 'https://modula.digital'
process.env.MODULA_CHECKPOINT_SIGNING_KEY ??= 'distribution-benchmark-ephemeral'

const config = loadConfig()
const db = createDb(databaseUrl)
const prefix = `md03-bench-${Date.now().toString(36)}`
const accountId = `account:${prefix}`
const publisherId = `publisher:${prefix}`
const sizes = [10, 100, 500, 1_000]
type Measurement = {size: number; items: number; queries: number; medianMs: number; p95Ms: number}
let report: Measurement[] = []

class ExpectedRollback extends Error {}

try {
  await db.transaction().execute(async trx => {
    await trx.insertInto('greenfield_accounts').values({account_id: accountId, primary_handle: prefix, status: 'active'}).execute()
    await trx.insertInto('greenfield_publishers').values({
      publisher_id: publisherId,
      display_name: 'MD03 benchmark publisher',
      website: null,
      status: 'verified',
      trust_level: 'firstParty',
      verified_at: new Date(),
      suspended_at: null,
      revoked_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    }).execute()

    let seeded = 0
    for (const size of sizes) {
      await seed(trx as ModulaDb, seeded, size)
      seeded = size
      let queries = 0
      const plugin: KyselyPlugin = {
        transformQuery(args) {
          queries += 1
          return args.node
        },
        async transformResult(args) {
          return args.result
        },
      }
      const counted = (trx as ModulaDb).withPlugin(plugin)
      const service = new GreenfieldModuleDistributionService(counted, config)
      await service.updateFeed(accountId, {platform: 'ios', hostVersion: '1.0.0', moduleSdkVersion: '2.1.0', productUiContractVersion: '1.0.0'})
      const samples: number[] = []
      let items = 0
      queries = 0
      for (let iteration = 0; iteration < 7; iteration += 1) {
        const started = performance.now()
        const feed = await service.updateFeed(accountId, {platform: 'ios', hostVersion: '1.0.0', moduleSdkVersion: '2.1.0', productUiContractVersion: '1.0.0'})
        samples.push(performance.now() - started)
        items = feed.items.length
      }
      const perRequestQueries = queries / samples.length
      if (!Number.isInteger(perRequestQueries)) throw new Error(`Non-integral query count ${perRequestQueries}`)
      report.push({
        size,
        items,
        queries: perRequestQueries,
        medianMs: round(percentile(samples, 0.5)),
        p95Ms: round(percentile(samples, 0.95)),
      })
    }
    throw new ExpectedRollback('benchmark fixtures are rollback-only')
  })
} catch (error) {
  if (!(error instanceof ExpectedRollback)) throw error
} finally {
  await db.destroy()
}

process.stdout.write(`${JSON.stringify({environment: 'local disposable PostgreSQL', fixturePersistence: 'ROLLED_BACK', results: report}, null, 2)}\n`)

async function seed(target: ModulaDb, start: number, end: number) {
  const indexes = Array.from({length: end - start}, (_, offset) => start + offset)
  const now = new Date()
  const values = indexes.map(index => {
    const id = `${prefix}-${String(index).padStart(4, '0')}`
    const moduleId = `audit.module.distribution.${id}`
    const manifest = {
      manifestVersion: 2,
      standardVersion: '2.1.0',
      moduleId,
      version: '1.0.0',
      source: {provider: 'github', repository: 'modula-mod/audit-module-distribution', commit: '0'.repeat(40), manifestPath: 'module.manifest.json', releaseTag: `${id}-v1.0.0`},
      compatibility: {minimumModulaHostVersion: '0.1.0', platforms: ['ios']},
      permissions: [],
      dependencies: [],
      contributions: {},
    }
    return {id, moduleId, manifest}
  })
  await target.insertInto('greenfield_extensions').values(values.map(value => ({
    extension_id: `extension:${value.id}`, slug: value.id, publisher_account_id: null, status: 'draft', created_at: now, updated_at: now,
  }))).execute()
  await target.insertInto('greenfield_extension_versions').values(values.map(value => ({
    extension_version_id: `extension-version:${value.id}`, extension_id: `extension:${value.id}`, version: '1.0.0', manifest: value.manifest, status: 'draft', created_at: now,
  }))).execute()
  await target.insertInto('greenfield_module_versions').values(values.map(value => ({
    module_version_id: `module-version:${value.id}`, extension_version_id: `extension-version:${value.id}`, module_id: value.moduleId,
    version: '1.0.0', publisher_id: publisherId, manifest: value.manifest, status: 'draft', created_at: now, updated_at: now,
  }))).execute()
  await target.insertInto('greenfield_module_releases').values(values.map(value => ({
    release_id: `release:${value.id}`, module_version_id: `module-version:${value.id}`, extension_id: `extension:${value.id}`,
    extension_version_id: `extension-version:${value.id}`, module_id: value.moduleId, version: '1.0.0', publisher_id: publisherId,
    release_state: 'draft', release_channel: 'stable', source_repository: 'modula-mod/audit-module-distribution', source_commit: '0'.repeat(40),
    manifest_path: 'module.manifest.json', manifest_sha256: '0'.repeat(64), release_sha256: null, signature_key_id: null, signature: null,
    compatibility: {}, license_status: 'firstParty', trust_level: 'firstParty', product_kind: 'module', extension_product: {},
    published_at: null, quarantined_at: null, revoked_at: null, superseded_at: null, created_at: now, updated_at: now,
  }))).execute()
  await target.insertInto('greenfield_extension_installations').values(values.map(value => ({
    installation_id: `installation:${value.id}`, extension_version_id: `extension-version:${value.id}`, account_id: accountId,
    status: 'enabled', config: {}, legacy_duplicate_allowed: false, update_policy: 'automaticStable', release_channel: 'stable',
    locked_version: null, created_at: now, updated_at: now,
  }))).execute()
}

function percentile(values: number[], fraction: number) {
  const ordered = [...values].sort((left, right) => left - right)
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)]!
}

function round(value: number) {
  return Math.round(value * 100) / 100
}
