import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {manifestChecksum, type GreenfieldModuleManifestV1} from '@modula/greenfield-module-manifest'
import {sql} from 'kysely'
import {loadConfig, type AppConfig} from '../src/config/env.js'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldAIProductActionService} from '../src/ai/product-action-service.js'
import {GreenfieldModuleInstallationService} from '../src/modules/installation-service.js'
import {GreenfieldModuleRecordService} from '../src/modules/record-service.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

const basePermissions = [
  'records:module.placeholder.note:read',
  'records:module.placeholder.note:write',
  'records:module.placeholder.note:delete',
]

const aiPermissions = [
  'ai.request',
  'ai.stream',
  'ai.structured-output',
  'ai.context.private',
]

describeIfDb('Phase 7E AI product actions', () => {
  let db: ModulaDb
  let config: AppConfig
  let records: GreenfieldModuleRecordService
  let productActions: GreenfieldAIProductActionService
  let installations: GreenfieldModuleInstallationService
  let accountId = ''
  let otherAccountId = ''
  let moduleId = ''
  let version = ''
  let installationId = ''
  let otherInstallationId = ''
  let releaseId = ''
  const suffix = randomUUID().slice(0, 8)

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    config = loadConfig()
    records = new GreenfieldModuleRecordService(db, config)
    productActions = new GreenfieldAIProductActionService(db, config)
    installations = new GreenfieldModuleInstallationService(db, config)
    accountId = `ai-product-account-${suffix}`
    otherAccountId = `ai-product-other-${suffix}`
    moduleId = `digital.modula.vault-notes-ai-${suffix}`
    version = `1.1.${Date.now() % 1_000_000}`
    await seedProfileAccount(db, accountId, `actor-${accountId}`, `aip${suffix}`.slice(0, 24))
    await seedProfileAccount(db, otherAccountId, `actor-${otherAccountId}`, `aipo${suffix}`.slice(0, 24))
    await seedModuleRelease()
    await seedInstallation(accountId, false)
    await seedInstallation(otherAccountId, true)
  })

  afterAll(async () => {
    await db?.destroy()
  })

  it('keeps Vault Notes usable without AI grants and blocks product AI until review grants them', async () => {
    const note = await records.create(accountId, moduleId, 'note', {data: noteData('No AI grant', `private setup phrase ${suffix}`), mutationId: `ai-note-no-grant:${suffix}`})
    expect(note.revision).toBe(1)

    await expect(productActions.execute(accountId, moduleId, 'vault-notes.ai.suggest-title', {
      recordId: note.record_id,
      expectedRevision: note.revision,
      idempotencyKey: `ai-denied-${suffix}`,
    })).rejects.toMatchObject({code: 'AI_ACTION_PERMISSION_REQUIRED'})

    await installations.reviewPermissions(accountId, moduleId, {
      approvedPermissions: grantedPermissions(moduleId, true),
      idempotencyKey: `grant-ai-${suffix}`,
    })
  })

  it('executes, previews and explicitly applies a declared action without leaking note content into audits or events', async () => {
    const phrase = `private leak sentinel ${suffix}`
    const note = await records.create(accountId, moduleId, 'note', {data: noteData('AI title source', phrase), mutationId: `ai-note-title:${suffix}`})
    const execution = await productActions.execute(accountId, moduleId, 'vault-notes.ai.suggest-title', {
      recordId: note.record_id,
      expectedRevision: note.revision,
      idempotencyKey: `ai-title-${suffix}`,
    })
    expect(execution.status).toBe('completed')
    expect(execution.result).toMatchObject({primary: expect.any(String), alternatives: expect.any(Array)})
    const unchanged = await records.get(accountId, moduleId, 'note', note.record_id)
    expect(unchanged.revision).toBe(1)
    expect((unchanged.data as Record<string, unknown>).title).toBe('AI title source')

    await expect(productActions.apply(otherAccountId, moduleId, execution.executionId, {
      recordId: note.record_id,
      expectedRevision: note.revision,
      selectedResult: execution.result,
      idempotencyKey: `cross-apply-${suffix}`,
    })).rejects.toMatchObject({code: 'AI_RESULT_OWNERSHIP_MISMATCH'})

    const applied = await productActions.apply(accountId, moduleId, execution.executionId, {
      recordId: note.record_id,
      expectedRevision: note.revision,
      selectedResult: execution.result,
      idempotencyKey: `apply-title-${suffix}`,
    })
    expect(applied.status).toBe('applied')
    expect(applied.revision).toBe(2)
    await expect(productActions.apply(accountId, moduleId, execution.executionId, {
      recordId: note.record_id,
      expectedRevision: applied.revision,
      selectedResult: execution.result,
      idempotencyKey: `apply-title-again-${suffix}`,
    })).rejects.toMatchObject({code: 'AI_RESULT_ALREADY_APPLIED'})

    const version = await db
      .selectFrom('greenfield_module_record_revisions')
      .selectAll()
      .where('record_id', '=', note.record_id)
      .where('revision', '=', 2)
      .executeTakeFirstOrThrow()
    expect(version).toMatchObject({operation: 'update', base_revision: 1})
    expect(version.mutation_id).toMatch(/^ai-product-/)

    const eventPayloads = await db
      .selectFrom('greenfield_domain_events')
      .select(['event_type', 'payload', 'metadata'])
      .where('account_id', '=', accountId)
      .where(eb => eb.or([
        eb('event_type', 'like', 'ai.product-action.%'),
        eb('event_type', 'like', 'vault-notes.%'),
      ]))
      .execute()
    const audits = await db
      .selectFrom('audit_events')
      .select(['action', 'metadata'])
      .where('account_id', '=', accountId)
      .execute()
    expect(JSON.stringify(eventPayloads)).not.toContain(phrase)
    expect(JSON.stringify(audits)).not.toContain(phrase)
  })

  it('rejects stale AI application after a normal note edit changes the source revision', async () => {
    const note = await records.create(accountId, moduleId, 'note', {data: noteData('Stale source', `stale source phrase ${suffix}`), mutationId: `ai-note-stale:${suffix}`})
    const execution = await productActions.execute(accountId, moduleId, 'vault-notes.ai.suggest-title', {
      recordId: note.record_id,
      expectedRevision: note.revision,
      idempotencyKey: `ai-stale-${suffix}`,
    })
    await records.patch(accountId, moduleId, 'note', note.record_id, {
      data: {title: 'Manual edit', updatedAt: new Date().toISOString()},
      expectedRevision: note.revision,
      mutationId: `ai-note-stale-edit:${suffix}`,
    })
    await expect(productActions.apply(accountId, moduleId, execution.executionId, {
      recordId: note.record_id,
      expectedRevision: note.revision,
      selectedResult: execution.result,
      idempotencyKey: `apply-stale-${suffix}`,
    })).rejects.toMatchObject({code: 'NOTE_REVISION_CONFLICT'})
  })

  async function seedModuleRelease() {
    const manifest = moduleManifest(moduleId, version)
    const imported = await new GreenfieldModuleReleaseService(db).importPendingReview(manifest)
    const published = await new GreenfieldModuleReleaseService(db).publishRelease(moduleId, version)
    releaseId = published.releaseId
    await db
      .insertInto('greenfield_module_record_collections')
      .values({
        collection_id: `ai-product-note:${imported.releaseId}`,
        release_id: published.releaseId,
        module_id: moduleId,
        collection: 'note',
        schema_ref: 'schemas/note.schema.json',
        default_visibility: 'private',
        fields: jsonb(noteFields()),
        searchable_fields: jsonb(['title', 'plainTextProjection', 'tagIds']),
        filterable_fields: jsonb(['folderId', 'tagIds', 'archived']),
        sortable_fields: jsonb(['title', 'updatedAt', 'createdAt']),
        folder_field: 'folderId',
        reference_fields: jsonb(['folderId', 'tagIds']),
        schema_definition: jsonb({type: 'object'}),
        retention_policy: 'keepOnUninstall',
        registration_status: 'registered',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()
  }

  async function seedInstallation(account: string, withAi: boolean) {
    const id = `installation:${moduleId}:${account}`
    await db
      .insertInto('greenfield_extension_installations')
      .values({
        installation_id: id,
        extension_version_id: `${moduleId}@${version}`,
        account_id: account,
        status: 'enabled',
        config: {},
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()
    await db
      .insertInto('greenfield_module_permission_reviews')
      .values({
        review_id: `review:${id}`,
        installation_id: id,
        release_id: releaseId,
        account_id: account,
        granted_permissions: jsonb(grantedPermissions(moduleId, withAi)),
        denied_permissions: jsonb(withAi ? [] : aiPermissions),
        high_risk_increase: withAi,
        idempotency_key: `review:${id}`,
        reviewed_at: new Date(),
      })
      .execute()
    if (account === accountId) installationId = id
    if (account === otherAccountId) otherInstallationId = id
  }
})

function configureTestEnv(): void {
  process.env.NODE_ENV = 'test'
  process.env.MODULA_ENVIRONMENT = 'development'
  process.env.GREENFIELD_MODULE_ALLOW_UNTRUSTED_DEVELOPMENT_RELEASES = 'true'
  process.env.MODULA_API_HOST = '127.0.0.1'
  process.env.MODULA_API_PORT = '4034'
  process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4034'
  process.env.MODULA_DATABASE_URL = databaseUrl!
  process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
  process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
  process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
  process.env.GREENFIELD_AI_GATEWAY_ENABLED = 'true'
  process.env.GREENFIELD_MODULE_REGISTRY_ENABLED = 'true'
  process.env.GREENFIELD_MODULE_INSTALLATION_ENABLED = 'true'
  process.env.GREENFIELD_MODULE_DECLARATIVE_CONTRIBUTIONS_ENABLED = 'true'
}

function moduleManifest(moduleId: string, version: string): GreenfieldModuleManifestV1 {
  const manifest = {
    manifestVersion: 1,
    moduleId,
    name: 'Vault Notes AI Product Test',
    description: 'First-party Vault Notes fixture for AI product action integration tests.',
    version,
    publisher: {publisherId: 'modula', displayName: 'Modula'},
    source: {
      provider: 'github',
      repository: 'modula-mod/modula-vault-notes',
      commit: '0123456789abcdef0123456789abcdef01234567',
      manifestPath: 'module.manifest.json',
      releaseTag: 'vault-notes-v1.1.0',
    },
    license: {status: 'firstParty', evidenceIds: ['first-party-policy']},
    trust: {requestedLevel: 'firstParty'},
    compatibility: {
      minimumGreenfieldVersion: '0.1.0',
      minimumModulaHostVersion: '0.1.0',
      protocolVersions: ['greenfield.v1'],
      platforms: ['server'],
    },
    permissions: grantedPermissions(moduleId, true).map(permission => ({permission, reason: `Verify ${permission} boundary`})),
    contributions: {
      schemas: [{
        id: `${moduleId}.schemas.note`,
        title: 'Vault Notes AI note schema',
        schemaRef: 'schemas/note.schema.json',
        collection: 'note',
        defaultVisibility: 'private',
      }],
    },
    ai: {
      features: ['summarise', 'extract', 'generate'],
      prompts: ['vault-notes.suggest-title.v1'],
      requiredCapabilities: ['text-generation', 'streaming', 'structured-output'],
      dataAccess: {recordScopes: [`${moduleId}.note`], defaultPolicy: 'account-consent'},
      productActions: [{
        id: 'vault-notes.ai.suggest-title',
        name: 'Suggest title',
        description: 'Suggest a title for one authorised Vault Note revision.',
        promptId: 'vault-notes.suggest-title.v1',
        promptVersionRange: '^1.0.0',
        inputSchema: 'schemas/ai/suggest-title-input.schema.json',
        outputSchema: 'schemas/ai/suggested-title-result.schema.json',
        requiredPermissions: aiPermissions,
        requiredCapabilities: ['text-generation', 'streaming', 'structured-output'],
        context: {
          sources: ['current-record', 'record-metadata'],
          maximumRecords: 1,
          maximumCharacters: 20_000,
          allowedClassifications: ['private'],
        },
        execution: {streaming: true, structuredOutput: true, maximumToolCalls: 0, timeoutMs: 30_000},
        application: {mode: 'metadata-suggestion', explicitConfirmation: true, createsRecordRevision: true},
      }],
    },
    integrity: {manifestSha256: 'a'.repeat(64)},
  } satisfies GreenfieldModuleManifestV1
  return {
    ...manifest,
    integrity: {
      manifestSha256: manifestChecksum({...manifest, integrity: {manifestSha256: ''}}),
    },
  }
}

function grantedPermissions(moduleId: string, withAi: boolean): string[] {
  const recordPermissions = basePermissions.map(permission => permission.replace('module.placeholder', `module.${moduleId}`))
  return withAi ? [...recordPermissions, ...aiPermissions] : recordPermissions
}

function noteFields() {
  return [
    {fieldId: 'title', name: 'title', type: 'text', label: 'Title', required: true},
    {fieldId: 'document', name: 'document', type: 'json', label: 'Document', required: true},
    {fieldId: 'plainTextProjection', name: 'plainTextProjection', type: 'multilineText', label: 'Plain text', required: true},
    {fieldId: 'folderId', name: 'folderId', type: 'text', label: 'Folder'},
    {fieldId: 'tagIds', name: 'tagIds', type: 'tags', label: 'Tags'},
    {fieldId: 'pinned', name: 'pinned', type: 'boolean', label: 'Pinned'},
    {fieldId: 'favourite', name: 'favourite', type: 'boolean', label: 'Favourite'},
    {fieldId: 'archived', name: 'archived', type: 'boolean', label: 'Archived'},
    {fieldId: 'dataSchemaVersion', name: 'dataSchemaVersion', type: 'text', label: 'Data schema', required: true},
    {fieldId: 'createdAt', name: 'createdAt', type: 'dateTime', label: 'Created'},
    {fieldId: 'updatedAt', name: 'updatedAt', type: 'dateTime', label: 'Updated'},
  ]
}

function noteData(title: string, text: string): Record<string, unknown> {
  const now = new Date().toISOString()
  return {
    title,
    document: {schemaVersion: '1.0.0', blocks: [{id: `block-${randomUUID()}`, type: 'paragraph', text}]},
    plainTextProjection: text,
    folderId: 'inbox',
    tagIds: [],
    pinned: false,
    favourite: false,
    archived: false,
    dataSchemaVersion: '1.0.0',
    createdAt: now,
    updatedAt: now,
  }
}

async function seedProfileAccount(db: ModulaDb, accountId: string, actorId: string, handle: string): Promise<void> {
  const now = new Date()
  await db
    .insertInto('greenfield_accounts')
    .values({account_id: accountId, primary_handle: handle, status: 'active', created_at: now, updated_at: now})
    .execute()
  await db
    .insertInto('actors')
    .values({id: actorId, account_id: accountId, kind: 'person', created_at: now, updated_at: now, deleted_at: null, version: 1})
    .execute()
  await db
    .insertInto('profiles')
    .values({
      id: `profile-${actorId}`,
      actor_id: actorId,
      handle,
      display_name: 'Phase 7E AI Product Actions',
      kind: 'person',
      bio: '',
      avatar_url: null,
      cover_url: null,
      cover_colour: null,
      pronouns: null,
      location_label: null,
      location_visibility: null,
      website_label: null,
      website_url: null,
      website_domain: null,
      website_visibility: null,
      focus_status_id: 'available',
      focus_status_label: 'Available',
      focus_status_message: '',
      focus_status_updated_at: now,
      visibility: 'public',
      module_count: 0,
      featured_module_ids: [],
      identity_claims: {},
      joined_at: now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
    })
    .execute()
}
