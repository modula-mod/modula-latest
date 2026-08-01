import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {manifestChecksum, type GreenfieldModuleManifestV1} from '@modula/greenfield-module-manifest'
import {
  validateGreenfieldModuleAction,
  validateGreenfieldModuleView,
  type GreenfieldModuleAction,
  type GreenfieldModuleCollectionDefinition,
  type GreenfieldModuleView,
} from '@modula/greenfield-module-ui-contracts'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIf = databaseUrl ? describe : describe.skip

const baseModuleId = 'digital.modula.phase7b-notes'

describe('Phase 7B declarative module contract guards', () => {
  it('rejects unsupported components and executable UI declarations', () => {
    const result = validateGreenfieldModuleView({
      viewId: `${baseModuleId}.views.bad`,
      moduleId: baseModuleId,
      kind: 'detail',
      title: 'Bad',
      requiredCapabilities: [],
      layout: [{id: 'bad', component: 'webView', html: '<main>unsafe</main>'}],
    })
    expect(result.valid).toBe(false)
    expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(['FORBIDDEN_DECLARATIVE_KEY', 'UNSUPPORTED_COMPONENT']))
  })

  it('rejects unsupported action names', () => {
    const result = validateGreenfieldModuleAction(
      {
        actionId: `${baseModuleId}.actions.run`,
        kind: 'script.run',
        label: 'Run',
        inputSchema: {fields: []},
        capability: `records:module.${baseModuleId}.note:write`,
        confirmationPolicy: 'none',
        destructive: false,
        successDestination: {kind: 'stay'},
        errorPresentation: {kind: 'inline'},
        requiresIdempotencyKey: true,
      },
      baseModuleId,
    )
    expect(result.valid).toBe(false)
    expect(result.issues.map(issue => issue.code)).toContain('UNSUPPORTED_ACTION_KIND')
  })
})

describeIf('Phase 7B module runtime API', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let token = ''
  let accountId = ''
  let otherToken = ''
  let moduleId = ''
  let releaseId = ''
  let installationId = ''

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4024'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4024'
    process.env.MODULA_DATABASE_URL = databaseUrl!
    process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
    process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
    process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
    process.env.MODULA_INVITE_ONLY = 'true'
    process.env.MODULA_REGISTRATION_INVITE_CODES = 'test-invite'
    process.env.MODULA_ATPROTO_ENABLED = 'false'
    process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()

    const suffix = Date.now().toString(36)
    moduleId = `${baseModuleId}.${suffix}`
    const primary = await registerAccount(`p7b-${suffix}@example.com`, `p7b${suffix}`.slice(0, 20))
    token = primary.token
    accountId = primary.accountId
    otherToken = (await registerAccount(`p7b-other-${suffix}@example.com`, `p7bo${suffix}`.slice(0, 20))).token
    await seedModule(accountId, moduleId)
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('serves current installed declarative views with allowed actions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/modules/${moduleId}/views`,
      headers: {authorization: `Bearer ${token}`},
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.views[0].viewId).toBe(`${moduleId}.views.note-list`)
    expect(res.json().data.views[0].allowedActions[0].kind).toBe('record.create')
  })

  it('creates, queries, updates and deletes account-scoped module records', async () => {
    const create = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/records/note`,
      headers: {authorization: `Bearer ${token}`},
      payload: {data: {title: 'Alpha note', body: 'searchable body', tags: ['phase7b'], folderId: 'inbox', sourceUri: 'https://modula.digital/post/1'}},
    })
    expect(create.statusCode).toBe(201)
    const record = create.json().data
    expect(record.visibility).toBe('private')
    expect(record.revision).toBe(1)

    const search = await app.inject({
      method: 'GET',
      url: `/v1/modules/${moduleId}/records/note?q=searchable&folder=inbox&sort=updatedAt&direction=desc`,
      headers: {authorization: `Bearer ${token}`},
    })
    expect(search.statusCode).toBe(200)
    expect(search.json().data.items.length).toBeGreaterThanOrEqual(1)

    const conflict = await app.inject({
      method: 'PATCH',
      url: `/v1/modules/${moduleId}/records/note/${record.record_id}`,
      headers: {authorization: `Bearer ${token}`},
      payload: {expectedRevision: 99, data: {title: 'Conflict'}},
    })
    expect(conflict.statusCode).toBe(409)

    const patch = await app.inject({
      method: 'PATCH',
      url: `/v1/modules/${moduleId}/records/note/${record.record_id}`,
      headers: {authorization: `Bearer ${token}`},
      payload: {expectedRevision: 1, data: {title: 'Beta note'}},
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().data.revision).toBe(2)

    const denied = await app.inject({
      method: 'GET',
      url: `/v1/modules/${moduleId}/records/note/${record.record_id}`,
      headers: {authorization: `Bearer ${otherToken}`},
    })
    expect(denied.statusCode).toBe(404)

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/v1/modules/${moduleId}/records/note/${record.record_id}`,
      headers: {authorization: `Bearer ${token}`},
      payload: {expectedRevision: 2},
    })
    expect(deleted.statusCode).toBe(200)
    expect(deleted.json().data.deleted).toBe(true)
  })

  it('executes only registered declarative actions with granted capabilities', async () => {
    const action = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/actions/${moduleId}.actions.create-note`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': 'phase7b-create-note'},
      payload: {input: {title: 'Action note', body: 'created by action', tags: [], folderId: 'actions', sourceUri: 'https://modula.digital/post/2'}},
    })
    expect(action.statusCode).toBe(200)
    expect(action.json().data.result.revision).toBe(1)

    const repeat = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/actions/${moduleId}.actions.create-note`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': 'phase7b-create-note'},
      payload: {input: {title: 'Different title'}},
    })
    expect(repeat.statusCode).toBe(200)
    expect(repeat.json().data.idempotent).toBe(true)

    await db
      .updateTable('greenfield_module_permission_reviews')
      .set({granted_permissions: [`records:module.${moduleId}.note:read`]})
      .where('installation_id', '=', installationId)
      .execute()
    const denied = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/actions/${moduleId}.actions.create-note`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': 'phase7b-denied'},
      payload: {input: {title: 'Denied'}},
    })
    expect(denied.statusCode).toBe(403)
    await grantAllPermissions()
  })

  it('denies disabled and quarantined module runtime access', async () => {
    await db.updateTable('greenfield_extension_installations').set({status: 'disabled'}).where('installation_id', '=', installationId).execute()
    const disabled = await app.inject({
      method: 'GET',
      url: `/v1/modules/${moduleId}/records/note`,
      headers: {authorization: `Bearer ${token}`},
    })
    expect(disabled.statusCode).toBe(403)

    await db.updateTable('greenfield_extension_installations').set({status: 'enabled'}).where('installation_id', '=', installationId).execute()
    await db.updateTable('greenfield_module_releases').set({release_state: 'quarantined'}).where('release_id', '=', releaseId).execute()
    const quarantined = await app.inject({
      method: 'GET',
      url: `/v1/modules/${moduleId}/records/note`,
      headers: {authorization: `Bearer ${token}`},
    })
    expect(quarantined.statusCode).toBe(403)
    await db.updateTable('greenfield_module_releases').set({release_state: 'published'}).where('release_id', '=', releaseId).execute()
  })

  it('validates module settings and keeps retained data visible after reinstall', async () => {
    const invalidSettings = await app.inject({
      method: 'PATCH',
      url: `/v1/modules/${moduleId}/settings`,
      headers: {authorization: `Bearer ${token}`},
      payload: {values: {unknownKey: true}},
    })
    expect(invalidSettings.statusCode).toBe(400)

    const created = await app.inject({
      method: 'POST',
      url: `/v1/modules/${moduleId}/records/note`,
      headers: {authorization: `Bearer ${token}`},
      payload: {data: {title: 'Retained', body: 'kept', tags: ['keep'], folderId: 'archive', sourceUri: 'https://modula.digital/post/3'}},
    })
    expect(created.statusCode).toBe(201)
    await db
      .updateTable('greenfield_extension_installations')
      .set({status: 'removed'})
      .where('installation_id', '=', installationId)
      .execute()
    await db
      .updateTable('greenfield_module_records')
      .set({retained_after_uninstall: true})
      .where('account_id', '=', accountId)
      .where('module_id', '=', moduleId)
      .execute()
    await db
      .updateTable('greenfield_extension_installations')
      .set({status: 'enabled'})
      .where('installation_id', '=', installationId)
      .execute()
    const restored = await app.inject({
      method: 'GET',
      url: `/v1/modules/${moduleId}/records/note?q=Retained`,
      headers: {authorization: `Bearer ${token}`},
    })
    expect(restored.statusCode).toBe(200)
    expect(restored.json().data.items.some((item: any) => item.record_id === created.json().data.record_id)).toBe(true)
  })

  async function registerAccount(email: string, handle: string) {
    const password = 'secure-pass-word-1'
    const register = await app.inject({
      method: 'POST',
      url: '/v1/accounts/register',
      payload: {email, password, handle, displayName: 'Module Runtime User', acceptedTerms: true, inviteCode: 'test-invite'},
    })
    expect(register.statusCode).toBe(201)
    await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token: register.json().data.verificationToken}})
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect(session.statusCode).toBe(200)
    return {accountId: register.json().data.accountId as string, token: session.json().data.accessToken as string}
  }

  async function seedModule(seedAccountId: string, seedModuleId: string) {
    const version = '0.2.0'
    const manifest = moduleManifest(seedModuleId, version)
    const imported = await new GreenfieldModuleReleaseService(db).importPendingReview(manifest)
    const published = await new GreenfieldModuleReleaseService(db).publishRelease(seedModuleId, version)
    releaseId = published.releaseId
    installationId = `test-installation:${seedModuleId}:${seedAccountId}`
    await db
      .insertInto('greenfield_module_record_collections')
      .values(collectionRow(published.releaseId, seedModuleId, noteCollection()))
      .execute()
    for (const view of moduleViews(seedModuleId)) {
      await db.insertInto('greenfield_module_views').values(viewRow(published.releaseId, seedModuleId, view)).execute()
      for (const action of view.toolbar ?? []) await db.insertInto('greenfield_module_actions').values(actionRow(published.releaseId, seedModuleId, action)).execute()
    }
    await db
      .insertInto('greenfield_extension_installations')
      .values({installation_id: installationId, extension_version_id: imported.extensionVersionId, account_id: seedAccountId, status: 'enabled', config: {}, created_at: new Date(), updated_at: new Date()})
      .execute()
    await grantAllPermissions()
    await db
      .insertInto('greenfield_module_installation_settings')
      .values({
        settings_id: `settings:${installationId}`,
        installation_id: installationId,
        module_id: seedModuleId,
        scope: 'installation',
        schema_version: 1,
        values: {defaultSort: 'updatedAt'},
        secret_refs: {},
        version: 1,
        updated_by: seedAccountId,
        updated_at: new Date(),
      })
      .execute()
  }

  async function grantAllPermissions() {
    await db
      .insertInto('greenfield_module_permission_reviews')
      .values({
        review_id: `review:${installationId}:${Date.now()}`,
        installation_id: installationId,
        release_id: releaseId,
        account_id: accountId,
        granted_permissions: [
          `records:module.${moduleId}.note:read`,
          `records:module.${moduleId}.note:write`,
          `records:module.${moduleId}.note:delete`,
        ],
        denied_permissions: [],
        high_risk_increase: false,
        idempotency_key: `review-${Date.now()}`,
        reviewed_at: new Date(),
      })
      .execute()
  }
})

function moduleManifest(moduleId: string, version: string): GreenfieldModuleManifestV1 {
  const manifest: GreenfieldModuleManifestV1 = {
    manifestVersion: 1,
    moduleId,
    name: 'Phase 7B Notes',
    description: 'Test module for Phase 7B runtime.',
    version,
    publisher: {publisherId: 'modula', displayName: 'Modula'},
    source: {
      provider: 'github',
      repository: 'modula-mod/modula-module-vault-notes',
      commit: '0123456789abcdef0123456789abcdef01234567',
      manifestPath: 'module.manifest.json',
    },
    license: {status: 'firstParty', evidenceIds: ['first-party-policy']},
    trust: {requestedLevel: 'firstParty'},
    compatibility: {
      minimumGreenfieldVersion: '0.1.0',
      minimumModulaHostVersion: '0.1.0',
      protocolVersions: ['greenfield.v1'],
      platforms: ['server', 'web', 'ios', 'android'],
    },
    permissions: [
      {permission: `records:module.${moduleId}.note:read`, reason: 'Read private notes', risk: 'low'},
      {permission: `records:module.${moduleId}.note:write`, reason: 'Write private notes', risk: 'medium'},
      {permission: `records:module.${moduleId}.note:delete`, reason: 'Delete private notes', risk: 'high'},
    ],
    contributions: {
      schemas: [{id: `${moduleId}.schemas.note`, title: 'Note schema', schemaRef: 'schemas/vault-note.v1.schema.json', collection: 'note', defaultVisibility: 'private'}],
      routes: [{id: `${moduleId}.routes.home`, title: 'Vault Notes', path: `/module/${moduleId}`, routeKind: 'module'}],
      settings: [{id: `${moduleId}.settings.installation`, title: 'Vault Notes settings', schemaRef: 'schemas/vault-settings.v1.schema.json', scope: 'installation'}],
    },
    extensions: {settingsDefaults: {defaultSort: 'updatedAt'}},
    integrity: {manifestSha256: 'a'.repeat(64), releaseSha256: 'b'.repeat(64)},
  }
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  return manifest
}

function noteCollection(): GreenfieldModuleCollectionDefinition {
  return {
    collection: 'note',
    schemaRef: 'schemas/vault-note.v1.schema.json',
    defaultVisibility: 'private',
    fields: [
      {fieldId: 'title', name: 'title', type: 'text', label: 'Title', required: true},
      {fieldId: 'body', name: 'body', type: 'multilineText', label: 'Body'},
      {fieldId: 'tags', name: 'tags', type: 'tags', label: 'Tags'},
      {fieldId: 'folderId', name: 'folderId', type: 'recordReference', label: 'Folder'},
      {fieldId: 'sourceUri', name: 'sourceUri', type: 'url', label: 'Source'},
    ],
    searchableFields: ['title', 'body', 'tags', 'sourceUri'],
    filterableFields: ['folderId'],
    sortableFields: ['createdAt', 'updatedAt', 'title'],
    folderField: 'folderId',
    retentionPolicy: 'keepOnUninstall',
  }
}

function moduleViews(moduleId: string): GreenfieldModuleView[] {
  const createAction: GreenfieldModuleAction = {
    actionId: `${moduleId}.actions.create-note`,
    kind: 'record.create',
    label: 'Create note',
    inputSchema: {fields: noteCollection().fields},
    capability: `records:module.${moduleId}.note:write`,
    confirmationPolicy: 'none',
    destructive: false,
    successDestination: {kind: 'view', viewId: `${moduleId}.views.note-detail`},
    errorPresentation: {kind: 'inline'},
    requiresIdempotencyKey: true,
    target: {collection: 'note'},
  }
  return [
    {
      viewId: `${moduleId}.views.note-list`,
      moduleId,
      kind: 'collection',
      title: 'Notes',
      collection: 'note',
      query: {
        collection: 'note',
        defaultLimit: 25,
        maxLimit: 50,
        allowedSortFields: ['createdAt', 'updatedAt', 'title'],
        allowedFilterFields: ['folderId'],
        searchableFields: ['title', 'body', 'tags', 'sourceUri'],
        folderField: 'folderId',
      },
      layout: [{id: 'notes', component: 'recordList', collection: 'note'}],
      toolbar: [createAction],
      emptyState: {title: 'No notes', actionId: createAction.actionId},
      requiredCapabilities: [`records:module.${moduleId}.note:read`],
    },
  ]
}

function collectionRow(releaseId: string, moduleId: string, collection: GreenfieldModuleCollectionDefinition) {
  return {
    collection_id: `collection:${releaseId}:${collection.collection}`,
    release_id: releaseId,
    module_id: moduleId,
    collection: collection.collection,
    schema_ref: collection.schemaRef,
    default_visibility: collection.defaultVisibility,
    fields: collection.fields,
    searchable_fields: collection.searchableFields,
    filterable_fields: collection.filterableFields,
    sortable_fields: collection.sortableFields,
    folder_field: collection.folderField ?? null,
    reference_fields: collection.referenceFields ?? [],
    schema_definition: {},
    retention_policy: collection.retentionPolicy ?? 'keepOnUninstall',
    registration_status: 'registered' as const,
    created_at: new Date(),
    updated_at: new Date(),
  }
}

function viewRow(releaseId: string, moduleId: string, view: GreenfieldModuleView) {
  return {
    view_id: `view:${releaseId}:${view.viewId}`,
    release_id: releaseId,
    module_id: moduleId,
    view_key: view.viewId,
    view_kind: view.kind,
    collection: view.collection ?? null,
    title: view.title,
    declaration: view,
    required_capabilities: view.requiredCapabilities,
    registration_status: 'registered' as const,
    created_at: new Date(),
    updated_at: new Date(),
  }
}

function actionRow(releaseId: string, moduleId: string, action: GreenfieldModuleAction) {
  return {
    action_row_id: `action:${releaseId}:${action.actionId}`,
    release_id: releaseId,
    module_id: moduleId,
    action_id: action.actionId,
    action_kind: action.kind,
    capability: action.capability,
    declaration: action,
    registration_status: 'registered' as const,
    created_at: new Date(),
    updated_at: new Date(),
  }
}
