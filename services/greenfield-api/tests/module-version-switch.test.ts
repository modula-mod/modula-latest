import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldMpsIngestService} from '../src/product-standard/ingest-service.js'
import {descriptorDigest} from '../src/modules/install-descriptor-service.js'
import {compareVersions, dataSchemaDiff, directionOf} from '../src/modules/version-switch-service.js'
import {createDb as createWorkerDb, type ModulaWorkerDb} from '../../greenfield-worker/src/database.js'
import {loadConfig as loadWorkerConfig} from '../../greenfield-worker/src/config.js'
import {handleModuleInstall} from '../../greenfield-worker/src/modules/installation-handler.js'
import {handleModuleEnable} from '../../greenfield-worker/src/modules/enable-handler.js'
import {handleModuleUpdate} from '../../greenfield-worker/src/modules/update-handler.js'
import {adapterManifest, configureRegistryTestEnv, evidenceFor, fixtureProduct, registerAccount} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)

describe('module version switching: pure helpers', () => {
  it('orders versions numerically and derives the direction', () => {
    expect(compareVersions('1.10.0', '1.9.2')).toBe(1)
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(-1)
    expect(directionOf('1.7.0', '1.2.0')).toBe('downgrade')
    expect(directionOf('1.2.0', '1.7.0')).toBe('upgrade')
    expect(directionOf('1.2.0', '1.2.0')).toBe('none')
  })

  it('flags an older data schema only from what the manifests declare', () => {
    const release = (schemas: unknown[]) => ({manifest: {contributions: {schemas}}} as any)
    const current = release([{collection: 'note', version: '2.0.0'}, {collection: 'tag'}, {collection: 'folder'}])
    const older = dataSchemaDiff(current, release([{collection: 'note', version: '1.0.0'}, {collection: 'folder'}]))
    expect(older).toMatchObject({missingInTarget: ['tag'], olderInTarget: [{collection: 'note', from: '2.0.0', to: '1.0.0'}], older: true})
    const same = dataSchemaDiff(current, release([{collection: 'note', version: '2.0.0'}, {collection: 'tag'}, {collection: 'folder'}]))
    expect(same.older).toBe(false)
    expect(dataSchemaDiff(release([]), release([])).older).toBe(false)
  })
})

describeIfDb('module version switching: upgrade and downgrade through the registry', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let workerDb: ModulaWorkerDb
  let token = ''
  let accountId = ''
  let installationId = ''
  const moduleId = `digital.modula.switch-${suffix}`
  const releases: Record<string, string> = {}
  const base = ['schemas:register', 'settings:register']

  const permission = (name: string, risk = 'medium') => ({permission: name, risk, reason: `Fixture ${name}`})

  async function publish(
    version: string,
    permissions: string[],
    schemas: Array<{collection: string; version?: string}> = [],
    state: 'published' | 'superseded' = 'published',
    channel: 'stable' | 'beta' | 'rc' | 'dev' = 'stable',
  ) {
    const service = new GreenfieldModuleReleaseService(db)
    const manifest = adapterManifest(moduleId, version, {
      permissions: permissions.map(name => permission(name, name === 'functions:register' ? 'high' : 'medium')) as any,
      contributions: {schemas: schemas.map(item => ({id: `${moduleId}.schemas.${item.collection}`, title: item.collection, schemaRef: `schemas/${item.collection}.json`, collection: item.collection, defaultVisibility: 'private', ...(item.version ? {version: item.version} : {})}))} as any,
    })
    const pending = await service.importPendingReview(manifest, evidenceFor(manifest))
    if (channel !== 'stable') {
      await db.updateTable('greenfield_module_releases')
        .set({release_channel: channel})
        .where('release_id', '=', pending.releaseId)
        .execute()
    }
    const release = await service.publishRelease(moduleId, version)
    const product = fixtureProduct(moduleId, version)
    await new GreenfieldMpsIngestService(db).ingest({filename: 'modula.product.json', bytes: product.mpsBytes, releaseId: release.releaseId, frontend: product.frontend, schemas: product.schemas, assets: product.assets})
    if (state === 'superseded') await db.updateTable('greenfield_module_releases').set({release_state: 'superseded', superseded_at: new Date()} as any).where('release_id', '=', release.releaseId).execute()
    releases[version] = release.releaseId
    return release
  }

  const auth = () => ({authorization: `Bearer ${token}`})

  async function installedVersion() {
    const row = await db.selectFrom('greenfield_extension_installations')
      .innerJoin('greenfield_module_releases', 'greenfield_module_releases.extension_version_id', 'greenfield_extension_installations.extension_version_id')
      .select(['greenfield_module_releases.version', 'greenfield_extension_installations.status'])
      .where('greenfield_extension_installations.installation_id', '=', installationId)
      .executeTakeFirstOrThrow()
    return row
  }

  async function switchTo(version: string, body: Record<string, unknown> = {}, key = `switch-${version}-${randomUUID()}`) {
    return app.inject({method: 'POST', url: `/v1/modules/${moduleId}/update`, headers: {...auth(), 'idempotency-key': key}, payload: {version, platform: 'ios', ...body}})
  }

  async function completeSwitch(response: {json(): any}) {
    const data = response.json().data
    await handleModuleUpdate(workerDb, loadWorkerConfig(), {installationId, targetReleaseId: data.descriptor.registryReleaseId, previousStatus: 'enabled', moduleId, accountId, planId: data.planId})
  }

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!, '4061')
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    workerDb = createWorkerDb(databaseUrl!)
    await app.ready()
    await publish('0.9.0', [...base, 'profile-tabs:register'], [{collection: 'note', version: '1.0.0'}], 'superseded')
    await publish('1.0.0', base, [{collection: 'note', version: '2.0.0'}, {collection: 'tag'}])
    await publish('1.1.0', [...base, 'search:index'], [{collection: 'note', version: '2.0.0'}, {collection: 'tag'}])
    await publish('1.2.0', [...base, 'search:index', 'functions:register'], [{collection: 'note', version: '2.0.0'}, {collection: 'tag'}])
    await publish('1.3.0', base, [{collection: 'note', version: '2.0.0'}, {collection: 'tag'}])
    await publish('1.4.0', base, [{collection: 'note', version: '2.0.0'}, {collection: 'tag'}])
    const registered = await registerAccount(app, `switch-${suffix}@example.com`, `sw${suffix}`, db)
    token = registered.token
    accountId = registered.accountId
    const install = await app.inject({method: 'POST', url: `/v1/modules/${moduleId}/install`, headers: {...auth(), 'idempotency-key': `install-${suffix}`}, payload: {version: '1.0.0', platform: 'ios', approvedPermissions: base}})
    expect(install.statusCode, install.body).toBe(202)
    installationId = install.json().data.installationId
    const plan = await db.selectFrom('greenfield_module_install_plans').select('plan_id').where('installation_id', '=', installationId).executeTakeFirstOrThrow()
    await handleModuleInstall(workerDb, loadWorkerConfig(), {planId: plan.plan_id, installationId, releaseId: releases['1.0.0'], moduleId, accountId})
    const enable = await app.inject({method: 'POST', url: `/v1/modules/${moduleId}/enable`, headers: {...auth(), 'idempotency-key': `enable-${suffix}`}})
    expect(enable.statusCode, enable.body).toBe(202)
    await handleModuleEnable(workerDb, loadWorkerConfig(), {installationId, releaseId: releases['1.0.0'], moduleId, accountId})
    expect(await installedVersion()).toEqual({version: '1.0.0', status: 'enabled'})
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
    await workerDb?.destroy()
  })

  it('lists registry versions relative to the installation with trust and compatibility', async () => {
    const installed = await app.inject({method: 'GET', url: '/v1/modules/installed', headers: auth()})
    expect(installed.statusCode, installed.body).toBe(200)
    expect(installed.json().data).toEqual(expect.arrayContaining([
      expect.objectContaining({moduleId, version: '1.0.0', releaseChannel: 'stable'}),
    ]))

    const response = await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/versions?platform=ios&hostVersion=1.3.0`, headers: auth()})
    expect(response.statusCode, response.body).toBe(200)
    const data = response.json().data
    expect(data).toMatchObject({moduleId, installedVersion: '1.0.0', latestVersion: '1.4.0', updateAvailable: true})
    expect(data.versions.map((item: any) => item.version)).toEqual(['1.4.0', '1.3.0', '1.2.0', '1.1.0', '1.0.0', '0.9.0'])
    const byVersion = Object.fromEntries(data.versions.map((item: any) => [item.version, item]))
    expect(byVersion['1.4.0']).toMatchObject({direction: 'upgrade', latest: true, switchable: true, releaseState: 'published', trust: {signatureState: 'unsigned', revoked: false}})
    expect(byVersion['1.0.0']).toMatchObject({direction: 'none', current: true, switchable: false})
    expect(byVersion['0.9.0']).toMatchObject({direction: 'downgrade', releaseState: 'superseded', switchable: true})
    expect(byVersion['1.4.0'].digests.adapterManifestSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(typeof byVersion['1.4.0'].publishedAt).toBe('string')
  })

  it('treats switching to the installed version as a no-op', async () => {
    const response = await switchTo('1.0.0')
    expect(response.statusCode, response.body).toBe(202)
    expect(response.json().data).toMatchObject({noop: true, direction: 'none', status: 'enabled', fromVersion: '1.0.0', toVersion: '1.0.0'})
    expect(response.json().data.descriptor.version).toBe('1.0.0')
    expect(await installedVersion()).toEqual({version: '1.0.0', status: 'enabled'})
  })

  it('upgrades only after consent to new permissions and returns the target install descriptor', async () => {
    const preview = await app.inject({method: 'POST', url: `/v1/modules/${moduleId}/version-preview`, headers: auth(), payload: {version: '1.1.0', platform: 'ios'}})
    expect(preview.statusCode, preview.body).toBe(200)
    expect(preview.json().data).toMatchObject({direction: 'upgrade', allowed: true, permissions: {requiresConsent: ['search:index'], removed: [], highRiskIncrease: false}})
    expect(preview.json().data.permissions.added[0]).toMatchObject({permission: 'search:index', risk: 'medium'})
    expect(await installedVersion()).toEqual({version: '1.0.0', status: 'enabled'})

    const refused = await switchTo('1.1.0')
    expect(refused.statusCode).toBe(403)
    expect(refused.body).toContain('PERMISSION_REVIEW_REQUIRED')

    const accepted = await switchTo('1.1.0', {approvedPermissions: ['search:index'], hostVersion: '1.3.0'}, `upgrade-${suffix}`)
    expect(accepted.statusCode, accepted.body).toBe(202)
    const data = accepted.json().data
    expect(data).toMatchObject({status: 'updating', direction: 'upgrade', fromVersion: '1.0.0', toVersion: '1.1.0'})
    expect(data.descriptor).toMatchObject({moduleId, version: '1.1.0', registryReleaseId: releases['1.1.0'], installationId, trust: {revoked: false, quarantined: false}})
    expect(data.descriptor.permissions.granted).toContain('search:index')
    const {descriptorSha256, issuedAt: _issuedAt, ...body} = data.descriptor
    expect(descriptorDigest(body)).toBe(descriptorSha256)

    const replay = await switchTo('1.1.0', {approvedPermissions: ['search:index']}, `upgrade-${suffix}`)
    expect(replay.json().data).toMatchObject({idempotent: true, toVersion: '1.1.0'})
    expect(replay.json().data.descriptor.descriptorSha256).toBe(descriptorSha256)

    await completeSwitch(accepted)
    expect(await installedVersion()).toEqual({version: '1.1.0', status: 'enabled'})
    const plan = await db.selectFrom('greenfield_module_install_plans').select(['status', 'install_descriptor_sha256']).where('plan_id', '=', data.planId).executeTakeFirstOrThrow()
    expect(plan).toEqual({status: 'completed', install_descriptor_sha256: descriptorSha256})
    const lookup = await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/install-descriptor`, headers: auth()})
    expect(lookup.json().data.descriptorSha256).toBe(descriptorSha256)
  })

  it('keeps module records across an upgrade and a downgrade', async () => {
    const recordId = randomUUID()
    const now = new Date()
    await db.insertInto('greenfield_module_records').values({
      record_id: recordId, account_id: accountId, module_id: moduleId, installation_id: installationId, collection: 'tag', schema_ref: 'schemas/tag.json',
      visibility: 'private', data: JSON.stringify({name: 'kept'}), search_text: 'kept', folder_ref: null, source_uri: null, retained_after_uninstall: false,
      revision: 1, created_at: now, updated_at: now, deleted_at: null,
    } as any).execute()
    const record = () => db.selectFrom('greenfield_module_records').select(['record_id', 'installation_id', 'data', 'revision', 'deleted_at']).where('record_id', '=', recordId).executeTakeFirstOrThrow()
    const keptRecord = await record()
    const before = await db.selectFrom('greenfield_extension_installations').select(['installation_id']).where('installation_id', '=', installationId).execute()
    const downgrade = await switchTo('1.0.0', {}, `down-${suffix}`)
    expect(downgrade.statusCode, downgrade.body).toBe(202)
    expect(downgrade.json().data).toMatchObject({direction: 'downgrade', fromVersion: '1.1.0', toVersion: '1.0.0', permissions: {added: [], removed: ['search:index']}})
    await completeSwitch(downgrade)
    expect(await installedVersion()).toEqual({version: '1.0.0', status: 'enabled'})
    const after = await db.selectFrom('greenfield_extension_installations').select(['installation_id']).where('installation_id', '=', installationId).execute()
    expect(after).toEqual(before)
    expect(await record()).toEqual(keptRecord)
  })

  it('warns about an older data schema on downgrade and requires acknowledgement', async () => {
    const preview = await app.inject({method: 'POST', url: `/v1/modules/${moduleId}/version-preview`, headers: auth(), payload: {version: '0.9.0', platform: 'ios'}})
    expect(preview.statusCode, preview.body).toBe(200)
    const data = preview.json().data
    expect(data).toMatchObject({direction: 'downgrade', allowed: true, dataSchema: {older: true, missingInTarget: ['tag'], olderInTarget: [{collection: 'note', from: '2.0.0', to: '1.0.0'}]}})
    expect(data.warnings.map((warning: any) => warning.code)).toEqual(expect.arrayContaining(['DATA_SCHEMA_OLDER', 'DOWNGRADE', 'RELEASE_SUPERSEDED']))
    expect(data.permissions.requiresConsent).toEqual(['profile-tabs:register'])

    const unacknowledged = await switchTo('0.9.0', {approvedPermissions: ['profile-tabs:register']})
    expect(unacknowledged.statusCode).toBe(400)
    expect(unacknowledged.body).toContain('DOWNGRADE_ACKNOWLEDGEMENT_REQUIRED')
    const acknowledged = await switchTo('0.9.0', {approvedPermissions: ['profile-tabs:register'], acknowledgeDowngradeRisk: true})
    expect(acknowledged.statusCode, acknowledged.body).toBe(202)
    await completeSwitch(acknowledged)
    expect(await installedVersion()).toEqual({version: '0.9.0', status: 'enabled'})
    const back = await switchTo('1.0.0')
    expect(back.statusCode, back.body).toBe(202)
    await completeSwitch(back)
    expect(await installedVersion()).toEqual({version: '1.0.0', status: 'enabled'})
    // The tag record written under 1.x survives a round trip through a version that does not declare it.
    const tags = await db.selectFrom('greenfield_module_records').select(['record_id', 'deleted_at']).where('installation_id', '=', installationId).where('collection', '=', 'tag').execute()
    expect(tags).toHaveLength(1)
    expect(tags[0]!.deleted_at).toBeNull()
  })

  it('refuses revoked and quarantined targets', async () => {
    await new GreenfieldModuleReleaseService(db).revokeRelease(releases['1.3.0']!, 'fixture revocation')
    const revoked = await switchTo('1.3.0')
    expect(revoked.statusCode, revoked.body).toBe(403)
    expect(revoked.body).toContain('RELEASE_REVOKED')
    await new GreenfieldModuleReleaseService(db).quarantineRelease(releases['1.4.0']!, 'fixture quarantine')
    const quarantined = await switchTo('1.4.0')
    expect(quarantined.statusCode, quarantined.body).toBe(403)
    expect(quarantined.body).toContain('RELEASE_QUARANTINED')
    const list = (await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/versions`, headers: auth()})).json().data
    expect(list.versions.map((item: any) => item.version)).not.toContain('1.3.0')
    expect(list.versions.map((item: any) => item.version)).not.toContain('1.4.0')
    expect(await installedVersion()).toEqual({version: '1.0.0', status: 'enabled'})
  })

  it('never blocks a version when the client sends no hostVersion', async () => {
    const list = (await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/versions?platform=ios`, headers: auth()})).json().data
    for (const item of list.versions) {
      expect(item.blockers.map((blocker: any) => blocker.code)).not.toContain('HOST_INCOMPATIBLE')
    }
    const preview = await app.inject({method: 'POST', url: `/v1/modules/${moduleId}/version-preview`, headers: auth(), payload: {version: '1.2.0', platform: 'ios'}})
    expect(preview.statusCode, preview.body).toBe(200)
    expect(preview.json().data.blockers.map((blocker: any) => blocker.code)).not.toContain('HOST_INCOMPATIBLE')
  })

  it('refuses a target that is incompatible with the host', async () => {
    const preview = await app.inject({method: 'POST', url: `/v1/modules/${moduleId}/version-preview`, headers: auth(), payload: {version: '1.2.0', hostVersion: '0.5.0'}})
    expect(preview.statusCode, preview.body).toBe(200)
    expect(preview.json().data.allowed).toBe(false)
    expect(preview.json().data.blockers[0].code).toBe('HOST_INCOMPATIBLE')
    const refused = await switchTo('1.2.0', {approvedPermissionIncrease: true, hostVersion: '0.5.0'})
    expect(refused.statusCode, refused.body).toBe(400)
    expect(refused.body).toContain('HOST_INCOMPATIBLE')
    expect(await installedVersion()).toEqual({version: '1.0.0', status: 'enabled'})
  })

  it('still honours the legacy consent flag for a high-risk upgrade', async () => {
    const refused = await switchTo('1.2.0')
    expect(refused.statusCode).toBe(403)
    expect(refused.body).toContain('PERMISSION_REVIEW_REQUIRED')
    const accepted = await switchTo('1.2.0', {approvedPermissionIncrease: true})
    expect(accepted.statusCode, accepted.body).toBe(202)
    expect(accepted.json().data.descriptor.permissions.granted).toEqual(expect.arrayContaining(['functions:register', 'search:index']))
    await completeSwitch(accepted)
    expect(await installedVersion()).toEqual({version: '1.2.0', status: 'enabled'})
  })

  it('honours the installation policy when no target version is supplied and never crosses into beta', async () => {
    await publish('2.0.0-beta.1', base, [{collection: 'note', version: '2.0.0'}, {collection: 'tag'}], 'published', 'beta')

    const update = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/update`,
      headers: {...auth(), 'idempotency-key': `policy-default-${suffix}`},
      payload: {platform: 'ios'},
    })
    // These legacy fixtures intentionally have no immutable package inventory,
    // so policy planning fails closed before target selection. The old path
    // skipped the plan and would have queued the newer beta release here.
    expect(update.statusCode, update.body).toBe(404)
    expect(update.body).toContain('complete immutable package artifact')
    expect(await installedVersion()).toEqual({version: '1.2.0', status: 'enabled'})
  })
})
