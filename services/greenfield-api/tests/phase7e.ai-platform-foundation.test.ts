import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {validateGreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldAIGatewayService} from '../src/ai/gateway-service.js'
import {GreenfieldAIRepository} from '../src/ai/repository.js'
import {GreenfieldAIStreamingRuntime} from '../src/ai/streaming-runtime.js'
import {GreenfieldAIToolBroker} from '../src/ai/tool-broker.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describe('Phase 7E AI module manifest declarations', () => {
  it('accepts capabilities and rejects provider-bound module AI declarations', () => {
    const accepted = validateGreenfieldModuleManifest(moduleManifest({
      ai: {
        features: ['summarise', 'extract'],
        tools: ['note.search', 'note.create'],
        requiredCapabilities: ['chat', 'structured-output'],
      },
    }))
    expect(accepted.valid).toBe(true)

    const rejected = validateGreenfieldModuleManifest(moduleManifest({
      ai: {
        features: ['summarise'],
        provider: 'openai',
        modelId: 'provider-bound-model',
      },
    }))
    expect(rejected.issues.map(issue => issue.code)).toContain('PROVIDER_BOUND_AI_DECLARATION')
  })
})

describeIfDb('Phase 7E Greenfield AI platform foundation', () => {
  let db: ModulaDb
  let repository: GreenfieldAIRepository
  let gateway: GreenfieldAIGatewayService
  let streaming: GreenfieldAIStreamingRuntime
  let tools: GreenfieldAIToolBroker
  let accountId = ''
  let actorId = ''
  let otherAccountId = ''
  let otherActorId = ''
  let providerId = ''
  let modelId = ''
  const moduleId = 'digital.modula.vault-notes'

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    repository = new GreenfieldAIRepository(db)
    gateway = new GreenfieldAIGatewayService(db)
    streaming = new GreenfieldAIStreamingRuntime(db)
    tools = new GreenfieldAIToolBroker(db)

    const suffix = randomUUID().slice(0, 8)
    accountId = `ai-account-${suffix}`
    actorId = `actor-${accountId}`
    otherAccountId = `ai-other-${suffix}`
    otherActorId = `actor-${otherAccountId}`
    providerId = `provider:ai-test-${suffix}`
    modelId = `model:ai-test-${suffix}`
    await seedProfileAccount(db, accountId, actorId, `ai${suffix}`.slice(0, 24))
    await seedProfileAccount(db, otherAccountId, otherActorId, `aio${suffix}`.slice(0, 24))
    await repository.upsertProvider({
      providerId,
      kind: 'local',
      displayName: 'Local test provider',
      status: 'available',
      configurationMode: 'local-runtime',
      capabilities: ['chat', 'streaming', 'structured-output', 'tool-calling'],
    })
    await repository.upsertModel({
      modelId,
      providerId,
      providerKind: 'local',
      providerModelId: 'local-test-model',
      displayName: 'Local test model',
      capabilities: ['chat', 'streaming', 'structured-output', 'tool-calling'],
      availability: 'available',
      lifecycleStatus: 'active',
      enabled: true,
    })
    await repository.registerPrompt({
      promptId: 'vault.summary',
      version: '1.0.0',
      owner: moduleId,
      moduleId,
      purpose: 'Vault Notes summary',
      variables: ['title'],
      outputSchema: {
        type: 'object',
        required: ['summary'],
        properties: {summary: {type: 'string'}},
      },
      safetyPolicy: {policyMode: 'account-consent'},
      lifecycleStatus: 'active',
      promptTemplate: 'Summarise the authorised note title {{title}}. private prompt secret',
    })
  })

  afterAll(async () => {
    await db?.destroy()
  })

  it('routes requests through the gateway while hiding provider details from module responses', async () => {
    const accepted = await gateway.createRequest({
      requestId: `ai-request-${randomUUID()}`,
      requestingModuleId: moduleId,
      accountId,
      actorId,
      correlationId: `corr-${randomUUID()}`,
      requiredCapabilities: ['chat'],
      preferredModelId: modelId,
      prompt: {promptId: 'vault.summary', version: '1.0.0', variables: {title: 'Roadmap'}},
      responseSchema: {type: 'object', required: ['summary']},
      safetyRequirements: {policyMode: 'account-consent'},
    })

    expect(accepted.status).toBe('accepted')
    expect(JSON.stringify(accepted)).not.toContain(providerId)
    expect(JSON.stringify(accepted)).not.toContain('local-test-model')

    await gateway.completeRequest({
      requestId: accepted.requestId,
      latencyMs: 42,
      inputTokens: 11,
      outputTokens: 9,
      estimatedCostMicrounits: 25,
    })

    const ledger = await db
      .selectFrom('greenfield_ai_request_ledger')
      .selectAll()
      .where('request_id', '=', accepted.requestId)
      .executeTakeFirstOrThrow()
    expect(ledger.provider_id).toBe(providerId)
    expect(ledger.model_id).toBe(modelId)
    expect(ledger.prompt_id).toBe('vault.summary')
    expect(ledger.status).toBe('completed')
    expect(ledger.total_tokens).toBe(20)
    expect(JSON.stringify(ledger)).not.toContain('private prompt secret')
  })

  it('records policy-denied requests and audits AI consent failures', async () => {
    const requestId = `ai-denied-${randomUUID()}`
    await expect(gateway.createRequest({
      requestId,
      requestingModuleId: moduleId,
      accountId,
      actorId,
      correlationId: requestId,
      requiredCapabilities: ['chat'],
      preferredModelId: modelId,
      policyContext: {currentState: 'AI-consent-missing'},
    })).rejects.toMatchObject({code: 'FORBIDDEN'})

    const ledger = await db
      .selectFrom('greenfield_ai_request_ledger')
      .select(['status', 'failure_code'])
      .where('request_id', '=', requestId)
      .executeTakeFirstOrThrow()
    expect(ledger).toMatchObject({status: 'denied', failure_code: 'AI_CONTEXT_NOT_ALLOWED'})

    const policyAudit = await db
      .selectFrom('greenfield_policy_decision_audit')
      .select(['code', 'allowed'])
      .where('request_id', '=', requestId)
      .executeTakeFirstOrThrow()
    expect(policyAudit).toMatchObject({code: 'AI_CONTEXT_NOT_ALLOWED', allowed: false})
  })

  it('redacts unauthorised context resources before provider resolution can see content', async () => {
    const requestId = `ai-context-${randomUUID()}`
    const accepted = await gateway.createRequest({
      requestId,
      requestingModuleId: moduleId,
      accountId: otherAccountId,
      actorId: otherActorId,
      correlationId: requestId,
      requiredCapabilities: ['chat'],
      preferredModelId: modelId,
      context: {
        resources: [{
          type: 'note',
          id: 'private-note',
          ownerActorId: actorId,
          visibility: 'private',
          purpose: 'summary',
        }],
        transient: {selectionText: 'private selected text should not enter the ledger'},
        systemInstructionRefs: ['greenfield.ai.safe-defaults.v1'],
      },
    })
    expect(accepted.context).toMatchObject({
      allowedResourceCount: 0,
      redactedResourceCount: 1,
      transientKeys: ['selectionText'],
    })
    const ledger = await db
      .selectFrom('greenfield_ai_request_ledger')
      .select(['context_summary'])
      .where('request_id', '=', requestId)
      .executeTakeFirstOrThrow()
    expect(JSON.stringify(ledger.context_summary)).not.toContain('private selected text')
  })

  it('supports generic streaming state, reconnect, cancellation and structured completion accounting', async () => {
    const accepted = await gateway.createRequest({
      requestId: `ai-stream-${randomUUID()}`,
      requestingModuleId: moduleId,
      accountId,
      actorId,
      correlationId: `corr-stream-${randomUUID()}`,
      requiredCapabilities: ['chat'],
      preferredModelId: modelId,
      stream: true,
      responseSchema: {type: 'object', required: ['summary']},
    })
    const streamId = accepted.streaming.streamId
    expect(streamId).toBeTruthy()
    const tokenEvent = await streaming.appendToken({streamId: streamId!, token: 'secret streamed token'})
    expect(tokenEvent).toMatchObject({type: 'token', sequence: 1, token: 'secret streamed token'})
    expect(await streaming.reconnect(streamId!)).toMatchObject({streamId, lastSequence: 1})
    await streaming.complete({
      streamId: streamId!,
      structuredCompletion: {summary: 'Done'},
      usageDelta: {inputTokens: 5, outputTokens: 3, estimatedCostMicrounits: 8},
    })

    const stream = await db.selectFrom('greenfield_ai_streams').selectAll().where('stream_id', '=', streamId!).executeTakeFirstOrThrow()
    expect(stream.status).toBe('completed')
    expect(stream.last_sequence).toBe(1)

    const events = await db
      .selectFrom('greenfield_domain_events')
      .select(['event_type', 'payload'])
      .where('aggregate_id', '=', streamId!)
      .execute()
    expect(events.map(event => event.event_type)).toContain('ai.stream.progress')
    expect(JSON.stringify(events)).not.toContain('secret streamed token')
  })

  it('validates tool schemas, permissions and confirmation before tool execution', async () => {
    const tool = await tools.declareTool({
      toolId: `${moduleId}.note.delete`,
      moduleId,
      version: '1.0.0',
      description: 'Delete a note after user confirmation',
      inputSchema: {type: 'object', required: ['noteId'], properties: {noteId: {type: 'string'}}},
      outputSchema: {type: 'object'},
      sideEffects: 'destructive',
      confirmation: 'user',
      requiredPermissions: ['notes:delete'],
      lifecycleStatus: 'active',
    })
    await expect(tools.validateAndRecord({
      toolId: tool.toolId,
      accountId,
      actorId,
      arguments: {},
      grantedPermissions: ['notes:delete'],
      requestContext: {requestId: `tool-missing-${randomUUID()}`},
    })).rejects.toMatchObject({code: 'VALIDATION_FAILED'})

    const confirmation = await tools.validateAndRecord({
      toolId: tool.toolId,
      accountId,
      actorId,
      arguments: {noteId: 'note-secret-delete'},
      grantedPermissions: ['notes:delete'],
      requestContext: {requestId: `tool-confirm-${randomUUID()}`},
    })
    expect(confirmation.status).toBe('confirmation_required')

    const completed = await tools.validateAndRecord({
      toolId: tool.toolId,
      accountId,
      actorId,
      arguments: {noteId: 'note-secret-delete'},
      grantedPermissions: ['notes:delete'],
      confirmed: true,
      requestContext: {requestId: `tool-complete-${randomUUID()}`},
    })
    expect(completed.status).toBe('completed')

    const runs = await db
      .selectFrom('greenfield_ai_tool_runs')
      .select(['argument_hash', 'status'])
      .where('tool_id', '=', tool.toolId)
      .execute()
    expect(runs.some(run => run.status === 'confirmation_required')).toBe(true)
    expect(runs.every(run => run.argument_hash.length === 64)).toBe(true)
    expect(JSON.stringify(runs)).not.toContain('note-secret-delete')
  })

  it('rejects provider-specific request payloads and invalid structured-output schemas', async () => {
    await expect(gateway.createRequest({
      requestingModuleId: moduleId,
      accountId,
      actorId,
      requiredCapabilities: ['chat'],
      preferredModelId: modelId,
      providerId,
    } as any)).rejects.toMatchObject({code: 'VALIDATION_FAILED'})

    await expect(gateway.createRequest({
      requestingModuleId: moduleId,
      accountId,
      actorId,
      requiredCapabilities: ['chat'],
      preferredModelId: modelId,
      responseSchema: {type: 'string'},
    })).rejects.toMatchObject({code: 'VALIDATION_FAILED'})
  })
})

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
      display_name: 'Phase 7E AI',
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

function moduleManifest(overrides: Record<string, unknown>) {
  return {
    manifestVersion: 1,
    moduleId: 'digital.modula.vault-notes',
    name: 'Vault Notes',
    description: 'First-party private notes module.',
    version: '1.0.0',
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
      platforms: ['server', 'ios'],
    },
    permissions: [{permission: 'schemas:register', reason: 'Register Vault record schemas'}],
    contributions: {},
    integrity: {manifestSha256: 'a'.repeat(64)},
    ...overrides,
  }
}
