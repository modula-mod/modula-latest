import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql} from 'kysely'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldAIRepository} from '../src/ai/repository.js'
import {GreenfieldModuleRuntimeAccessService} from '../src/modules/runtime-access.js'
import {adapterManifest, configureRegistryTestEnv, registerAccount} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)

describeIfDb('API-BASELINE-02 ownership and trust acceptance', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let accountA = ''
  let accountB = ''
  let tokenA = ''
  let tokenB = ''
  const password = 'secure-pass-word-1'
  const emailA = `api-atlas-a-${suffix}@example.com`
  const emailB = `api-atlas-b-${suffix}@example.com`
  const handleA = `atlasa${suffix}`
  const handleB = `atlasb${suffix}`

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!, '4067')
    process.env.GREENFIELD_AI_GATEWAY_ENABLED = 'true'
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    const a = await registerAccount(app, emailA, handleA, db)
    const b = await registerAccount(app, emailB, handleB, db)
    accountA = a.accountId
    accountB = b.accountId
    tokenA = a.token
    tokenB = b.token
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  const auth = (token: string) => ({authorization: `Bearer ${token}`})

  it('executes representative cross-user account, profile, post, comment, media and record denials', async () => {
    const bSession = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email: emailB, password}})
    expect(bSession.statusCode, bSession.body).toBe(200)
    const bSessionId = bSession.json().data.sessionId as string
    const bToken2 = bSession.json().data.accessToken as string

    const privateHandleHistory = await app.inject({method: 'GET', url: `/v1/accounts/${accountB}/handle-history`, headers: auth(tokenA)})
    expect(privateHandleHistory.statusCode).toBe(403)
    expect(privateHandleHistory.json().error.code).toBe('FORBIDDEN')

    // The endpoint deliberately returns an idempotent success, but its account
    // predicate must leave the other user's session active.
    const crossSessionRevoke = await app.inject({method: 'DELETE', url: `/v1/sessions/${bSessionId}`, headers: auth(tokenA)})
    expect(crossSessionRevoke.statusCode).toBe(200)
    const stillActive = await app.inject({method: 'GET', url: '/v1/accounts/me', headers: auth(bToken2)})
    expect(stillActive.statusCode).toBe(200)
    expect(stillActive.json().data.accountId).toBe(accountB)

    const profileB = await db.selectFrom('profiles').select(['id', 'actor_id', 'version']).where('actor_id', '=', `actor-${accountB}`).executeTakeFirstOrThrow()
    const hideB = await app.inject({
      method: 'PATCH', url: '/v1/profiles/me', headers: auth(tokenB),
      payload: {visibility: 'followers', expectedVersion: profileB.version},
    })
    expect(hideB.statusCode, hideB.body).toBe(200)
    const privateProfile = await app.inject({method: 'GET', url: `/v1/profiles/${handleB}`, headers: auth(tokenA)})
    expect(privateProfile.statusCode).toBe(404)
    const crossProfileUpdate = await app.inject({
      method: 'PATCH', url: '/v1/profiles/me', headers: auth(tokenA),
      payload: {actorId: profileB.actor_id, displayName: 'cross-user mutation'},
    })
    expect(crossProfileUpdate.statusCode).toBe(403)

    const publicPost = await app.inject({
      method: 'POST', url: '/v1/posts', headers: auth(tokenB),
      payload: {text: `[API-BASELINE-02:${suffix}] public owner fixture`, audience: 'public', idempotencyKey: `atlas-public-${suffix}`},
    })
    expect(publicPost.statusCode, publicPost.body).toBe(201)
    const publicPostId = publicPost.json().data.id as string
    const privatePost = await app.inject({
      method: 'POST', url: '/v1/posts', headers: auth(tokenB),
      payload: {text: `[API-BASELINE-02:${suffix}] private owner fixture`, audience: 'private', idempotencyKey: `atlas-private-${suffix}`},
    })
    expect(privatePost.statusCode, privatePost.body).toBe(201)
    const privatePostId = privatePost.json().data.id as string
    expect((await app.inject({method: 'GET', url: `/v1/posts/${privatePostId}`, headers: auth(tokenA)})).statusCode).toBe(404)
    const editPost = await app.inject({method: 'PATCH', url: `/v1/posts/${publicPostId}`, headers: auth(tokenA), payload: {text: 'cross-user edit', expectedVersion: 1}})
    expect(editPost.statusCode).toBe(403)
    expect(editPost.json().error.code).toBe('FORBIDDEN')
    expect((await app.inject({method: 'DELETE', url: `/v1/posts/${publicPostId}`, headers: auth(tokenA)})).statusCode).toBe(403)

    const comment = await app.inject({method: 'POST', url: `/v1/posts/${publicPostId}/comments`, headers: auth(tokenB), payload: {text: `[API-BASELINE-02:${suffix}] owner comment`}})
    expect(comment.statusCode, comment.body).toBe(201)
    const commentId = comment.json().data.comment_id as string
    const editComment = await app.inject({method: 'PATCH', url: `/v1/comments/${commentId}`, headers: auth(tokenA), payload: {text: 'cross-user edit', expectedVersion: 1}})
    expect(editComment.statusCode).toBe(403)
    expect((await app.inject({method: 'DELETE', url: `/v1/comments/${commentId}`, headers: auth(tokenA)})).statusCode).toBe(403)

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    const upload = await app.inject({
      method: 'POST', url: '/v1/attachments/uploads', headers: auth(tokenB),
      payload: {filename: `api-atlas-${suffix}.png`, mimeType: 'image/png', size: png.length, metadata: {auditMarker: 'API-BASELINE-02'}},
    })
    expect(upload.statusCode, upload.body).toBe(201)
    const {uploadId, attachmentId} = upload.json().data
    const content = await app.inject({method: 'PUT', url: `/v1/attachments/uploads/${uploadId}/content`, headers: {...auth(tokenB), 'content-type': 'application/octet-stream'}, payload: png})
    expect(content.statusCode, content.body).toBe(200)
    expect((await app.inject({method: 'GET', url: `/v1/attachments/${attachmentId}`, headers: auth(tokenA)})).statusCode).toBe(403)
    expect((await app.inject({method: 'GET', url: `/v1/attachments/${attachmentId}/content`, headers: auth(tokenA)})).statusCode).toBe(403)
    expect((await app.inject({method: 'DELETE', url: `/v1/attachments/${attachmentId}`, headers: auth(tokenA)})).statusCode).toBe(403)
    expect((await app.inject({method: 'POST', url: '/v1/profiles/me/avatar', headers: auth(tokenA), payload: {attachmentId}})).statusCode).toBe(403)
    const attachToForeignPost = await app.inject({method: 'POST', url: '/v1/posts', headers: auth(tokenA), payload: {authorActorId: profileB.actor_id, text: 'cross-user media bind', idempotencyKey: `atlas-cross-media-${suffix}`, content: [{type: 'image', attachmentId}]}})
    expect(attachToForeignPost.statusCode).toBe(403)

    const privateRecord = await app.inject({
      method: 'POST', url: '/v1/repositories/me/records', headers: auth(tokenB),
      payload: {collection: 'modula.api-atlas.fixture', schemaId: 'modula.extensions.tool', schemaVersion: 1, visibility: 'private', data: {name: 'API Atlas fixture', auditMarker: 'API-BASELINE-02'}},
    })
    expect(privateRecord.statusCode, privateRecord.body).toBe(201)
    const recordId = privateRecord.json().data.record_id as string
    expect((await app.inject({method: 'GET', url: `/v1/repositories/me/records/${recordId}`, headers: auth(tokenA)})).statusCode).toBe(404)
    expect((await app.inject({method: 'PATCH', url: `/v1/repositories/me/records/${recordId}`, headers: auth(tokenA), payload: {data: {stolen: true}, expectedRevision: 1}})).statusCode).toBe(404)
  })

  it('[EXPECTED FAILURE] proves follower-only profiles become visible immediately without request/accept/reject', async () => {
    const profileB = await db.selectFrom('profiles').select(['id', 'version']).where('actor_id', '=', `actor-${accountB}`).executeTakeFirstOrThrow()
    const ownerView = await app.inject({method: 'GET', url: `/v1/profiles/${handleB}`, headers: auth(tokenB)})
    if (ownerView.json().data.visibility !== 'followers') {
      const update = await app.inject({method: 'PATCH', url: '/v1/profiles/me', headers: auth(tokenB), payload: {visibility: 'followers', expectedVersion: profileB.version}})
      expect(update.statusCode, update.body).toBe(200)
    }
    const before = await app.inject({method: 'GET', url: `/v1/profiles/${handleB}`, headers: auth(tokenA)})
    expect(before.statusCode).toBe(404)
    const follow = await app.inject({method: 'POST', url: `/v1/profiles/${profileB.id}/follow`, headers: auth(tokenA)})
    expect(follow.statusCode, follow.body).toBe(200)
    expect(follow.json().data.isFollowing).toBe(true)
    const after = await app.inject({method: 'GET', url: `/v1/profiles/${handleB}`, headers: auth(tokenA)})
    expect(after.statusCode).toBe(200)
  })

  it('hides foreign installations and binds legacy functions to the owned installation version', async () => {
    const fixture = await seedModuleFixture(db, accountA)
    const otherFixture = await seedModuleFixture(db, accountA)
    const foreign = await app.inject({
      method: 'POST', url: `/v1/functions/${fixture.functionId}/invoke`, headers: auth(tokenB),
      payload: {installationId: fixture.installationId, input: {auditMarker: 'API-BASELINE-02'}},
    })
    expect(foreign.statusCode, foreign.body).toBe(404)
    expect(foreign.json().error).toMatchObject({code: 'NOT_FOUND', message: 'Installation not found'})

    const mismatchedFunction = await app.inject({
      method: 'POST', url: `/v1/functions/${otherFixture.functionId}/invoke`, headers: auth(tokenA),
      payload: {installationId: fixture.installationId, input: {auditMarker: 'API-BASELINE-02'}},
    })
    expect(mismatchedFunction.statusCode, mismatchedFunction.body).toBe(404)
    expect(mismatchedFunction.json().error).toMatchObject({code: 'NOT_FOUND', message: 'Function not found'})

    const owned = await app.inject({
      method: 'POST', url: `/v1/functions/${fixture.functionId}/invoke`, headers: auth(tokenA),
      payload: {installationId: fixture.installationId, input: {auditMarker: 'API-BASELINE-02'}},
    })
    // The fixture intentionally has no URL. Its owner reaching function
    // validation proves the scoped installation and capability were accepted.
    expect(owned.statusCode, owned.body).toBe(400)
    expect(owned.json().error).toMatchObject({code: 'VALIDATION_FAILED', message: 'Remote function URL missing'})
  })

  it('hides foreign AI streams from reconnect and cancel without mutating them', async () => {
    const repository = new GreenfieldAIRepository(db)
    const requestId = `api-atlas-request-${suffix}`
    await repository.createRequestLedger({
      requestId,
      requestingModuleId: 'digital.modula.api-atlas-fixture',
      accountId: accountA,
      correlationId: `api-atlas-${suffix}`,
      requiredCapabilities: [],
      status: 'running',
      streamingRequested: true,
      streamingUsed: true,
    })
    const streamId = await repository.createStream({requestId, accountId: accountA, moduleId: 'digital.modula.api-atlas-fixture', correlationId: `api-atlas-${suffix}`})
    const foreignReconnect = await app.inject({method: 'POST', url: `/v1/ai/streams/${streamId}/reconnect`, headers: auth(tokenB)})
    expect(foreignReconnect.statusCode, foreignReconnect.body).toBe(404)
    expect(foreignReconnect.json().error).toMatchObject({code: 'NOT_FOUND', message: 'AI stream not found'})
    expect((await repository.requireStream(streamId)).status).toBe('open')

    const foreignCancel = await app.inject({method: 'POST', url: `/v1/ai/streams/${streamId}/cancel`, headers: auth(tokenB)})
    expect(foreignCancel.statusCode, foreignCancel.body).toBe(404)
    expect(foreignCancel.json().error).toMatchObject({code: 'NOT_FOUND', message: 'AI stream not found'})
    expect((await repository.requireStream(streamId)).status).toBe('open')

    const reconnect = await app.inject({method: 'POST', url: `/v1/ai/streams/${streamId}/reconnect`, headers: auth(tokenA)})
    expect(reconnect.statusCode, reconnect.body).toBe(200)
    expect(reconnect.json().data).toMatchObject({streamId, status: 'reconnecting'})
    await repository.updateStream({streamId, status: 'open'})
    const cancel = await app.inject({method: 'POST', url: `/v1/ai/streams/${streamId}/cancel`, headers: auth(tokenA)})
    expect(cancel.statusCode, cancel.body).toBe(200)
    expect(cancel.json().data.cancelled).toBe(true)
    expect((await repository.requireStream(streamId)).status).toBe('cancelled')
  })

  it('fails closed when a module permission review is missing', async () => {
    const fixture = await seedModuleFixture(db, accountB)
    const review = await db.selectFrom('greenfield_module_permission_reviews').select('review_id').where('installation_id', '=', fixture.installationId).executeTakeFirst()
    expect(review).toBeUndefined()
    const context = await new GreenfieldModuleRuntimeAccessService(db).resolve(accountB, fixture.moduleId, {requireEnabled: true})
    expect(context.permissionReviewRequired).toBe(true)
    expect(context.grantedPermissions).toEqual([])
    try {
      new GreenfieldModuleRuntimeAccessService(db).enforceCapability(context, 'api-atlas:fixture:read')
      throw new Error('Expected missing review to be denied')
    } catch (error) {
      expect(error).toMatchObject({code: 'PERMISSION_REVIEW_REQUIRED'})
    }
  })

  it('denies cross-account module installation, settings and private record access', async () => {
    const fixture = await seedModuleFixture(db, accountA, true)
    const ownerRecord = await app.inject({method: 'GET', url: `/v1/modules/${fixture.moduleId}/records/note/${fixture.recordId}`, headers: auth(tokenA)})
    expect(ownerRecord.statusCode, ownerRecord.body).toBe(200)
    for (const request of [
      {method: 'GET', url: `/v1/modules/${fixture.moduleId}/install-descriptor`},
      {method: 'GET', url: `/v1/modules/${fixture.moduleId}/settings`},
      {method: 'GET', url: `/v1/modules/${fixture.moduleId}/records/note/${fixture.recordId}`},
      {method: 'PATCH', url: `/v1/modules/${fixture.moduleId}/records/note/${fixture.recordId}`, payload: {data: {title: 'Cross User'}, expectedRevision: 1}},
      {method: 'POST', url: `/v1/modules/${fixture.moduleId}/enable`, payload: {idempotencyKey: `cross-enable-${suffix}`}},
    ] as const) {
      const response = await app.inject({...request, headers: auth(tokenB)} as any)
      expect(response.statusCode, `${request.method} ${request.url}: ${response.body}`).toBe(404)
      expect(response.json().error.code).toBe('NOT_FOUND')
    }
  })
})

async function seedModuleFixture(db: any, accountId: string, withRecord = false) {
  const id = randomUUID().slice(0, 8)
  const now = new Date()
  const moduleId = `digital.modula.api-atlas-${id}`
  const publisherId = `api-atlas-publisher-${id}`
  const extensionId = `api-atlas-extension-${id}`
  const extensionVersionId = `api-atlas-extension-version-${id}`
  const moduleVersionId = `api-atlas-module-version-${id}`
  const releaseId = `api-atlas-release-${id}`
  const installationId = `api-atlas-installation-${id}`
  const functionId = `api-atlas-function-${id}`
  const recordId = `api-atlas-record-${id}`
  const manifest = adapterManifest(moduleId, '1.0.0', {
    permissions: [
      {permission: 'api-atlas:fixture:read', reason: 'Expected-failure acceptance fixture', risk: 'low'},
      {permission: `records:module.${moduleId}.note:read`, reason: 'Owned record acceptance', risk: 'low'},
      {permission: `records:module.${moduleId}.note:write`, reason: 'Owned record acceptance', risk: 'medium'},
    ] as any,
  })
  await db.insertInto('greenfield_publishers').values({publisher_id: publisherId, display_name: 'API Atlas Fixture', website: null, status: 'verified', trust_level: 'firstParty', created_at: now, updated_at: now, verified_at: now, suspended_at: null, revoked_at: null}).execute()
  await db.insertInto('greenfield_extensions').values({extension_id: extensionId, slug: moduleId, publisher_account_id: null, status: 'published', created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_extension_versions').values({extension_version_id: extensionVersionId, extension_id: extensionId, version: '1.0.0', manifest: sql`${JSON.stringify(manifest)}::jsonb`, status: 'published', created_at: now}).execute()
  await db.insertInto('greenfield_module_versions').values({module_version_id: moduleVersionId, extension_version_id: extensionVersionId, module_id: moduleId, version: '1.0.0', publisher_id: publisherId, manifest: sql`${JSON.stringify(manifest)}::jsonb`, status: 'published', created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_module_releases').values({release_id: releaseId, module_version_id: moduleVersionId, extension_id: extensionId, extension_version_id: extensionVersionId, module_id: moduleId, version: '1.0.0', publisher_id: publisherId, release_state: 'published', source_repository: 'modula-mod/api-atlas-fixture', source_commit: 'a'.repeat(40), manifest_path: 'module.manifest.json', manifest_sha256: manifest.integrity.manifestSha256, release_sha256: 'b'.repeat(64), signature_key_id: null, signature: null, compatibility: {}, license_status: 'firstParty', trust_level: 'firstParty', product_kind: 'module', extension_product: {}, published_at: now, quarantined_at: null, revoked_at: null, superseded_at: null, created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_extension_installations').values({installation_id: installationId, extension_version_id: extensionVersionId, account_id: accountId, status: 'enabled', config: {}, created_at: now, updated_at: now}).execute()
  await db.insertInto('greenfield_extension_capabilities').values({capability_id: `api-atlas-capability-${id}`, installation_id: installationId, capability: 'function:invoke', granted_at: now, revoked_at: null}).execute()
  await db.insertInto('greenfield_functions').values({function_id: functionId, extension_version_id: extensionVersionId, name: 'API Atlas safe missing URL fixture', kind: 'remoteHttp', config: {}, timeout_ms: 1000, created_at: now}).execute()
  if (withRecord) {
    await db.insertInto('greenfield_module_record_collections').values({
      collection_id: `api-atlas-collection-${id}`, release_id: releaseId, module_id: moduleId, collection: 'note', schema_ref: 'schemas/note.json', default_visibility: 'private',
      fields: sql`${JSON.stringify([{fieldId: 'title', name: 'title', type: 'text', label: 'Title', required: true}])}::jsonb`, searchable_fields: sql`'[]'::jsonb`, filterable_fields: sql`'[]'::jsonb`, sortable_fields: sql`'["title"]'::jsonb`, folder_field: null, reference_fields: sql`'[]'::jsonb`, schema_definition: {}, retention_policy: 'keepOnUninstall', registration_status: 'registered', created_at: now, updated_at: now,
    }).execute()
    await db.insertInto('greenfield_module_records').values({
      record_id: recordId, account_id: accountId, module_id: moduleId, installation_id: installationId, collection: 'note', schema_ref: 'schemas/note.json', visibility: 'private', data: sql`${JSON.stringify({title: 'API Atlas owned record', auditMarker: 'API-BASELINE-02'})}::jsonb`, search_text: 'API Atlas owned record', folder_ref: null, source_uri: null, retained_after_uninstall: false, revision: 1, created_at: now, updated_at: now, deleted_at: null,
    }).execute()
  }
  return {moduleId, releaseId, installationId, functionId, recordId}
}
