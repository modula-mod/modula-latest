import {randomUUID} from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pg from 'pg'
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {createDb} from '../src/database/client.js'
import {listMigrationFiles, migrateUp} from '../src/database/migrate.js'
import {GreenfieldModuleRegistryService} from '../src/modules/registry-service.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {
  dropAuthorizedPublicationRoles,
  provisionAuthorizedPublicationRoles,
  publishAuthorizedRegistryFixture,
  seedLegacyMalformedRegistryRelease,
  type AuthorizedPublicationRoleFixture,
} from './helpers/authorized-publication-fixture.js'
import {adapterManifest, configureRegistryTestEnv, evidenceFor} from './helpers/registry-fixtures.js'

const suppliedDatabaseUrl = process.env.MODULA_TEST_DATABASE_URL
const adminDatabaseUrl = process.env.MODULA_TEST_ADMIN_DATABASE_URL ?? suppliedDatabaseUrl
const describeIfDb = suppliedDatabaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)
const namespace = `listing${suffix.replaceAll('-', '')}.modula`
const incompleteId = `${namespace}.incomplete`
const completeId = `${namespace}.complete`
const pendingId = `${namespace}.pending`

describeIfDb('GET /v1/registry/products tolerates a release with no manifest.compatibility', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let adminPool: pg.Pool
  let authorityRoles: AuthorizedPublicationRoleFixture
  let migrationsThrough091: string
  let databaseName: string
  let databaseUrl: string
  let validReleaseId: string
  let legacyReleaseId: string

  beforeAll(async () => {
    if (!adminDatabaseUrl) throw new Error('MODULA_TEST_ADMIN_DATABASE_URL or an administrative MODULA_TEST_DATABASE_URL is required')
    databaseName = `modula_registry_listing_${suffix.replaceAll('-', '')}`
    adminPool = new pg.Pool({connectionString: adminDatabaseUrl})
    const owner = new URL(suppliedDatabaseUrl!).username
    await adminPool.query(`CREATE DATABASE "${databaseName}" OWNER "${owner.replaceAll('"', '""')}"`)
    const isolated = new URL(suppliedDatabaseUrl!)
    isolated.pathname = `/${databaseName}`
    databaseUrl = isolated.toString()
    configureRegistryTestEnv(databaseUrl, '4157')

    migrationsThrough091 = await fs.mkdtemp(path.join(os.tmpdir(), 'modula-registry-listing-091-'))
    for (const migration of await listMigrationFiles()) {
      if (Number(migration.id.slice(0, 3)) > 91) continue
      await fs.copyFile(migration.file, path.join(migrationsThrough091, migration.name))
    }
    const appliedLegacy = await migrateUp(databaseUrl, migrationsThrough091)
    expect(appliedLegacy.at(-1)).toBe('091_greenfield_online_signing_authority')
    const legacyDb = createDb(databaseUrl, undefined, {max: 1, applicationName: 'r4a2-listing-legacy-seed'})
    try {
      const legacy = await seedLegacyMalformedRegistryRelease({db: legacyDb, moduleId: incompleteId, suffix})
      legacyReleaseId = legacy.releaseId
    } finally {
      await legacyDb.destroy()
    }
    expect((await migrateUp(databaseUrl))).toEqual([
      '092_publisher_release_runner_boundary',
      '093_publisher_release_governance_integrity',
      '094_publisher_signing_governance_hardening',
      '095_publisher_signing_integration_completion',
      '099_moliboo_genesis_registry',
      '100_moliboo_genesis_first100_seed',
    ])

    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()

    authorityRoles = await provisionAuthorizedPublicationRoles({
      adminPool,
      targetDatabaseUrl: databaseUrl,
      targetDb: db,
      suffix,
    })
    const valid = await publishAuthorizedRegistryFixture({
      adminDb: db,
      authorityUrls: authorityRoles.urls,
      moduleId: completeId,
      suffix,
    })
    validReleaseId = valid.releaseId

    const pending = adapterManifest(pendingId, '1.0.0', {
      publisher: {publisherId: valid.publisherId, displayName: 'Registry Listing Test Publisher'},
      source: {
        provider: 'github', repository: `modula-test/registry-listing-${suffix}`,
        commit: '2'.repeat(40), manifestPath: 'module.manifest.json',
        releaseTag: `${pendingId}-v1.0.0`, releaseAssetName: `${pendingId}-1.0.0.tgz`,
      },
      license: {status: 'verified', evidenceIds: ['pending-registry-fixture']},
      trust: {requestedLevel: 'verifiedPublisher'},
    })
    await new GreenfieldModuleReleaseService(db).importPendingReview(pending, evidenceFor(pending))
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
    if (adminPool && databaseName) {
      await adminPool.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [databaseName])
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}"`)
      if (authorityRoles) await dropAuthorizedPublicationRoles(adminPool, authorityRoles)
      await adminPool.end()
    }
    if (migrationsThrough091) await fs.rm(migrationsThrough091, {recursive: true, force: true})
  }, 120_000)

  it('returns 200, skips the incomplete release, and still lists the other product', async () => {
    const warn = vi.fn()
    const before = await db.selectFrom('greenfield_module_releases').select(['release_id', 'release_state'])
      .where('module_id', 'in', [completeId, incompleteId, pendingId]).orderBy('release_id').execute()
    const items = (await new GreenfieldModuleRegistryService(db, {log: {warn}}).listModules({productKind: 'all', limit: 100})).items
    const ids = items.map(item => item.moduleId)
    expect(ids).toContain(completeId)
    expect(ids).not.toContain(incompleteId)
    expect(ids).not.toContain(pendingId)
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleId: incompleteId,
        releaseId: legacyReleaseId,
        version: '1.0.0',
        reason: 'missing_manifest_compatibility',
      }),
      'skipping registry listing entry with no manifest.compatibility',
    )
    const payload = JSON.stringify(warn.mock.calls)
    expect(payload).not.toMatch(/password|secret|token|authorization/i)

    const response = await app.inject({method: 'GET', url: '/v1/registry/products?productKind=all&limit=100'})
    expect(response.statusCode, response.body).toBe(200)
    const listed = (response.json().data.items as Array<{moduleId: string}>).map(item => item.moduleId)
    expect(listed).toContain(completeId)
    expect(listed).not.toContain(incompleteId)
    expect(listed).not.toContain(pendingId)

    const after = await db.selectFrom('greenfield_module_releases').select(['release_id', 'release_state'])
      .where('module_id', 'in', [completeId, incompleteId, pendingId]).orderBy('release_id').execute()
    expect(after).toEqual(before)
    expect(after).toEqual(expect.arrayContaining([
      {release_id: validReleaseId, release_state: 'published'},
      {release_id: legacyReleaseId, release_state: 'published'},
      expect.objectContaining({release_state: 'pendingReview'}),
    ]))
  })
})
