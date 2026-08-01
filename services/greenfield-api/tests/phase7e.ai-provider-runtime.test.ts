import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {manifestChecksum, type GreenfieldModuleManifestV1} from '@modula/greenfield-module-manifest'
import {sql} from 'kysely'
import {loadConfig, type AppConfig} from '../src/config/env.js'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldAIProviderRuntimeService} from '../src/ai/provider-runtime-service.js'
import {AIProviderCredentialService} from '../src/ai/credential-service.js'
import {GreenfieldAIRepository} from '../src/ai/repository.js'
import {AIProviderRuntimeRepository} from '../src/ai/runtime-repository.js'
import {GreenfieldAIProviderAdapterRegistry} from '../src/ai/providers/registry.js'
import {MockGreenfieldAIProviderAdapter} from '../src/ai/providers/mock-provider.js'
import {ProviderExecutionError, type ProviderExecutionContext, type ProviderExecutionRequest, type ProviderExecutionResult} from '../src/ai/providers/contract.js'
import {parseAndValidateStructuredOutput, validateStructuredOutput} from '../src/ai/schema-validator.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldModuleRuntimeAccessService} from '../src/modules/runtime-access.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

const aiPermissions = [
  'ai.request',
  'ai.stream',
  'ai.structured-output',
  'ai.tools.read',
  'ai.tools.execute',
  'ai.context.public',
  'ai.context.private',
]

describe('Phase 7E structured output security limits', () => {
  it('fails closed for malformed, oversized and deeply nested structured output', () => {
    const schema = {type: 'object', required: ['summary'], properties: {summary: {type: 'string'}}, additionalProperties: false}
    expect(() => parseAndValidateStructuredOutput(schema, '{bad-json')).toThrow(ProviderExecutionError)
    expect(validateStructuredOutput(schema, {summary: 'ok'}).valid).toBe(true)
    expect(validateStructuredOutput(schema, {summary: 'ok', extra: true}).valid).toBe(false)

    let nested: Record<string, unknown> = {summary: 'ok'}
    for (let i = 0; i < 30; i += 1) nested = {summary: 'ok', child: nested}
    expect(validateStructuredOutput({type: 'object'}, nested).valid).toBe(false)
  })
})

describeIfDb('Phase 7E AI provider runtime', () => {
  let db: ModulaDb
  let config: AppConfig
  let aiRepository: GreenfieldAIRepository
  let runtimeRepository: AIProviderRuntimeRepository
  let credentialService: AIProviderCredentialService
  let runtime: GreenfieldAIProviderRuntimeService
  let accountId = ''
  let actorId = ''
  let otherAccountId = ''
  let otherActorId = ''
  let moduleId = ''
  let installationId = ''
  let manifest: GreenfieldModuleManifestV1
  let grantedPermissions: string[] = []

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    config = loadConfig()
    aiRepository = new GreenfieldAIRepository(db)
    runtimeRepository = new AIProviderRuntimeRepository(db)
    credentialService = new AIProviderCredentialService(db, config)
    runtime = new GreenfieldAIProviderRuntimeService(db, config)
    const suffix = randomUUID().slice(0, 8)
    accountId = `ai-runtime-account-${suffix}`
    actorId = `actor-${accountId}`
    otherAccountId = `ai-runtime-other-${suffix}`
    otherActorId = `actor-${otherAccountId}`
    moduleId = `digital.modula.ai-runtime-${suffix}`
    installationId = `installation:${moduleId}:${accountId}`
    await seedProfileAccount(db, accountId, actorId, `air${suffix}`.slice(0, 24))
    await seedProfileAccount(db, otherAccountId, otherActorId, `airo${suffix}`.slice(0, 24))
    const seeded = await seedInstalledAiModule()
    manifest = seeded.manifest
    grantedPermissions = seeded.grantedPermissions
    await aiRepository.registerPrompt({
      promptId: `${moduleId}.summary`,
      version: '1.0.0',
      owner: moduleId,
      moduleId,
      purpose: 'Provider runtime contract test',
      variables: ['title'],
      outputSchema: summarySchema(),
      safetyPolicy: {policyMode: 'account-consent'},
      lifecycleStatus: 'active',
      promptTemplate: 'Summarise the authorised title {{title}}. private prompt secret',
    })
    await aiRepository.declareTool({
      toolId: 'greenfield.metadata.read',
      moduleId: 'greenfield',
      version: '1.0.0',
      description: 'Read deterministic Greenfield runtime metadata for AI provider tests.',
      inputSchema: {type: 'object', additionalProperties: true},
      outputSchema: {
        type: 'object',
        required: ['platform', 'capability', 'moduleId', 'installationScoped', 'requestedKeys'],
        properties: {
          platform: {type: 'string'},
          capability: {type: 'string'},
          moduleId: {type: 'string'},
          installationScoped: {type: 'boolean'},
          requestedKeys: {type: 'array', items: {type: 'string'}},
        },
        additionalProperties: false,
      },
      sideEffects: 'none',
      confirmation: 'none',
      requiredPermissions: ['ai.tools.read', 'ai.tools.execute'],
      lifecycleStatus: 'active',
    })
  })

  afterAll(async () => {
    await db?.destroy()
  })

  it('stores AI provider credentials encrypted and never returns credential material', async () => {
    const stored = await credentialService.store({
      providerId: 'provider:development-mock',
      scopeType: 'development',
      credential: {apiKey: 'sk-modula-provider-secret', auxiliary: {label: 'test-only'}},
      actorId,
      requestId: `credential-${randomUUID()}`,
    })
    expect(stored).toMatchObject({
      providerId: 'provider:development-mock',
      scopeType: 'development',
      status: 'unverified',
      encryptionKeyVersion: '1',
    })
    expect(JSON.stringify(stored)).not.toContain('sk-modula-provider-secret')

    const row = await db
      .selectFrom('ai_provider_credentials')
      .selectAll()
      .where('credential_id', '=', stored.credentialId)
      .executeTakeFirstOrThrow()
    expect(row.nonce.length).toBe(12)
    expect(row.authentication_tag.length).toBe(16)
    expect(row.encrypted_payload.toString('utf8')).not.toContain('sk-modula-provider-secret')
    const resolved = await credentialService.resolveCredential({
      providerId: 'provider:development-mock',
      scopes: [{scopeType: 'development'}],
    })
    expect(resolved?.apiKey).toBe('sk-modula-provider-secret')

    const audits = await db
      .selectFrom('audit_events')
      .select(['action', 'metadata'])
      .where('resource_id', '=', stored.credentialId)
      .execute()
    expect(audits.map(audit => audit.action)).toContain('ai.provider.credential.created')
    expect(JSON.stringify(audits)).not.toContain('sk-modula-provider-secret')
  })

  it('executes a module request through policy, prompt, context, mock provider, stream replay, validation and usage ledger', async () => {
    const result = await runtime.executeModuleRequest(baseRequest({
      requestId: `ai-runtime-stream-${randomUUID()}`,
      stream: true,
      context: {
        fragments: [
          {
            sourceType: 'module-record',
            sourceId: 'public-note',
            classification: 'public',
            content: 'Public context allowed for runtime test.',
            permissions: ['ai.context.public'],
            retentionPolicy: 'transient',
          },
          {
            sourceType: 'module-record',
            sourceId: 'private-note',
            classification: 'private',
            content: 'private runtime note apiKey=super-secret',
            permissions: ['ai.context.private'],
            retentionPolicy: 'transient',
          },
        ],
      },
    }))

    expect(result.status).toBe('completed')
    expect(result.structured).toMatchObject({summary: expect.any(String)})
    expect(result.streamId).toBeTruthy()

    const ledger = await db
      .selectFrom('greenfield_ai_request_ledger')
      .selectAll()
      .where('request_id', '=', result.requestId)
      .executeTakeFirstOrThrow()
    expect(ledger.status).toBe('completed')
    expect(ledger.provider_id).toBe('provider:development-mock')
    expect(ledger.total_tokens).toBeGreaterThan(0)
    expect(JSON.stringify(ledger)).not.toContain('private prompt secret')
    expect(JSON.stringify(ledger)).not.toContain('super-secret')

    const streamEvents = await runtime.streamEvents(result.executionId, accountId, 0)
    expect(streamEvents.map(event => event.event)).toContain('content.delta')
    expect(streamEvents.map(event => event.event)).toContain('execution.completed')
    const persistedStream = await db.selectFrom('ai_stream_sessions').selectAll().where('execution_id', '=', result.executionId).executeTakeFirstOrThrow()
    expect(persistedStream.status).toBe('completed')
    await expect(runtime.getExecution(result.executionId, otherAccountId)).rejects.toMatchObject({code: 'NOT_FOUND'})
  })

  it('redacts restricted context by default and keeps body content out of execution metadata', async () => {
    const result = await runtime.executeModuleRequest(baseRequest({
      requestId: `ai-runtime-context-${randomUUID()}`,
      context: {
        fragments: [{
          sourceType: 'vault-note',
          sourceId: 'restricted-note',
          classification: 'restricted',
          content: 'restricted secret should never persist',
          permissions: ['ai.context.restricted'],
          retentionPolicy: 'none',
        }],
      },
    }))
    const execution = await db.selectFrom('ai_executions').selectAll().where('execution_id', '=', result.executionId).executeTakeFirstOrThrow()
    expect(JSON.stringify(execution.request_metadata)).toContain('redactedFragments')
    expect(JSON.stringify(execution.request_metadata)).not.toContain('restricted secret should never persist')
  })

  it('records bounded structured-output repair attempts and fails closed when repair is exhausted', async () => {
    const repaired = await runtime.executeModuleRequest(baseRequest({
      requestId: `ai-runtime-repair-${randomUUID()}`,
      policyContext: {mockStructuredMode: 'invalid-then-valid'},
    }))
    expect(repaired.structured).toMatchObject({summary: expect.any(String)})
    const repairAttempts = await db
      .selectFrom('ai_execution_attempts')
      .select(['status'])
      .where('execution_id', '=', repaired.executionId)
      .execute()
    expect(repairAttempts).toHaveLength(2)
    expect(repairAttempts.every(attempt => attempt.status === 'completed')).toBe(true)

    await expect(runtime.executeModuleRequest(baseRequest({
      requestId: `ai-runtime-repair-fail-${randomUUID()}`,
      policyContext: {mockStructuredMode: 'invalid'},
    }))).rejects.toMatchObject({code: 'AI_STRUCTURED_OUTPUT_INVALID'})
  })

  it('executes only approved read-only tools through the provider-neutral broker', async () => {
    const result = await runtime.executeModuleRequest(baseRequest({
      requestId: `ai-runtime-tool-${randomUUID()}`,
      requiredCapabilities: ['chat', 'tool-calling'],
      responseSchema: {},
      tools: ['greenfield.metadata.read'],
    }))
    expect(result.status).toBe('completed')
    expect(result.output).toContain('tool')

    const toolRun = await db
      .selectFrom('greenfield_ai_tool_runs')
      .select(['tool_id', 'status', 'failure_code', 'redacted_details'])
      .where('request_id', '=', result.requestId)
      .executeTakeFirstOrThrow()
    expect(toolRun).toMatchObject({tool_id: 'greenfield.metadata.read', status: 'completed', failure_code: null})
    expect(JSON.stringify(toolRun.redacted_details)).toContain('outputKeys')
  })

  it('verifies provider health and opens circuit state after repeated provider failures', async () => {
    const health = await runtime.verifyProvider('provider:development-mock', {scopeType: 'development'})
    expect(health).toMatchObject({providerId: 'provider:development-mock', state: 'healthy'})
    const healthRow = await db
      .selectFrom('ai_provider_health')
      .select(['provider_id', 'state', 'component'])
      .where('provider_id', '=', 'provider:development-mock')
      .orderBy('checked_at', 'desc')
      .executeTakeFirstOrThrow()
    expect(healthRow).toMatchObject({provider_id: 'provider:development-mock', state: 'healthy'})

    await runtimeRepository.recordCircuitFailure('provider:development-mock', 'greenfield.mock.deterministic', 'AI_PROVIDER_TIMEOUT', 3)
    await runtimeRepository.recordCircuitFailure('provider:development-mock', 'greenfield.mock.deterministic', 'AI_PROVIDER_TIMEOUT', 3)
    await runtimeRepository.recordCircuitFailure('provider:development-mock', 'greenfield.mock.deterministic', 'AI_PROVIDER_TIMEOUT', 3)
    expect(await runtimeRepository.circuitAllows('provider:development-mock', 'greenfield.mock.deterministic', 60_000)).toBe(false)
    await runtimeRepository.recordCircuitSuccess('provider:development-mock', 'greenfield.mock.deterministic')
  })

  it('uses bounded failover when the primary provider fails before streaming starts', async () => {
    const failingProviderId = `provider:aaa-failing-${randomUUID().slice(0, 6)}`
    const fallbackProviderId = `provider:zzz-fallback-${randomUUID().slice(0, 6)}`
    const failingModelId = `model:aaa-failing-${randomUUID().slice(0, 6)}`
    const fallbackModelId = `model:zzz-fallback-${randomUUID().slice(0, 6)}`
    await aiRepository.upsertProvider({
      providerId: failingProviderId,
      kind: 'local',
      displayName: 'Failing mock',
      status: 'available',
      configurationMode: 'development-mock',
      capabilities: ['chat', 'structured-output'],
    })
    await aiRepository.upsertProvider({
      providerId: fallbackProviderId,
      kind: 'local',
      displayName: 'Fallback mock',
      status: 'available',
      configurationMode: 'development-mock',
      capabilities: ['chat', 'structured-output'],
    })
    await aiRepository.upsertModel({
      modelId: failingModelId,
      providerId: failingProviderId,
      providerKind: 'local',
      providerModelId: 'mock-failing',
      displayName: 'Failing mock model',
      capabilities: ['chat', 'structured-output'],
      availability: 'available',
      lifecycleStatus: 'active',
      enabled: true,
    })
    await aiRepository.upsertModel({
      modelId: fallbackModelId,
      providerId: fallbackProviderId,
      providerKind: 'local',
      providerModelId: 'mock-fallback',
      displayName: 'Fallback mock model',
      capabilities: ['chat', 'structured-output'],
      availability: 'available',
      lifecycleStatus: 'active',
      enabled: true,
    })
    const adapters = new GreenfieldAIProviderAdapterRegistry()
    adapters.register(new FailingProviderAdapter(failingProviderId))
    adapters.register(new MockGreenfieldAIProviderAdapter(fallbackProviderId))
    const failoverRuntime = new GreenfieldAIProviderRuntimeService(db, config, {adapterRegistry: adapters})
    const result = await failoverRuntime.executeModuleRequest(baseRequest({
      requestId: `ai-runtime-failover-${randomUUID()}`,
      preferredModelId: undefined,
      permittedProviders: [failingProviderId, fallbackProviderId],
      maxRetries: 1,
    }))
    expect(result.providerId).toBe(fallbackProviderId)
    const attempts = await db
      .selectFrom('ai_execution_attempts')
      .select(['provider_id', 'status', 'failure_code'])
      .where('execution_id', '=', result.executionId)
      .orderBy('attempt_number')
      .execute()
    expect(attempts).toMatchObject([
      {provider_id: failingProviderId, status: 'failed', failure_code: 'AI_PROVIDER_UNAVAILABLE'},
      {provider_id: fallbackProviderId, status: 'completed', failure_code: null},
    ])
  })

  it('cancels streaming executions locally and rejects quota excess before provider cost', async () => {
    await expect(runtime.executeModuleRequest(baseRequest({
      requestId: `ai-runtime-cancel-${randomUUID()}`,
      stream: true,
      policyContext: {mockCancelAfterFirstDelta: true},
    }))).rejects.toMatchObject({code: 'AI_EXECUTION_CANCELLED'})

    await runtimeRepository.setUsageLimit({
      limitId: `ai-limit:${accountId}:rpm`,
      scopeType: 'account',
      scopeId: accountId,
      limitKind: 'requests-per-minute',
      unit: 'request',
      windowSeconds: 60,
      limitValue: 1,
    })
    await runtime.executeModuleRequest(baseRequest({requestId: `ai-runtime-quota-pass-${randomUUID()}`}))
    await expect(runtime.executeModuleRequest(baseRequest({
      requestId: `ai-runtime-quota-block-${randomUUID()}`,
    }))).rejects.toMatchObject({code: 'AI_QUOTA_EXCEEDED'})
  })

  it('blocks disabled modules before AI execution', async () => {
    await db.updateTable('greenfield_extension_installations').set({status: 'disabled', updated_at: new Date()}).where('installation_id', '=', installationId).execute()
    await expect(new GreenfieldModuleRuntimeAccessService(db).resolve(accountId, moduleId, {requireEnabled: true})).rejects.toMatchObject({code: 'FORBIDDEN'})
  })

  function baseRequest(overrides: Partial<Parameters<GreenfieldAIProviderRuntimeService['executeModuleRequest']>[0]> = {}) {
    return {
      requestId: `ai-runtime-${randomUUID()}`,
      requestingModuleId: moduleId,
      accountId,
      actorId,
      installationId,
      correlationId: `corr-${randomUUID()}`,
      requiredCapabilities: ['chat'] as const,
      preferredModelId: 'greenfield.mock.deterministic',
      prompt: {promptId: `${moduleId}.summary`, version: '1.0.0', variables: {title: 'Runtime'}},
      responseSchema: summarySchema(),
      manifest,
      grantedPermissions,
      routingStrategy: 'local-first' as const,
      ...overrides,
    }
  }

  async function seedInstalledAiModule(): Promise<{manifest: GreenfieldModuleManifestV1; grantedPermissions: string[]}> {
    const version = '1.0.0'
    const moduleManifest = aiModuleManifest(moduleId, version)
    const imported = await new GreenfieldModuleReleaseService(db).importPendingReview(moduleManifest)
    const published = await new GreenfieldModuleReleaseService(db).publishRelease(moduleId, version)
    await db
      .insertInto('greenfield_extension_installations')
      .values({
        installation_id: installationId,
        extension_version_id: imported.extensionVersionId,
        account_id: accountId,
        status: 'enabled',
        config: {},
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()
    await db
      .insertInto('greenfield_module_permission_reviews')
      .values({
        review_id: `review:${installationId}`,
        installation_id: installationId,
        release_id: published.releaseId,
        account_id: accountId,
        granted_permissions: jsonb(aiPermissions),
        denied_permissions: jsonb([]),
        high_risk_increase: false,
        idempotency_key: `review-${installationId}`,
        reviewed_at: new Date(),
      })
      .execute()
    return {manifest: moduleManifest, grantedPermissions: aiPermissions}
  }
})

class FailingProviderAdapter extends MockGreenfieldAIProviderAdapter {
  async execute(_request: ProviderExecutionRequest, _context: ProviderExecutionContext): Promise<ProviderExecutionResult> {
    throw new ProviderExecutionError('AI_PROVIDER_UNAVAILABLE', 'Synthetic provider outage', true)
  }
}

function configureTestEnv(): void {
  process.env.NODE_ENV = 'test'
  process.env.MODULA_ENVIRONMENT = 'development'
  process.env.MODULA_API_HOST = '127.0.0.1'
  process.env.MODULA_API_PORT = '4031'
  process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4031'
  process.env.MODULA_DATABASE_URL = databaseUrl!
  process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
  process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
  process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
  process.env.GREENFIELD_AI_GATEWAY_ENABLED = 'true'
}

async function seedProfileAccount(db: ModulaDb, accountId: string, actorId: string, handle: string): Promise<void> {
  const now = new Date()
  await db
    .insertInto('greenfield_accounts')
    .values({
      account_id: accountId,
      primary_handle: handle,
      status: 'active',
      created_at: now,
      updated_at: now,
    })
    .execute()
  await db
    .insertInto('actors')
    .values({
      id: actorId,
      account_id: accountId,
      kind: 'person',
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
    })
    .execute()
  await db
    .insertInto('profiles')
    .values({
      id: `profile-${actorId}`,
      actor_id: actorId,
      handle,
      display_name: 'Phase 7E AI Runtime',
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

function aiModuleManifest(moduleId: string, version: string): GreenfieldModuleManifestV1 {
  const manifest = {
    manifestVersion: 1,
    moduleId,
    name: 'AI Runtime Test Module',
    description: 'First-party module used to verify provider runtime boundaries.',
    version,
    publisher: {publisherId: 'modula', displayName: 'Modula'},
    source: {
      provider: 'github',
      repository: 'modula-mod/modula-module-ai-runtime-test',
      commit: '0123456789abcdef0123456789abcdef01234567',
      manifestPath: 'module.manifest.json',
    },
    license: {status: 'firstParty', evidenceIds: ['first-party-policy']},
    trust: {requestedLevel: 'firstParty'},
    compatibility: {
      minimumGreenfieldVersion: '0.1.0',
      minimumModulaHostVersion: '0.1.0',
      protocolVersions: ['greenfield.v1'],
      platforms: ['server'],
    },
    permissions: aiPermissions.map(permission => ({permission, reason: `Verify ${permission} runtime boundary`})),
    contributions: {},
    ai: {
      features: ['summarise', 'extract'],
      tools: ['greenfield.metadata.read'],
      requiredCapabilities: ['chat', 'streaming', 'structured-output', 'tool-calling'],
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

function summarySchema() {
  return {
    type: 'object',
    required: ['summary'],
    properties: {summary: {type: 'string'}},
    additionalProperties: false,
  }
}
