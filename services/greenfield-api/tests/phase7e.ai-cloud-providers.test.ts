import {randomUUID} from 'node:crypto'
import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from 'vitest'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {AIAccountPreferencesService} from '../src/ai/account-preferences.js'
import {GreenfieldAIGatewayService} from '../src/ai/gateway-service.js'
import {GreenfieldAIQuotaService} from '../src/ai/quota-service.js'
import {GreenfieldAIRepository} from '../src/ai/repository.js'
import {AnthropicGreenfieldAIProviderAdapter} from '../src/ai/providers/anthropic-provider.js'
import {GeminiGreenfieldAIProviderAdapter} from '../src/ai/providers/gemini-provider.js'
import type {ProviderExecutionRequest} from '../src/ai/providers/contract.js'
import {createDefaultProviderAdapterRegistry} from '../src/ai/providers/registry.js'
import {GreenfieldAIProviderResolver} from '../src/ai/providers/resolver.js'
import {estimateCostMinorUnits, parseModelPricing} from '../src/ai/pricing.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

// Clearly-fake placeholder credentials, used only to exercise the adapters
// against stubbed fetch. Never a real key.
const FAKE_API_KEY = 'test-fake-api-key-0000'
const MOLIBOO_IDENTITY = 'You are Nebbi, a Stardust Moliboo. You are warm, curious and loyal. You remember what Andrei tells you.'

function executionRequest(overrides: Partial<ProviderExecutionRequest> = {}): ProviderExecutionRequest {
  return {
    executionId: `ai-exec-${randomUUID()}`,
    requestId: `ai-request-${randomUUID()}`,
    accountId: `ai-account-${randomUUID().slice(0, 8)}`,
    moduleId: 'digital.modula.vault-notes',
    modelId: 'test-model',
    providerModelId: 'test-provider-model',
    messages: [
      {role: 'system', content: MOLIBOO_IDENTITY},
      {role: 'user', content: 'Hello, Nebbi.'},
    ],
    maxInputUnits: 4096,
    maxOutputUnits: 512,
    timeoutMs: 10_000,
    structuredOutput: false,
    stream: false,
    toolIds: [],
    metadata: {},
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}})
}

function collectEvents(iterable: AsyncIterable<{type: string}>): Promise<Array<{type: string}>> {
  const events: Array<{type: string}> = []
  return (async () => {
    for await (const event of iterable) events.push(event)
    return events
  })()
}

describe('Cloud model provider adapters (stubbed fetch, fake credentials)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Anthropic execute sends the Moliboo identity as the system prompt and returns text + usage', async () => {
    const seen: Array<{url: string; init: RequestInit}> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      seen.push({url, init})
      return jsonResponse({
        id: 'msg-test-1',
        type: 'message',
        role: 'assistant',
        model: 'claude-test',
        content: [{type: 'text', text: 'Hello, friend.'}],
        stop_reason: 'end_turn',
        usage: {input_tokens: 12, output_tokens: 4},
      })
    }))
    const adapter = new AnthropicGreenfieldAIProviderAdapter('provider:anthropic')
    const result = await adapter.execute(executionRequest(), {providerId: 'provider:anthropic', credentials: {apiKey: FAKE_API_KEY}})
    expect(result.outputText).toBe('Hello, friend.')
    expect(result.usage).toMatchObject({inputTokens: 12, outputTokens: 4})
    expect(seen).toHaveLength(1)
    expect(seen[0].url).toBe('https://api.anthropic.com/v1/messages')
    const headers = seen[0].init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe(FAKE_API_KEY)
    expect(headers['anthropic-version']).toBe('2023-06-01')
    const body = JSON.parse(String(seen[0].init.body)) as Record<string, unknown>
    expect(body.system).toBe(MOLIBOO_IDENTITY)
    expect(body.model).toBe('test-provider-model')
  })

  it('Anthropic merges consecutive same-role messages into one', async () => {
    let capturedBody: Record<string, unknown> = {}
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(String(init.body)) as Record<string, unknown>
      return jsonResponse({
        content: [{type: 'text', text: 'ok'}],
        usage: {input_tokens: 1, output_tokens: 1},
      })
    }))
    const adapter = new AnthropicGreenfieldAIProviderAdapter('provider:anthropic')
    await adapter.execute(executionRequest({
      messages: [
        {role: 'system', content: MOLIBOO_IDENTITY},
        {role: 'user', content: 'First fragment.'},
        {role: 'user', content: 'Second fragment.'},
      ],
    }), {providerId: 'provider:anthropic', credentials: {apiKey: FAKE_API_KEY}})
    const messages = capturedBody.messages as Array<{role: string; content: string}>
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({role: 'user', content: 'First fragment.\n\nSecond fragment.'})
  })

  it('Anthropic maps 401 to auth failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({type: 'error', error: {type: 'authentication_error', message: 'bad key'}}, 401)))
    const adapter = new AnthropicGreenfieldAIProviderAdapter('provider:anthropic')
    await expect(adapter.execute(executionRequest(), {providerId: 'provider:anthropic', credentials: {apiKey: FAKE_API_KEY}}))
      .rejects.toMatchObject({failureCode: 'AI_PROVIDER_AUTH_FAILED'})
  })

  it('Anthropic streams text deltas and completes with usage', async () => {
    const sse = [
      'event: message_start',
      'data: {"type":"message_start","message":{"id":"msg-test","type":"message","role":"assistant","model":"claude-test"}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello "}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Nebbi"}}',
      '',
      'event: message_delta',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
      '',
    ].join('\n')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(sse, {status: 200, headers: {'content-type': 'text/event-stream'}})))
    const adapter = new AnthropicGreenfieldAIProviderAdapter('provider:anthropic')
    const events = await collectEvents(adapter.stream(executionRequest({stream: true}), {providerId: 'provider:anthropic', credentials: {apiKey: FAKE_API_KEY}}))
    expect(events.map(event => event.type)).toEqual(['execution.started', 'content.delta', 'content.delta', 'reasoning.status', 'execution.completed'])
    const completed = events[events.length - 1] as {outputText?: string; usage?: Record<string, unknown>}
    expect(completed.outputText).toBe('Hello Nebbi')
    expect(completed.usage).toMatchObject({outputTokens: 5})
  })

  it('Anthropic discoverModels lists provider models', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      data: [
        {id: 'claude-test-1', display_name: 'Claude Test 1'},
        {id: 'claude-test-2'},
      ],
    })))
    const adapter = new AnthropicGreenfieldAIProviderAdapter('provider:anthropic')
    const models = await adapter.discoverModels({providerId: 'provider:anthropic', credentials: {apiKey: FAKE_API_KEY}})
    expect(models.map(model => model.providerModelId)).toEqual(['claude-test-1', 'claude-test-2'])
    expect(models[0].supportsStreaming).toBe(true)
  })

  it('Gemini execute sends the Moliboo identity as systemInstruction and returns text + usage', async () => {
    const seen: Array<{url: string; init: RequestInit}> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      seen.push({url, init})
      return jsonResponse({
        candidates: [{content: {parts: [{text: 'Hello from Gemini.'}]}, finishReason: 'STOP'}],
        usageMetadata: {promptTokenCount: 14, candidatesTokenCount: 6, totalTokenCount: 20},
      })
    }))
    const adapter = new GeminiGreenfieldAIProviderAdapter('provider:gemini')
    const result = await adapter.execute(executionRequest(), {providerId: 'provider:gemini', credentials: {apiKey: FAKE_API_KEY}})
    expect(result.outputText).toBe('Hello from Gemini.')
    expect(result.usage).toMatchObject({inputTokens: 14, outputTokens: 6})
    expect(seen).toHaveLength(1)
    expect(seen[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/models/test-provider-model:generateContent')
    const headers = seen[0].init.headers as Record<string, string>
    expect(headers['x-goog-api-key']).toBe(FAKE_API_KEY)
    const body = JSON.parse(String(seen[0].init.body)) as Record<string, unknown>
    const systemInstruction = body.systemInstruction as {parts: Array<{text: string}>}
    expect(systemInstruction.parts[0].text).toBe(MOLIBOO_IDENTITY)
  })

  it('Gemini maps rate limiting and auth failures to gateway failure codes', async () => {
    const adapter = new GeminiGreenfieldAIProviderAdapter('provider:gemini')
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({error: {status: 'RESOURCE_EXHAUSTED', message: 'quota'}} , 429)))
    await expect(adapter.execute(executionRequest(), {providerId: 'provider:gemini', credentials: {apiKey: FAKE_API_KEY}}))
      .rejects.toMatchObject({failureCode: 'AI_PROVIDER_RATE_LIMITED'})

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({error: {status: 'UNAUTHENTICATED', message: 'bad key'}}, 401)))
    await expect(adapter.execute(executionRequest(), {providerId: 'provider:gemini', credentials: {apiKey: FAKE_API_KEY}}))
      .rejects.toMatchObject({failureCode: 'AI_PROVIDER_AUTH_FAILED'})
  })

  it('Gemini streams content deltas and completes', async () => {
    const sse = [
      'data: {"candidates":[{"content":{"parts":[{"text":"Hello "}]}}]}',
      '',
      'data: {"candidates":[{"content":{"parts":[{"text":"Nebbi"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":14,"candidatesTokenCount":6,"totalTokenCount":20}}',
      '',
      '',
    ].join('\n')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(sse, {status: 200, headers: {'content-type': 'text/event-stream'}})))
    const adapter = new GeminiGreenfieldAIProviderAdapter('provider:gemini')
    const events = await collectEvents(adapter.stream(executionRequest({stream: true}), {providerId: 'provider:gemini', credentials: {apiKey: FAKE_API_KEY}}))
    expect(events.map(event => event.type)).toEqual(['execution.started', 'content.delta', 'content.delta', 'reasoning.status', 'execution.completed'])
    const completed = events[events.length - 1] as {outputText?: string}
    expect(completed.outputText).toBe('Hello Nebbi')
  })

  it('Gemini discoverModels lists generateContent-capable models', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      models: [
        {name: 'models/gemini-test-1', displayName: 'Gemini Test 1', supportedGenerationMethods: ['generateContent']},
        {name: 'models/gemini-embed', displayName: 'Gemini Embed', supportedGenerationMethods: ['embedContent']},
      ],
    })))
    const adapter = new GeminiGreenfieldAIProviderAdapter('provider:gemini')
    const models = await adapter.discoverModels({providerId: 'provider:gemini', credentials: {apiKey: FAKE_API_KEY}})
    expect(models.map(model => model.providerModelId)).toEqual(['gemini-test-1'])
  })

  it('the Moliboo identity is identical across providers (identity rule)', async () => {
    const bodies: Array<Record<string, unknown>> = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
      // Anthropic-shaped reply; the Gemini adapter is exercised separately
      // below with the same request, so the captured body is what matters.
      return jsonResponse({
        content: [{type: 'text', text: 'ok'}],
        usage: {input_tokens: 1, output_tokens: 1},
      })
    }))
    const request = executionRequest()
    const anthropic = new AnthropicGreenfieldAIProviderAdapter('provider:anthropic')
    await anthropic.execute(request, {providerId: 'provider:anthropic', credentials: {apiKey: FAKE_API_KEY}})
    const anthropicSystem = bodies[0].system as string

    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
      return jsonResponse({
        candidates: [{content: {parts: [{text: 'ok'}]}, finishReason: 'STOP'}],
        usageMetadata: {promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2},
      })
    }))
    const gemini = new GeminiGreenfieldAIProviderAdapter('provider:gemini')
    await gemini.execute(request, {providerId: 'provider:gemini', credentials: {apiKey: FAKE_API_KEY}})
    const geminiSystem = (bodies[1].systemInstruction as {parts: Array<{text: string}>}).parts[0].text

    expect(anthropicSystem).toBe(MOLIBOO_IDENTITY)
    expect(geminiSystem).toBe(MOLIBOO_IDENTITY)
    expect(anthropicSystem).toBe(geminiSystem)
  })

  it('adapters refuse to run without a credential', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({})))
    const anthropic = new AnthropicGreenfieldAIProviderAdapter('provider:anthropic')
    await expect(anthropic.execute(executionRequest(), {providerId: 'provider:anthropic'}))
      .rejects.toMatchObject({failureCode: 'AI_PROVIDER_AUTH_FAILED'})
    const gemini = new GeminiGreenfieldAIProviderAdapter('provider:gemini')
    await expect(gemini.execute(executionRequest(), {providerId: 'provider:gemini'}))
      .rejects.toMatchObject({failureCode: 'AI_PROVIDER_AUTH_FAILED'})
  })

  it('the default registry wires the direct Anthropic and Gemini adapters', () => {
    const registry = createDefaultProviderAdapterRegistry()
    expect(registry.require('provider:anthropic')).toBeInstanceOf(AnthropicGreenfieldAIProviderAdapter)
    expect(registry.require('provider:gemini')).toBeInstanceOf(GeminiGreenfieldAIProviderAdapter)
    expect(registry.require('provider:openai').providerId).toBe('provider:openai')
  })
})

describe('Cloud model pricing helpers', () => {
  it('estimates cost from operator-set per-model pricing and returns nothing without it', () => {
    expect(parseModelPricing({})).toBeUndefined()
    expect(parseModelPricing({inputPricePerMillionMinorUnits: 500, outputPricePerMillionMinorUnits: 1500, currency: 'USD'}))
      .toMatchObject({inputPricePerMillionMinorUnits: 500, outputPricePerMillionMinorUnits: 1500, currency: 'USD'})
    expect(estimateCostMinorUnits({inputTokens: 1_000_000, outputTokens: 1_000_000}, parseModelPricing({
      inputPricePerMillionMinorUnits: 500,
      outputPricePerMillionMinorUnits: 1500,
    }))).toMatchObject({providerCostMinorUnits: 2000, currency: 'USD'})
    expect(estimateCostMinorUnits({inputTokens: 100, outputTokens: 100}, undefined)).toEqual({})
  })
})

describeIfDb('Cloud model preferences, routing gate and budget', () => {
  let db: ModulaDb
  let repository: GreenfieldAIRepository
  let preferences: AIAccountPreferencesService
  let resolver: GreenfieldAIProviderResolver
  let quotas: GreenfieldAIQuotaService
  let gateway: GreenfieldAIGatewayService
  let accountId = ''
  let actorId = ''
  let localProviderId = ''
  let localModelId = ''
  let cloudProviderId = ''
  let cloudModelId = ''
  const moduleId = 'digital.modula.vault-notes'

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    repository = new GreenfieldAIRepository(db)
    preferences = new AIAccountPreferencesService(db)
    resolver = new GreenfieldAIProviderResolver(db)
    quotas = new GreenfieldAIQuotaService(db)
    gateway = new GreenfieldAIGatewayService(db)

    const suffix = randomUUID().slice(0, 8)
    accountId = `ai-cloud-account-${suffix}`
    actorId = `actor-${accountId}`
    localProviderId = `provider:ai-cloud-local-${suffix}`
    localModelId = `model:ai-cloud-local-${suffix}`
    cloudProviderId = `provider:ai-cloud-remote-${suffix}`
    cloudModelId = `model:ai-cloud-remote-${suffix}`
    await seedProfileAccount(db, accountId, actorId, `aic${suffix}`.slice(0, 24))
    await repository.upsertProvider({
      providerId: localProviderId,
      kind: 'local',
      displayName: 'Local test provider',
      status: 'available',
      configurationMode: 'local-runtime',
      capabilities: ['chat', 'streaming', 'structured-output'],
    })
    await repository.upsertModel({
      modelId: localModelId,
      providerId: localProviderId,
      providerKind: 'local',
      providerModelId: 'local-test-model',
      displayName: 'Local test model',
      capabilities: ['chat', 'streaming', 'structured-output'],
      availability: 'available',
      lifecycleStatus: 'active',
      enabled: true,
    })
    await repository.upsertProvider({
      providerId: cloudProviderId,
      kind: 'anthropic',
      displayName: 'Cloud test provider',
      status: 'available',
      configurationMode: 'server-managed',
      capabilities: ['chat', 'streaming', 'structured-output'],
    })
    await repository.upsertModel({
      modelId: cloudModelId,
      providerId: cloudProviderId,
      providerKind: 'anthropic',
      providerModelId: 'cloud-test-model',
      displayName: 'Cloud test model',
      capabilities: ['chat', 'streaming', 'structured-output'],
      availability: 'available',
      lifecycleStatus: 'active',
      enabled: true,
    })
  })

  afterAll(async () => {
    await db?.destroy()
  })

  it('defaults to local-only and round-trips an opt-in with a budget', async () => {
    const defaults = await preferences.getPreferences(accountId)
    expect(defaults).toMatchObject({
      allowRemoteCloud: false,
      defaultRoutingStrategy: 'local-first',
      preferredProviderId: null,
      monthlyBudgetMinorUnits: null,
    })
    const updated = await preferences.setPreferences({
      accountId,
      allowRemoteCloud: true,
      defaultRoutingStrategy: 'capability-first',
      preferredProviderId: cloudProviderId,
      monthlyBudgetMinorUnits: 5000,
    })
    expect(updated).toMatchObject({
      allowRemoteCloud: true,
      defaultRoutingStrategy: 'capability-first',
      preferredProviderId: cloudProviderId,
      monthlyBudgetMinorUnits: 5000,
    })
    const reloaded = await preferences.getPreferences(accountId)
    expect(reloaded).toMatchObject({allowRemoteCloud: true, monthlyBudgetMinorUnits: 5000})
    const limit = await db
      .selectFrom('ai_usage_limits')
      .selectAll()
      .where('limit_id', '=', `ai-limit-monthly-spend:${accountId}`)
      .executeTakeFirstOrThrow()
    // limit_value is NUMERIC in Postgres, so node-pg returns it as a string.
    expect(limit).toMatchObject({
      scope_type: 'account',
      scope_id: accountId,
      limit_kind: 'estimated-spend',
      unit: 'minor-currency-unit',
      enabled: true,
    })
    expect(Number(limit.limit_value)).toBe(5000)
    // Clearing the budget disables the limit row instead of deleting it.
    await preferences.setPreferences({accountId, monthlyBudgetMinorUnits: null})
    const cleared = await db
      .selectFrom('ai_usage_limits')
      .select(['enabled'])
      .where('limit_id', '=', `ai-limit-monthly-spend:${accountId}`)
      .executeTakeFirstOrThrow()
    expect(cleared.enabled).toBe(false)
    await expect(preferences.setPreferences({accountId, monthlyBudgetMinorUnits: 0}))
      .rejects.toMatchObject({code: 'VALIDATION_FAILED'})
    await expect(preferences.setPreferences({accountId, defaultRoutingStrategy: 'teleport' as never}))
      .rejects.toMatchObject({code: 'VALIDATION_FAILED'})
  })

  it('the resolver stays local until the account opts in', async () => {
    // permittedProviders scopes the test to this file's seeds, so other
    // suites' seeded models cannot change the outcome.
    const permittedProviders = [localProviderId, cloudProviderId]
    const localOnly = await resolver.resolve({
      requiredCapabilities: ['chat'],
      routingStrategy: 'local-first',
      allowRemote: false,
      permittedProviders,
    })
    expect(localOnly.providerId).toBe(localProviderId)
    expect(localOnly.modelId).toBe(localModelId)

    const optedIn = await resolver.resolve({
      requiredCapabilities: ['chat'],
      routingStrategy: 'capability-first',
      allowRemote: true,
      preferredProviderId: cloudProviderId,
      permittedProviders,
    })
    expect(optedIn.providerId).toBe(cloudProviderId)
    expect(optedIn.modelId).toBe(cloudModelId)

    await expect(resolver.resolve({
      requiredCapabilities: ['chat'],
      routingStrategy: 'fixed',
      allowRemote: false,
      preferredProviderId: cloudProviderId,
      permittedProviders,
    })).rejects.toMatchObject({code: 'CAPABILITY_DISABLED'})
  })

  it('the gateway resolves only local models until the account opts in', async () => {
    await preferences.setPreferences({accountId, allowRemoteCloud: false, preferredProviderId: null})
    await expect(gateway.createRequest({
      requestId: `ai-cloud-gate-${randomUUID()}`,
      requestingModuleId: moduleId,
      accountId,
      actorId,
      correlationId: `corr-${randomUUID()}`,
      requiredCapabilities: ['chat'],
      preferredModelId: cloudModelId,
    })).rejects.toMatchObject({code: 'CAPABILITY_DISABLED'})

    await preferences.setPreferences({accountId, allowRemoteCloud: true})
    const accepted = await gateway.createRequest({
      requestId: `ai-cloud-gate-${randomUUID()}`,
      requestingModuleId: moduleId,
      accountId,
      actorId,
      correlationId: `corr-${randomUUID()}`,
      requiredCapabilities: ['chat'],
      preferredModelId: cloudModelId,
    })
    expect(accepted.status).toBe('accepted')
    await preferences.setPreferences({accountId, allowRemoteCloud: false})
  })

  it('a monthly spend budget blocks further calls once reached', async () => {
    await preferences.setPreferences({accountId, allowRemoteCloud: true, monthlyBudgetMinorUnits: 100})
    const input = {
      accountId,
      moduleId,
      providerId: cloudProviderId,
      modelId: cloudModelId,
      estimatedInputUnits: 10,
      requestedOutputUnits: 10,
    }
    await quotas.assertWithinLimits(input)
    await quotas.recordUsage({...input, usage: {inputTokens: 10, outputTokens: 10, providerCostMinorUnits: 100, currency: 'USD'}})
    await expect(quotas.assertWithinLimits(input)).rejects.toMatchObject({code: 'AI_QUOTA_EXCEEDED'})
    await preferences.setPreferences({accountId, monthlyBudgetMinorUnits: null})
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
      display_name: 'Phase 7E AI Cloud',
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
