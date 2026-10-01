import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldModuleMarketplaceService} from '../src/modules/marketplace-service.js'
import {isInstalledStatus} from '../src/modules/installation-status.js'
import {adapterManifest, configureRegistryTestEnv, evidenceFor, registerAccount} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)

describe('installed status semantics', () => {
  it('treats removed, uninstalled and notInstalled as not installed', () => {
    for (const status of ['removed', 'uninstalled', 'notInstalled', '', null, undefined]) expect(isInstalledStatus(status)).toBe(false)
    for (const status of ['enabled', 'installedDisabled', 'disabled', 'installing', 'failed', 'quarantined']) expect(isInstalledStatus(status)).toBe(true)
  })
})

describeIfDb('registry trust pipeline: listInstalled excludes uninstalled rows', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let token = ''
  let accountId = ''
  const statuses = ['enabled', 'disabled', 'uninstalled', 'removed', 'notInstalled'] as const
  const ids = Object.fromEntries(statuses.map(status => [status, `digital.modula.state-${status.toLowerCase()}-${suffix}`])) as Record<(typeof statuses)[number], string>

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!)
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    const account = await registerAccount(app, `state-${suffix}@example.com`, `state${suffix}`)
    token = account.token
    accountId = account.accountId
    const releases = new GreenfieldModuleReleaseService(db)
    for (const status of statuses) {
      const manifest = adapterManifest(ids[status], '1.0.0')
      await releases.importPendingReview(manifest, evidenceFor(manifest))
      const release = await releases.publishRelease(ids[status], '1.0.0')
      const row = await db.selectFrom('greenfield_module_releases').select('extension_version_id').where('release_id', '=', release.releaseId).executeTakeFirstOrThrow()
      await db.insertInto('greenfield_extension_installations').values({
        installation_id: randomUUID(), extension_version_id: row.extension_version_id!, account_id: accountId, status, config: JSON.stringify({}), created_at: new Date(), updated_at: new Date(),
      } as never).execute()
    }
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('lists only rows that are still installed, without deleting history', async () => {
    const response = await app.inject({method: 'GET', url: '/v1/modules/installed', headers: {authorization: `Bearer ${token}`}})
    expect(response.statusCode, response.body).toBe(200)
    const listed = new Set((response.json().data as Array<{moduleId: string}>).map(row => row.moduleId))
    expect(listed.has(ids.enabled)).toBe(true)
    expect(listed.has(ids.disabled)).toBe(true)
    expect(listed.has(ids.uninstalled)).toBe(false)
    expect(listed.has(ids.removed)).toBe(false)
    expect(listed.has(ids.notInstalled)).toBe(false)
    const rows = await db.selectFrom('greenfield_extension_installations').select('status').where('account_id', '=', accountId).execute()
    expect(rows).toHaveLength(statuses.length)
  })

  it('does not count uninstalled rows as marketplace installations', async () => {
    const marketplace = new GreenfieldModuleMarketplaceService(db)
    const count = async (moduleId: string) => (await marketplace.project({moduleId, manifest: {}, registryPublishedAt: null})).installations.count
    expect(await count(ids.enabled)).toBe(1)
    expect(await count(ids.uninstalled)).toBe(0)
    expect(await count(ids.notInstalled)).toBe(0)
  })

  it('allows reinstalling a module whose row is uninstalled instead of replaying it as installed', async () => {
    const response = await app.inject({
      method: 'POST', url: `/v1/modules/${ids.uninstalled}/install`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `reinstall-${suffix}`},
      payload: {version: '1.0.0', approvedPermissions: []},
    })
    expect(response.statusCode, response.body).toBe(202)
    expect(response.json().data.idempotent).not.toBe(true)
    expect(response.json().data.status).not.toBe('uninstalled')
  })
})
