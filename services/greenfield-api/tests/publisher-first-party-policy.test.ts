import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModulePublisherService} from '../src/modules/publisher-service.js'
import {adapterManifest} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)

describeIfDb('authoritative first-party publisher policy', () => {
  let db: ModulaDb
  const pendingPublisherId = `test.policy-publisher-${suffix}`

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
  })

  afterAll(async () => {
    if (db) {
      await db.deleteFrom('greenfield_publisher_namespaces').where('publisher_id', '=', pendingPublisherId).execute()
      await db.deleteFrom('greenfield_publishers').where('publisher_id', '=', pendingPublisherId).execute()
      await db.destroy()
    }
  })

  it('does not let an unknown manifest self-assert first-party trust', async () => {
    const publisherId = `test.self-assert-${suffix}`
    const moduleId = `example.self-assert-${suffix}`
    const base = adapterManifest(moduleId, '1.0.0')
    const manifest = adapterManifest(moduleId, '1.0.0', {
      publisher: {publisherId, displayName: 'Untrusted Self Assertion'},
      source: {...base.source, repository: 'attacker/self-assertion'},
      trust: {requestedLevel: 'firstParty'},
      license: {status: 'firstParty', evidenceIds: ['manifest-only-claim']},
    })

    await expect(new GreenfieldModulePublisherService(db).ensurePublisherForManifest(manifest))
      .rejects.toMatchObject({code: 'FORBIDDEN'})
    expect(await db.selectFrom('greenfield_publishers').select('publisher_id').where('publisher_id', '=', publisherId).executeTakeFirst()).toBeUndefined()
    expect(await db.selectFrom('greenfield_publisher_namespaces').select('namespace').where('namespace', '=', 'example.self-assert-' + suffix).executeTakeFirst()).toBeUndefined()
  })

  it('does not elevate an existing pending publisher from manifest claims', async () => {
    const now = new Date()
    await db.insertInto('greenfield_publishers').values({
      publisher_id: pendingPublisherId, display_name: 'Pending Publisher', website: null,
      status: 'pending', trust_level: 'untrustedManifest', created_at: now, updated_at: now,
      verified_at: null, suspended_at: null, revoked_at: null,
    }).execute()
    const moduleId = `example.policy-${suffix}`
    const base = adapterManifest(moduleId, '1.0.0')
    const manifest = adapterManifest(moduleId, '1.0.0', {
      publisher: {publisherId: pendingPublisherId, displayName: 'Manifest Tries Elevation'},
      source: {...base.source, repository: 'attacker/policy-elevation'},
      trust: {requestedLevel: 'firstParty'},
      license: {status: 'firstParty', evidenceIds: ['self-asserted']},
    })

    await expect(new GreenfieldModulePublisherService(db).ensurePublisherForManifest(manifest))
      .rejects.toMatchObject({code: 'FORBIDDEN'})
    expect(await db.selectFrom('greenfield_publishers').select(['status', 'trust_level', 'verified_at'])
      .where('publisher_id', '=', pendingPublisherId).executeTakeFirst()).toEqual({status: 'pending', trust_level: 'untrustedManifest', verified_at: null})
  })

  it('does not let an unknown publisher impersonate Modula in a reserved namespace', async () => {
    const publisherId = `test.modula-impersonator-${suffix}`
    const moduleId = `digital.modula.impersonator-${suffix}`
    const before = await db.selectFrom('greenfield_publisher_namespaces').selectAll().where('namespace', '=', 'digital.modula').executeTakeFirst()
    const base = adapterManifest(moduleId, '1.0.0')
    const manifest = adapterManifest(moduleId, '1.0.0', {
      publisher: {publisherId, displayName: 'Not Modula'},
      source: {...base.source, repository: 'attacker/modula-impersonation'},
      trust: {requestedLevel: 'firstParty'},
      license: {status: 'firstParty', evidenceIds: ['self-asserted']},
    })

    await expect(new GreenfieldModulePublisherService(db).ensurePublisherForManifest(manifest))
      .rejects.toMatchObject({code: 'FORBIDDEN'})
    expect(await db.selectFrom('greenfield_publishers').select('publisher_id').where('publisher_id', '=', publisherId).executeTakeFirst()).toBeUndefined()
    expect(await db.selectFrom('greenfield_publisher_namespaces').selectAll().where('namespace', '=', 'digital.modula').executeTakeFirst()).toEqual(before)
  })
})
