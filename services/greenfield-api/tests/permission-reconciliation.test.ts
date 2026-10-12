import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql} from 'kysely'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldMpsIngestService} from '../src/product-standard/ingest-service.js'
import {GreenfieldInstallDescriptorService} from '../src/modules/install-descriptor-service.js'
import {GreenfieldModuleRegistryService} from '../src/modules/registry-service.js'
import {GreenfieldModulePermissionReconciliationService} from '../src/modules/permission-reconciliation-service.js'
import {adapterManifest, configureRegistryTestEnv, evidenceFor, fixtureProduct, registerAccount} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)
const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

describeIfDb.sequential('generic historical permission reconciliation', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let token = ''
  let foreignToken = ''
  let accountId = ''
  let installationId = ''
  let sourceReviewId = ''
  let currentReviewId = ''
  let oldReleaseId = ''
  let currentReleaseId = ''
  const moduleId = `digital.modula.permission-reconcile-${suffix}`
  const retained = [
    `records:module.${moduleId}.folder:delete`,
    `records:module.${moduleId}.folder:read`,
    `records:module.${moduleId}.folder:write`,
    `records:module.${moduleId}.note:delete`,
    `records:module.${moduleId}.note:read`,
    `records:module.${moduleId}.note:write`,
    'functions:register', 'routes:register', 'schemas:register', 'settings:register',
  ].sort()
  const introduced = [
    'events:subscribe',
    `records:module.${moduleId}.note-link:read`,
    `records:module.${moduleId}.note-link:write`,
    `records:module.${moduleId}.saved-source:read`,
    `records:module.${moduleId}.saved-source:write`,
    `records:module.${moduleId}.tag:read`,
    `records:module.${moduleId}.tag:write`,
    'search:index', 'module.export.create', 'module.settings.write',
  ].sort()

  async function publish(version: string, permissions: string[]) {
    const manifest = adapterManifest(moduleId, version, {
      permissions: permissions.map(permission => ({permission, risk: permission.includes('delete') ? 'high' : 'medium', reason: `Fixture ${permission}`})) as any,
    })
    const service = new GreenfieldModuleReleaseService(db)
    await service.importPendingReview(manifest, evidenceFor(manifest))
    const release = await service.publishRelease(moduleId, version)
    const product = fixtureProduct(moduleId, version)
    await new GreenfieldMpsIngestService(db).ingest({
      filename: 'modula.product.json', bytes: product.mpsBytes, releaseId: release.releaseId,
      frontend: product.frontend, schemas: product.schemas, assets: product.assets,
    })
    return release
  }

  const auth = (value = token) => ({authorization: `Bearer ${value}`})

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!, '4064')
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    const oldRelease = await publish('0.2.0', retained)
    const currentRelease = await publish('1.8.0', [...retained, ...introduced])
    oldReleaseId = oldRelease.releaseId
    currentReleaseId = currentRelease.releaseId

    const owner = await registerAccount(app, `permission-owner-${suffix}@example.com`, `pr${suffix}`, db)
    accountId = owner.accountId
    token = owner.token
    const foreign = await registerAccount(app, `permission-foreign-${suffix}@example.com`, `pf${suffix}`, db)
    foreignToken = foreign.token

    const install = await app.inject({
      method: 'POST', url: `/v1/modules/${moduleId}/install`,
      headers: {...auth(), 'idempotency-key': `permission-install-${suffix}`},
      payload: {version: '0.2.0', approvedPermissions: retained},
    })
    expect(install.statusCode, install.body).toBe(202)
    installationId = install.json().data.installationId
    const source = await db.selectFrom('greenfield_module_permission_reviews')
      .select('review_id').where('installation_id', '=', installationId).where('release_id', '=', oldReleaseId)
      .orderBy('reviewed_at', 'desc').executeTakeFirstOrThrow()
    sourceReviewId = source.review_id

    await db.updateTable('greenfield_extension_installations').set({
      extension_version_id: currentRelease.extensionVersionId, status: 'enabled', updated_at: new Date(),
    }).where('installation_id', '=', installationId).execute()
    currentReviewId = `permission-current-zero-${suffix}`
    await db.insertInto('greenfield_module_permission_reviews').values({
      review_id: currentReviewId, installation_id: installationId, release_id: currentReleaseId,
      account_id: accountId, granted_permissions: jsonb([]), denied_permissions: jsonb([...retained, ...introduced].sort()),
      high_risk_increase: false, idempotency_key: currentReviewId, reviewed_at: new Date(Date.now() - 2000),
    }).execute()
    const descriptor = await new GreenfieldInstallDescriptorService(db, loadConfig().publicApiUrl).build(currentRelease, {
      installationId, grantedPermissions: [], deniedPermissions: [...retained, ...introduced].sort(),
    })
    await db.insertInto('greenfield_module_install_plans').values({
      plan_id: `permission-plan-${suffix}`, account_id: accountId, release_id: currentReleaseId,
      installation_id: installationId, requested_version: '1.8.0', resolved_dependencies: jsonb([]),
      permission_decision: jsonb({grantedPermissions: [], deniedPermissions: [...retained, ...introduced].sort()}),
      status: 'completed', idempotency_key: `permission-plan-${suffix}`, install_descriptor: jsonb(descriptor),
      install_descriptor_sha256: descriptor.descriptorSha256, created_at: new Date(), updated_at: new Date(),
    }).execute()
    const collection = await db.selectFrom('greenfield_module_record_collections').select('schema_ref')
      .where('release_id', '=', currentReleaseId).where('collection', '=', 'note').executeTakeFirstOrThrow()
    await db.insertInto('greenfield_module_records').values({
      record_id: `permission-note-${suffix}`, account_id: accountId, module_id: moduleId,
      installation_id: installationId, collection: 'note', schema_ref: collection.schema_ref,
      visibility: 'private', data: {id: `permission-note-${suffix}`, title: 'Existing', body: 'Retained'},
      search_text: 'Existing Retained', folder_ref: null, source_uri: null, retained_after_uninstall: true,
      revision: 1, created_at: new Date(), updated_at: new Date(), deleted_at: null,
    }).execute()
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('dry-runs exact historical consent without approving new permissions', async () => {
    const service = new GreenfieldModulePermissionReconciliationService(db, loadConfig())
    const plan = await service.plan({installationId, sourceReviewId})
    expect(plan).toMatchObject({
      installationId, moduleId, currentVersion: '1.8.0', sourceVersion: '0.2.0',
      currentReviewId, currentGrantedPermissions: [], recoveredPermissions: retained,
      reconciledGrantedPermissions: retained, reconciledDeniedPermissions: introduced,
      changed: true,
    })
  })

  it('reports explicit denial distinctly before reconciliation and missing review distinctly', async () => {
    const denied = await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/records/note`, headers: auth()})
    expect(denied.statusCode, denied.body).toBe(403)
    expect(denied.json().error.code).toBe('MODULE_PERMISSION_DENIED')
    await db.deleteFrom('greenfield_module_permission_reviews').where('review_id', '=', currentReviewId).execute()
    const missing = await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/records/note`, headers: auth()})
    expect(missing.statusCode, missing.body).toBe(403)
    expect(missing.json().error.code).toBe('PERMISSION_REVIEW_REQUIRED')
    await db.insertInto('greenfield_module_permission_reviews').values({
      review_id: currentReviewId, installation_id: installationId, release_id: currentReleaseId,
      account_id: accountId, granted_permissions: jsonb([]), denied_permissions: jsonb([...retained, ...introduced].sort()),
      high_risk_increase: false, idempotency_key: `${currentReviewId}-restored`, reviewed_at: new Date(Date.now() - 1000),
    }).execute()
  })

  it('applies through the domain service, preserves denials, and refreshes descriptor permissions', async () => {
    const before = await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/install-descriptor`, headers: auth()})
    expect(before.statusCode, before.body).toBe(200)
    expect(before.json().data.permissions.granted).toEqual([])
    const service = new GreenfieldModulePermissionReconciliationService(db, loadConfig())
    const result = await service.reconcile({
      installationId, sourceReviewId, expectedCurrentReviewId: currentReviewId,
      idempotencyKey: `permission-reconcile-${suffix}`,
    })
    expect(result).toMatchObject({idempotent: false, recoveredPermissions: retained, reconciledDeniedPermissions: introduced})
    const review = await db.selectFrom('greenfield_module_permission_reviews')
      .select(['granted_permissions', 'denied_permissions']).where('review_id', '=', result.reviewId).executeTakeFirstOrThrow()
    expect(review).toEqual({granted_permissions: retained, denied_permissions: introduced})
    const installation = await db.selectFrom('greenfield_extension_installations').select('status')
      .where('installation_id', '=', installationId).executeTakeFirstOrThrow()
    expect(installation.status).toBe('enabled')
    const after = await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/install-descriptor`, headers: auth()})
    expect(after.statusCode, after.body).toBe(200)
    expect(after.json().data.permissions).toEqual({granted: retained, denied: introduced})
    expect(after.json().data.descriptorSha256).not.toBe(before.json().data.descriptorSha256)
  })

  it('allows read, create, and delete only from the recovered record permissions', async () => {
    const list = await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/records/note?q=Existing&sort=updatedAt&direction=desc`, headers: auth()})
    expect(list.statusCode, list.body).toBe(200)
    expect(list.json().data.items).toEqual(expect.arrayContaining([expect.objectContaining({record_id: `permission-note-${suffix}`})]))
    const created = await app.inject({
      method: 'POST', url: `/v1/modules/${moduleId}/records/note`, headers: auth(),
      payload: {mutationId: `permission-create-${suffix}`, data: {
        id: `permission-new-${suffix}`,
        title: 'New note',
        body: {schemaVersion: '1.0.0', blocks: [{id: `block-${suffix}`, type: 'paragraph', text: 'Created', marks: []}]},
      }},
    })
    expect(created.statusCode, created.body).toBe(201)
    const removed = await app.inject({
      method: 'DELETE', url: `/v1/modules/${moduleId}/records/note/${created.json().data.record_id}`,
      headers: auth(), payload: {expectedRevision: 1, mutationId: `permission-delete-${suffix}`},
    })
    expect(removed.statusCode, removed.body).toBe(200)
  })

  it('keeps foreign, disabled, untrusted, and stale-dry-run paths fail-closed', async () => {
    const foreign = await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/records/note`, headers: auth(foreignToken)})
    expect(foreign.statusCode, foreign.body).toBe(404)

    await db.updateTable('greenfield_extension_installations').set({status: 'installedDisabled'})
      .where('installation_id', '=', installationId).execute()
    const disabled = await app.inject({method: 'GET', url: `/v1/modules/${moduleId}/records/note`, headers: auth()})
    expect(disabled.statusCode, disabled.body).toBe(403)
    expect(disabled.json().error.code).toBe('INSTALLATION_DISABLED')
    await db.updateTable('greenfield_extension_installations').set({status: 'enabled'})
      .where('installation_id', '=', installationId).execute()

    const production = {...loadConfig(), environment: 'production' as const, moduleAllowUntrustedDevelopmentReleases: false}
    await expect(new GreenfieldModulePermissionReconciliationService(db, production).plan({installationId, sourceReviewId}))
      .rejects.toMatchObject({code: 'UNTRUSTED_RELEASE'})
    await expect(new GreenfieldModulePermissionReconciliationService(db, loadConfig()).reconcile({
      installationId, sourceReviewId, expectedCurrentReviewId: currentReviewId,
      idempotencyKey: `permission-stale-${suffix}`,
    })).rejects.toMatchObject({code: 'CONFLICT'})
  })

  it('never recovers a permission denied by the nominated historical review', async () => {
    const deniedSourceId = `permission-source-denied-${suffix}`
    await db.insertInto('greenfield_module_permission_reviews').values({
      review_id: deniedSourceId, installation_id: installationId, release_id: oldReleaseId, account_id: accountId,
      granted_permissions: jsonb([retained[0]]), denied_permissions: jsonb(retained.slice(1)), high_risk_increase: false,
      idempotency_key: deniedSourceId, reviewed_at: new Date(),
    }).execute()
    const plan = await new GreenfieldModulePermissionReconciliationService(db, loadConfig()).plan({installationId, sourceReviewId: deniedSourceId})
    expect(plan.reconciledGrantedPermissions).toEqual(retained)
    expect(plan.recoveredPermissions).toEqual([])
    expect(plan.reconciledDeniedPermissions).toEqual(introduced)
  })
})
