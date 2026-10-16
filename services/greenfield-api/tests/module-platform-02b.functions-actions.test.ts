import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql, type Kysely} from 'kysely'
import {
  governedFunctionInvokeCapability,
  interModuleRequestCapability,
} from '@modula/greenfield-contracts'
import {
  manifestChecksum,
  type GreenfieldModuleManifestV1,
} from '@modula/greenfield-module-manifest'
import type {GreenfieldModuleCollectionDefinition} from '@modula/greenfield-module-ui-contracts'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import type {Database} from '../src/database/types.js'
import {advanceActionLineage, GreenfieldInterModuleActionService} from '../src/modules/inter-module-action-service.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIf = databaseUrl ? describe : describe.skip
const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

describe('inter-module action lineage budgets', () => {
  it('detects cycles and refuses stale or forged chains', () => {
    const startedAt = new Date('2026-10-14T12:00:00.000Z')
    const first = advanceActionLineage(undefined, 'test.modula.alpha', 'test.modula.beta', startedAt)
    expect(first).toMatchObject({modules: ['test.modula.alpha', 'test.modula.beta'], actionCount: 1})
    expect(() => advanceActionLineage(first, 'test.modula.beta', 'test.modula.alpha', startedAt)).toThrow(/cycle detected/)
    expect(() => advanceActionLineage({...first, actionCount: 0}, 'test.modula.beta', 'test.modula.gamma', startedAt)).toThrow(/count is invalid/)
    expect(() => advanceActionLineage(first, 'test.modula.beta', 'test.modula.gamma', new Date(startedAt.getTime() + 30_001))).toThrow(/budget was exceeded/)
  })
})

describeIf('MODULE-PLATFORM-02B governed functions and inter-module actions', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let config: ReturnType<typeof loadConfig>
  let token = ''
  let accountId = ''
  let alpha: ModuleFixture
  let beta: ModuleFixture
  let runtimeCredential = ''
  const suffix = Date.now().toString(36)
  const alphaId = `audit.module.alpha-${suffix}`
  const betaId = `audit.module.beta-${suffix}`

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.GREENFIELD_MODULE_ALLOW_UNTRUSTED_DEVELOPMENT_RELEASES = 'true'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4027'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4027'
    process.env.MODULA_DATABASE_URL = databaseUrl!
    process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
    process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
    process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
    process.env.MODULA_INVITE_ONLY = 'true'
    process.env.MODULA_REGISTRATION_INVITE_CODES = 'test-invite'
    process.env.MODULA_ATPROTO_ENABLED = 'false'
    process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
    process.env.MODULA_CHECKPOINT_SIGNING_KEY = 'mp02b-functions-actions-test-key'
    await migrateUp(databaseUrl!)
    config = loadConfig()
    const created = await createServer(config)
    app = created.app
    db = created.db
    await app.ready()
    const account = await registerAccount(`mp02b-functions-${suffix}@example.com`, `mp02bfn${suffix}`.slice(0, 20))
    token = account.token
    accountId = account.accountId
    beta = await seedBeta(db, accountId, betaId, alphaId)
    alpha = await seedAlpha(db, accountId, alphaId, betaId)
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('enforces exact declarations, schemas, grants, implementation review and mutating idempotency', async () => {
    const valid = await authenticated('POST', `/v1/modules/${alphaId}/functions/echo/1.0.0/invoke`, {
      mutationId: 'echo-once', input: {message: 'governed'},
    })
    expect(valid.statusCode).toBe(200)
    expect(valid.json().data).toMatchObject({idempotent: false, status: 'completed', output: {message: 'governed'}})

    const replay = await authenticated('POST', `/v1/modules/${alphaId}/functions/echo/1.0.0/invoke`, {
      mutationId: 'echo-once', input: {message: 'governed'},
    })
    expect(replay.statusCode).toBe(200)
    expect(replay.json().data).toMatchObject({idempotent: true, output: {message: 'governed'}})
    expect(await functionMutationCount('echo-once')).toBe(1)

    const reused = await authenticated('POST', `/v1/modules/${alphaId}/functions/echo/1.0.0/invoke`, {
      mutationId: 'echo-once', input: {message: 'different'},
    })
    expect(reused.statusCode).toBe(409)
    expect(reused.json().error.code).toBe('MUTATION_REUSE_CONFLICT')

    const invalid = await authenticated('POST', `/v1/modules/${alphaId}/functions/echo/1.0.0/invoke`, {
      mutationId: 'echo-invalid', input: {wrong: true},
    })
    expect(invalid.statusCode).toBe(400)
    expect(invalid.json().error.code).toBe('VALIDATION_FAILED')

    const undeclared = await authenticated('POST', `/v1/modules/${alphaId}/functions/missing/1.0.0/invoke`, {input: {}})
    expect(undeclared.statusCode).toBe(404)
    expect(undeclared.json().error.code).toBe('FUNCTION_NOT_AVAILABLE')

    await setAlphaPermissions([])
    const denied = await authenticated('POST', `/v1/modules/${alphaId}/functions/echo/1.0.0/invoke`, {
      mutationId: 'echo-denied', input: {message: 'denied'},
    })
    expect(denied.statusCode).toBe(403)
    expect(denied.json().error.code).toBe('MODULE_PERMISSION_DENIED')
    await setAlphaPermissions(alpha.permissions)

    const community = await authenticated('POST', `/v1/modules/${alphaId}/functions/community/1.0.0/invoke`, {input: {message: 'never run'}})
    expect(community.statusCode).toBe(404)
    expect(community.json().error.code).toBe('FUNCTION_NOT_AVAILABLE')
    expect(community.json().error.message).toContain('no fallback')

    const remote = await authenticated('POST', `/v1/modules/${alphaId}/functions/remote/1.0.0/invoke`, {input: {message: 'never transmit'}})
    expect(remote.statusCode).toBe(403)
    expect(remote.json().error.code).toBe('CAPABILITY_DISABLED')

    await db.updateTable('greenfield_module_permission_reviews').set({installation_id: null})
      .where('review_id', '=', alpha.reviewId).execute()
    const missingReview = await authenticated('POST', `/v1/modules/${alphaId}/functions/echo/1.0.0/invoke`, {
      mutationId: 'echo-missing-review', input: {message: 'denied'},
    })
    expect(missingReview.statusCode).toBe(403)
    expect(missingReview.json().error.code).toBe('PERMISSION_REVIEW_REQUIRED')
    await db.updateTable('greenfield_module_permission_reviews').set({installation_id: alpha.installationId})
      .where('review_id', '=', alpha.reviewId).execute()

    const ledger = await db.selectFrom('greenfield_function_invocations').selectAll()
      .where('account_id', '=', accountId).where('function_id', '=', 'echo').where('status', '=', 'completed').execute()
    expect(ledger).toHaveLength(1)
    expect(JSON.stringify(ledger)).not.toContain('governed')
  })

  it('runs the host request lifecycle without fallback and rejects invalid or duplicate completion', async () => {
    const unavailable = await authenticated('POST', `/v1/modules/${alphaId}/functions/host-pick/1.0.0/invoke`, {input: {prompt: 'Pick safely'}})
    expect(unavailable.statusCode).toBe(503)
    expect(unavailable.json().error.code).toBe('CAPABILITY_UNAVAILABLE')
    const unavailableRow = await db.selectFrom('greenfield_host_function_requests').select(['state'])
      .where('module_id', '=', alphaId).where('function_id', '=', 'host-pick').orderBy('created_at', 'desc').executeTakeFirstOrThrow()
    expect(unavailableRow.state).toBe('host_unavailable')

    const executor = await authenticated('POST', `/v1/modules/${alphaId}/host-function-executors`, {
      executorId: `executor-${suffix}`,
      capabilities: [{functionId: 'host-pick', version: '1.0.0', contractVersion: '1.0.0', available: true, provider: 'test-host'}],
      ttlSeconds: 300,
    })
    expect(executor.statusCode).toBe(201)

    const invoked = await authenticated('POST', `/v1/modules/${alphaId}/functions/host-pick/1.0.0/invoke`, {input: {prompt: 'Pick safely'}})
    expect(invoked.statusCode).toBe(200)
    expect(invoked.json().data.status).toBe('dispatched')
    const requestId = invoked.json().data.requestId as string

    const pending = await authenticated('GET', `/v1/modules/${alphaId}/host-function-executors/executor-${suffix}/requests`)
    expect(pending.statusCode).toBe(200)
    expect(pending.json().data.requests).toContainEqual(expect.objectContaining({requestId, state: 'dispatched'}))

    const invalidOutput = await authenticated('POST', `/v1/modules/${alphaId}/host-function-requests/${requestId}/complete`, {output: {wrong: true}})
    expect(invalidOutput.statusCode).toBe(400)
    expect(invalidOutput.json().error.code).toBe('VALIDATION_FAILED')

    const completed = await authenticated('POST', `/v1/modules/${alphaId}/host-function-requests/${requestId}/complete`, {output: {accepted: true}})
    expect(completed.statusCode).toBe(200)
    expect(completed.json().data.state).toBe('completed')

    const duplicate = await authenticated('POST', `/v1/modules/${alphaId}/host-function-requests/${requestId}/complete`, {output: {accepted: true}})
    expect(duplicate.statusCode).toBe(200)
    expect(duplicate.json().data.idempotent).toBe(true)

    const conflicting = await authenticated('POST', `/v1/modules/${alphaId}/host-function-requests/${requestId}/complete`, {output: {accepted: false}})
    expect(conflicting.statusCode).toBe(409)
    expect(conflicting.json().error.code).toBe('CONFLICT')

    const cancellable = await authenticated('POST', `/v1/modules/${alphaId}/functions/host-pick/1.0.0/invoke`, {input: {prompt: 'Cancel me'}})
    const cancelled = await authenticated('POST', `/v1/modules/${alphaId}/host-function-requests/${cancellable.json().data.requestId}/cancel`)
    expect(cancelled.statusCode).toBe(200)
    expect(cancelled.json().data.state).toBe('cancelled')

    const expiring = await authenticated('POST', `/v1/modules/${alphaId}/functions/host-pick/1.0.0/invoke`, {input: {prompt: 'Expire me'}})
    const expiringId = expiring.json().data.requestId as string
    await db.updateTable('greenfield_host_function_requests').set({deadline_at: new Date(Date.now() - 1_000)})
      .where('request_id', '=', expiringId).execute()
    const expired = await authenticated('GET', `/v1/modules/${alphaId}/host-function-requests/${expiringId}`)
    expect(expired.statusCode).toBe(200)
    expect(expired.json().data.state).toBe('timed_out')

    const unloading = await authenticated('POST', `/v1/modules/${alphaId}/functions/host-pick/1.0.0/invoke`, {input: {prompt: 'Unload me'}})
    const unloadingId = unloading.json().data.requestId as string
    await db.updateTable('greenfield_extension_installations').set({status: 'disabled', updated_at: new Date()})
      .where('installation_id', '=', alpha.installationId).execute()
    const unloaded = await authenticated('POST', `/v1/modules/${alphaId}/host-function-requests/${unloadingId}/complete`, {output: {accepted: true}})
    expect(unloaded.statusCode).toBe(403)
    expect(unloaded.json().error.code).toBe('CAPABILITY_DISABLED')
    const unloadedRow = await db.selectFrom('greenfield_host_function_requests').select('state')
      .where('request_id', '=', unloadingId).executeTakeFirstOrThrow()
    expect(unloadedRow.state).toBe('module_unloaded')
    await db.updateTable('greenfield_extension_installations').set({status: 'enabled', updated_at: new Date()})
      .where('installation_id', '=', alpha.installationId).execute()
  })

  it('derives Alpha from a runtime credential and lets Beta own one idempotent write', async () => {
    const issued = await authenticated('POST', `/v1/modules/${alphaId}/runtime-credentials`, {ttlSeconds: 300})
    expect(issued.statusCode).toBe(201)
    runtimeCredential = issued.json().data.credential

    const payload = {mutationId: 'alpha-to-beta-once', input: {recordId: `beta-task-${suffix}`, title: 'Created by Beta'}}
    const created = await runtimeAction(payload)
    expect(created.statusCode).toBe(200)
    expect(created.json().data.result).toEqual({
      record: {moduleId: betaId, recordType: 'task', recordId: `beta-task-${suffix}`}, revision: 1,
    })

    const replay = await runtimeAction(payload)
    expect(replay.statusCode).toBe(200)
    expect(replay.json().data.idempotent).toBe(true)
    expect(await betaRecordCount(`beta-task-${suffix}`)).toBe(1)

    const revision = await db.selectFrom('greenfield_module_record_revisions').select(['actor_id'])
      .where('module_id', '=', betaId).where('record_id', '=', `beta-task-${suffix}`).executeTakeFirstOrThrow()
    expect(revision.actor_id).toBe(`module:${alphaId}:${alpha.installationId}`)
    expect(alpha.permissions).not.toContain(`records:module.${betaId}.task:write`)
    expect(alpha.permissions).toContain(interModuleRequestCapability(betaId, 'create-task', '1.0.0'))

    await setAlphaPermissions(alpha.permissions.filter(permission => permission !== interModuleRequestCapability(betaId, 'create-task', '1.0.0')))
    const denied = await runtimeAction({mutationId: 'alpha-to-beta-denied', input: {recordId: `denied-${suffix}`, title: 'Denied'}})
    expect(denied.statusCode).toBe(403)
    expect(denied.json().error.code).toBe('MODULE_PERMISSION_DENIED')
    expect(await betaRecordCount(`denied-${suffix}`)).toBe(0)
    await setAlphaPermissions(alpha.permissions)
  })

  it('rolls target state back when failure is injected after the Beta write but before the action ledger', async () => {
    const recordId = `rollback-${suffix}`
    const service = new GreenfieldInterModuleActionService(db, config, {
      afterTargetWrite: async () => { throw Object.assign(new Error('injected after target write'), {code: 'INJECTED_FAILURE'}) },
    })
    await expect(service.request(
      runtimeCredential,
      {targetModuleId: betaId, actionId: 'create-task', version: '1.0.0'},
      {recordId, title: 'Must roll back'},
      {mutationId: 'alpha-to-beta-rollback', requestId: 'failure-injection'},
    )).rejects.toThrow('injected after target write')

    expect(await betaRecordCount(recordId)).toBe(0)
    const revisions = await db.selectFrom('greenfield_module_record_revisions').select(({fn}) => fn.countAll<number>().as('count'))
      .where('module_id', '=', betaId).where('record_id', '=', recordId).executeTakeFirstOrThrow()
    expect(Number(revisions.count)).toBe(0)
    const mutations = await db.selectFrom('greenfield_module_record_mutations').select(({fn}) => fn.countAll<number>().as('count'))
      .where('module_id', '=', betaId).where('record_id', '=', recordId).executeTakeFirstOrThrow()
    expect(Number(mutations.count)).toBe(0)
    const failed = await db.selectFrom('greenfield_inter_module_action_requests').select(['status', 'result'])
      .where('mutation_id', '=', 'alpha-to-beta-rollback').executeTakeFirstOrThrow()
    expect(failed.status).toBe('failed')
    expect(failed.result).toEqual({errorCode: 'INJECTED_FAILURE'})
  })

  async function registerAccount(email: string, handle: string) {
    const password = 'secure-pass-word-1'
    const register = await app.inject({method: 'POST', url: '/v1/accounts/register', payload: {
      email, password, handle, displayName: 'MP02B Functions User', acceptedTerms: true, inviteCode: 'test-invite',
    }})
    expect(register.statusCode).toBe(201)
    await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token: register.json().data.verificationToken}})
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect(session.statusCode).toBe(200)
    return {accountId: register.json().data.accountId as string, token: session.json().data.accessToken as string}
  }

  function authenticated(method: 'GET' | 'POST' | 'DELETE', url: string, payload?: unknown) {
    return app.inject({method, url, headers: {authorization: `Bearer ${token}`}, payload})
  }

  function runtimeAction(payload: unknown) {
    return app.inject({
      method: 'POST', url: `/v1/module-runtime/actions/${betaId}/create-task/1.0.0`,
      headers: {'x-modula-runtime-credential': runtimeCredential}, payload,
    })
  }

  async function functionMutationCount(mutationId: string) {
    const row = await db.selectFrom('greenfield_function_mutations').select(({fn}) => fn.countAll<number>().as('count'))
      .where('installation_id', '=', alpha.installationId).where('mutation_id', '=', mutationId).executeTakeFirstOrThrow()
    return Number(row.count)
  }

  async function betaRecordCount(recordId: string) {
    const row = await db.selectFrom('greenfield_module_records').select(({fn}) => fn.countAll<number>().as('count'))
      .where('account_id', '=', accountId).where('module_id', '=', betaId).where('record_id', '=', recordId).executeTakeFirstOrThrow()
    return Number(row.count)
  }

  async function setAlphaPermissions(permissions: string[]) {
    await db.updateTable('greenfield_module_permission_reviews').set({granted_permissions: jsonb(permissions), reviewed_at: new Date()})
      .where('review_id', '=', alpha.reviewId).execute()
  }
})

type ModuleFixture = {
  moduleId: string
  releaseId: string
  installationId: string
  reviewId: string
  permissions: string[]
}

async function seedAlpha(db: Kysely<Database>, accountId: string, moduleId: string, betaId: string): Promise<ModuleFixture> {
  const permissions = [
    governedFunctionInvokeCapability(moduleId, 'echo'),
    governedFunctionInvokeCapability(moduleId, 'host-pick'),
    governedFunctionInvokeCapability(moduleId, 'community'),
    governedFunctionInvokeCapability(moduleId, 'remote'),
    interModuleRequestCapability(betaId, 'create-task', '1.0.0'),
  ]
  const manifest = baseManifest(moduleId, permissions)
  manifest.contributions.functions = [
    {
      id: `${moduleId}.functions.echo`, title: 'Echo', functionId: 'echo', version: '1.0.0',
      inputSchema: objectSchema({message: {type: 'string'}}, ['message']),
      outputSchema: objectSchema({message: {type: 'string'}}, ['message']),
      requiredCapabilities: [], executionMode: 'server', mutating: true, timeoutMs: 5_000, executionRequired: true,
    },
    {
      id: `${moduleId}.functions.host-pick`, title: 'Host Pick', functionId: 'host-pick', version: '1.0.0',
      inputSchema: objectSchema({prompt: {type: 'string'}}, ['prompt']),
      outputSchema: objectSchema({accepted: {type: 'boolean'}}, ['accepted']),
      requiredCapabilities: [], executionMode: 'host', mutating: false, timeoutMs: 5_000, executionRequired: true,
    },
    {
      id: `${moduleId}.functions.community`, title: 'Community Unsupported', functionId: 'community', version: '1.0.0',
      inputSchema: objectSchema({message: {type: 'string'}}, ['message']), outputSchema: objectSchema({}, []),
      requiredCapabilities: [], executionMode: 'community', mutating: false, timeoutMs: 5_000, executionRequired: true,
    },
    {
      id: `${moduleId}.functions.remote`, title: 'Remote Denied', functionId: 'remote', version: '1.0.0',
      inputSchema: objectSchema({message: {type: 'string'}}, ['message']), outputSchema: objectSchema({}, []),
      requiredCapabilities: [], executionMode: 'remote', mutating: false, timeoutMs: 5_000, executionRequired: true,
    },
  ]
  const fixture = await installModule(db, accountId, manifest, permissions)
  await db.insertInto('greenfield_function_implementations').values({
    implementation_id: `implementation:${fixture.releaseId}:echo`, release_id: fixture.releaseId,
    function_id: 'echo', function_version: '1.0.0', execution_mode: 'server', handler_key: 'platform.echo', endpoint_url: null,
    reviewed: true, enabled: true, network_allowed: false, created_at: new Date(), updated_at: new Date(),
  }).execute()
  return fixture
}

async function seedBeta(db: Kysely<Database>, accountId: string, moduleId: string, alphaId: string): Promise<ModuleFixture> {
  const collection = betaCollection()
  const writePermission = `records:module.${moduleId}.task:write`
  const permissions = [writePermission, `records:module.${moduleId}.task:read`, `records:module.${moduleId}.task:delete`]
  const manifest = baseManifest(moduleId, permissions)
  manifest.contributions.schemas = [{
    id: `${moduleId}.schemas.task`, title: 'Task', schemaRef: collection.schemaRef,
    collection: 'task', defaultVisibility: 'private',
  }]
  manifest.contributions.interModuleActions = [{
    id: `${moduleId}.actions.create-task`, title: 'Create Task', actionId: 'create-task', version: '1.0.0',
    inputSchema: objectSchema({recordId: {type: 'string'}, title: {type: 'string'}}, ['recordId', 'title']),
    outputSchema: objectSchema({
      record: objectSchema({moduleId: {type: 'string'}, recordType: {type: 'string'}, recordId: {type: 'string'}}, ['moduleId', 'recordType', 'recordId']),
      revision: {type: 'integer'},
    }, ['record', 'revision']),
    requiredCapabilities: [writePermission], allowedSourceModules: [alphaId],
    execution: {kind: 'record.create', collection: 'task'}, mutating: true, executionRequired: true,
  }]
  const fixture = await installModule(db, accountId, manifest, permissions)
  await db.insertInto('greenfield_module_record_collections').values({
    collection_id: `collection:${fixture.releaseId}:task`, release_id: fixture.releaseId, module_id: moduleId,
    collection: 'task', schema_ref: collection.schemaRef, default_visibility: 'private',
    fields: jsonb(collection.fields), searchable_fields: jsonb(collection.searchableFields),
    filterable_fields: jsonb(collection.filterableFields), sortable_fields: jsonb(collection.sortableFields),
    folder_field: null, reference_fields: jsonb([]), schema_definition: jsonb({}),
    retention_policy: 'keepOnUninstall', registration_status: 'registered', created_at: new Date(), updated_at: new Date(),
  }).execute()
  return fixture
}

async function installModule(db: Kysely<Database>, accountId: string, manifest: GreenfieldModuleManifestV1, permissions: string[]): Promise<ModuleFixture> {
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  const releases = new GreenfieldModuleReleaseService(db)
  const imported = await releases.importPendingReview(manifest)
  const published = await releases.publishRelease(manifest.moduleId, manifest.version)
  const installationId = `mp02b-installation:${manifest.moduleId}:${accountId}`
  const reviewId = `mp02b-review:${manifest.moduleId}:${accountId}`
  await db.insertInto('greenfield_extension_installations').values({
    installation_id: installationId, extension_version_id: imported.extensionVersionId, account_id: accountId,
    status: 'enabled', config: {}, created_at: new Date(), updated_at: new Date(),
  }).execute()
  await db.insertInto('greenfield_module_permission_reviews').values({
    review_id: reviewId, installation_id: installationId, release_id: published.releaseId, account_id: accountId,
    granted_permissions: jsonb(permissions), denied_permissions: jsonb([]), high_risk_increase: false,
    idempotency_key: `review:${manifest.moduleId}`, reviewed_at: new Date(),
  }).execute()
  return {moduleId: manifest.moduleId, releaseId: published.releaseId, installationId, reviewId, permissions}
}

function baseManifest(moduleId: string, permissions: string[]): GreenfieldModuleManifestV1 {
  return {
    manifestVersion: 1, moduleId, name: moduleId, description: 'Synthetic MP02B generic runtime fixture.', version: '1.0.0',
    publisher: {publisherId: 'audit', displayName: 'Audit Fixtures'},
    source: {provider: 'github', repository: `modula-mod/${moduleId.replaceAll('.', '-')}`,
      commit: '0123456789abcdef0123456789abcdef01234567', manifestPath: 'module.manifest.json'},
    license: {status: 'firstParty', evidenceIds: ['mp02b-synthetic-fixture']}, trust: {requestedLevel: 'firstParty'},
    compatibility: {minimumGreenfieldVersion: '0.1.0', minimumModulaHostVersion: '0.1.0',
      protocolVersions: ['greenfield.v1'], platforms: ['server', 'web', 'ios', 'android']},
    permissions: permissions.map(permission => ({permission, reason: 'Synthetic MP02B acceptance', risk: 'medium'})),
    contributions: {}, extensions: {},
    integrity: {manifestSha256: 'a'.repeat(64), releaseSha256: 'b'.repeat(64)},
  }
}

function objectSchema(properties: Record<string, any>, required: string[]) {
  return {type: 'object' as const, properties, required, additionalProperties: false}
}

function betaCollection(): GreenfieldModuleCollectionDefinition {
  return {
    collection: 'task', schemaRef: 'schemas/audit-beta-task.v1.schema.json', defaultVisibility: 'private',
    fields: [{fieldId: 'title', name: 'title', type: 'text', label: 'Title', required: true}],
    searchableFields: ['title'], filterableFields: [], sortableFields: ['createdAt', 'updatedAt', 'title'],
    referenceFields: [], retentionPolicy: 'keepOnUninstall',
  }
}
