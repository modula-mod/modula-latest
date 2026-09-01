import {createHash} from 'node:crypto'
import type {
  GreenfieldAIModelCapability,
  GreenfieldAIModelRegistryEntry,
  GreenfieldAIProviderDefinition,
  GreenfieldAIToolDeclaration,
} from '@modula/greenfield-contracts'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import {sql, type Kysely, type Transaction} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import type {
  Database,
  GreenfieldAIModelAvailability,
  GreenfieldAIModelLifecycleStatus,
  GreenfieldAIPromptLifecycleStatus,
  GreenfieldAIProviderConfigurationMode,
  GreenfieldAIProviderKind,
  GreenfieldAIProviderStatus,
  GreenfieldAIRequestStatus,
  GreenfieldAIStreamStatus,
} from '../database/types.js'
import {uuidv7} from '../lib/uuidv7.js'
import {moduleError} from '../modules/module-errors.js'

type Db = ModulaDb | Transaction<Database> | Kysely<Database>
const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`

export type AIModelRegistrationInput = {
  modelId: string
  providerId: string
  providerKind: GreenfieldAIProviderKind
  providerModelId: string
  displayName: string
  capabilities: GreenfieldAIModelCapability[]
  availability?: GreenfieldAIModelAvailability
  lifecycleStatus?: GreenfieldAIModelLifecycleStatus
  enabled?: boolean
  policyTags?: string[]
  limits?: Record<string, unknown>
}

export type AIPromptRegistrationInput = {
  promptId: string
  version: string
  owner: string
  moduleId?: string | null
  purpose: string
  variables?: string[]
  outputSchema?: Record<string, unknown>
  safetyPolicy?: Record<string, unknown>
  lifecycleStatus?: GreenfieldAIPromptLifecycleStatus
  promptTemplate: string
}

export type AIPromptRecord = {
  promptId: string
  version: string
  owner: string
  moduleId: string | null
  purpose: string
  variables: string[]
  outputSchema: Record<string, unknown>
  safetyPolicy: Record<string, unknown>
  lifecycleStatus: GreenfieldAIPromptLifecycleStatus
  templateHash: string
  promptTemplate: string
}

export type AIModelResolution = {
  model: GreenfieldAIModelRegistryEntry
  provider: GreenfieldAIProviderDefinition
}

export type AIRequestLedgerInput = {
  requestId: string
  requestingModuleId: string
  accountId: string
  actorId?: string | null
  installationId?: string | null
  conversationId?: string | null
  correlationId: string
  providerId?: string | null
  modelId?: string | null
  promptId?: string | null
  promptVersion?: string | null
  requiredCapabilities: string[]
  policyContext?: Record<string, unknown>
  responseSchema?: Record<string, unknown>
  safetyRequirements?: Record<string, unknown>
  contextSummary?: Record<string, unknown>
  streamingRequested?: boolean
  streamingUsed?: boolean
  status: GreenfieldAIRequestStatus
  timeoutMs?: number
  failureCode?: string | null
}

export type AIRequestUsageUpdate = {
  status: GreenfieldAIRequestStatus
  latencyMs?: number | null
  inputTokens?: number | null
  outputTokens?: number | null
  estimatedCostMicrounits?: number | null
  retryCount?: number
  failureCode?: string | null
  streamingUsed?: boolean
}

export class GreenfieldAIRepository {
  constructor(private readonly db: Db) {}

  async upsertProvider(input: GreenfieldAIProviderDefinition): Promise<GreenfieldAIProviderDefinition> {
    const now = new Date()
    await this.db
      .insertInto('greenfield_ai_providers')
      .values({
        provider_id: input.providerId,
        provider_kind: input.kind,
        display_name: input.displayName,
        status: input.status,
        configuration_mode: input.configurationMode,
        capabilities: jsonb(input.capabilities),
        metadata: jsonb({managedBy: 'greenfield-ai-gateway'}),
        created_at: now,
        updated_at: now,
      })
      .onConflict(oc =>
        oc.column('provider_id').doUpdateSet({
          provider_kind: input.kind,
          display_name: input.displayName,
          status: input.status,
          configuration_mode: input.configurationMode,
          capabilities: jsonb(input.capabilities),
          updated_at: now,
        }),
      )
      .execute()
    return this.requireProvider(input.providerId)
  }

  async listProviders(): Promise<GreenfieldAIProviderDefinition[]> {
    const rows = await this.db.selectFrom('greenfield_ai_providers').selectAll().orderBy('provider_id').execute()
    return rows.map(toProviderDefinition)
  }

  async requireProvider(providerId: string): Promise<GreenfieldAIProviderDefinition> {
    const row = await this.db.selectFrom('greenfield_ai_providers').selectAll().where('provider_id', '=', providerId).executeTakeFirst()
    if (!row) throw moduleError('NOT_FOUND', 'AI provider not found')
    return toProviderDefinition(row)
  }

  async upsertModel(input: AIModelRegistrationInput): Promise<GreenfieldAIModelRegistryEntry> {
    await this.requireProvider(input.providerId)
    const now = new Date()
    await this.db
      .insertInto('greenfield_ai_models')
      .values({
        model_id: input.modelId,
        provider_id: input.providerId,
        provider_kind: input.providerKind,
        provider_model_id: input.providerModelId,
        display_name: input.displayName,
        capabilities: jsonb(uniqueStrings(input.capabilities)),
        supports_streaming: input.capabilities.includes('streaming'),
        supports_structured_outputs: input.capabilities.includes('structured-output'),
        supports_reasoning: input.capabilities.includes('reasoning'),
        supports_vision: input.capabilities.includes('vision'),
        supports_image_generation: input.capabilities.includes('image-generation'),
        supports_embeddings: input.capabilities.includes('embeddings'),
        supports_audio: input.capabilities.includes('audio'),
        availability: input.availability ?? 'available',
        lifecycle_status: input.lifecycleStatus ?? 'active',
        enabled: input.enabled ?? true,
        policy_tags: jsonb(input.policyTags ?? []),
        limits: jsonb(input.limits ?? {}),
        created_at: now,
        updated_at: now,
      })
      .onConflict(oc =>
        oc.column('model_id').doUpdateSet({
          provider_id: input.providerId,
          provider_kind: input.providerKind,
          provider_model_id: input.providerModelId,
          display_name: input.displayName,
          capabilities: jsonb(uniqueStrings(input.capabilities)),
          supports_streaming: input.capabilities.includes('streaming'),
          supports_structured_outputs: input.capabilities.includes('structured-output'),
          supports_reasoning: input.capabilities.includes('reasoning'),
          supports_vision: input.capabilities.includes('vision'),
          supports_image_generation: input.capabilities.includes('image-generation'),
          supports_embeddings: input.capabilities.includes('embeddings'),
          supports_audio: input.capabilities.includes('audio'),
          availability: input.availability ?? 'available',
          lifecycle_status: input.lifecycleStatus ?? 'active',
          enabled: input.enabled ?? true,
          policy_tags: jsonb(input.policyTags ?? []),
          limits: jsonb(input.limits ?? {}),
          updated_at: now,
        }),
      )
      .execute()
    return this.requireModel(input.modelId)
  }

  async listModels(): Promise<GreenfieldAIModelRegistryEntry[]> {
    const rows = await this.db.selectFrom('greenfield_ai_models').selectAll().orderBy('model_id').execute()
    return rows.map(toModelEntry)
  }

  async requireModel(modelId: string): Promise<GreenfieldAIModelRegistryEntry> {
    const row = await this.db.selectFrom('greenfield_ai_models').selectAll().where('model_id', '=', modelId).executeTakeFirst()
    if (!row) throw moduleError('NOT_FOUND', 'AI model not found')
    return toModelEntry(row)
  }

  async resolveModel(input: {preferredModelId?: string; requiredCapabilities: string[]}): Promise<AIModelResolution> {
    const candidates = input.preferredModelId
      ? [await this.requireModel(input.preferredModelId)]
      : await this.listModels()

    for (const model of candidates) {
      if (!model.enabled || model.availability !== 'available' || model.lifecycleStatus === 'retired') continue
      if (!capabilitiesSatisfied(model, input.requiredCapabilities)) continue
      const provider = await this.requireProvider(model.providerId)
      if (provider.status !== 'available') continue
      return {model, provider}
    }
    throw moduleError('CAPABILITY_DISABLED', 'No enabled AI model satisfies the requested capabilities')
  }

  async registerPrompt(input: AIPromptRegistrationInput): Promise<AIPromptRecord> {
    const now = new Date()
    const templateHash = sha256(input.promptTemplate)
    await this.db
      .insertInto('greenfield_ai_prompts')
      .values({
        prompt_id: input.promptId,
        version: input.version,
        owner: input.owner,
        module_id: input.moduleId ?? null,
        purpose: input.purpose,
        variables: jsonb(input.variables ?? []),
        output_schema: jsonb(input.outputSchema ?? {}),
        safety_policy: jsonb(input.safetyPolicy ?? {}),
        lifecycle_status: input.lifecycleStatus ?? 'active',
        prompt_template: input.promptTemplate,
        template_hash: templateHash,
        created_at: now,
        updated_at: now,
      })
      .onConflict(oc =>
        oc.columns(['prompt_id', 'version']).doUpdateSet({
          owner: input.owner,
          module_id: input.moduleId ?? null,
          purpose: input.purpose,
          variables: jsonb(input.variables ?? []),
          output_schema: jsonb(input.outputSchema ?? {}),
          safety_policy: jsonb(input.safetyPolicy ?? {}),
          lifecycle_status: input.lifecycleStatus ?? 'active',
          prompt_template: input.promptTemplate,
          template_hash: templateHash,
          updated_at: now,
        }),
      )
      .execute()
    return this.requirePrompt(input.promptId, input.version)
  }

  async registerPromptIfAbsent(input: AIPromptRegistrationInput): Promise<AIPromptRecord> {
    const now = new Date()
    const templateHash = sha256(input.promptTemplate)
    await this.db
      .insertInto('greenfield_ai_prompts')
      .values({
        prompt_id: input.promptId,
        version: input.version,
        owner: input.owner,
        module_id: input.moduleId ?? null,
        purpose: input.purpose,
        variables: jsonb(input.variables ?? []),
        output_schema: jsonb(input.outputSchema ?? {}),
        safety_policy: jsonb(input.safetyPolicy ?? {}),
        lifecycle_status: input.lifecycleStatus ?? 'active',
        prompt_template: input.promptTemplate,
        template_hash: templateHash,
        created_at: now,
        updated_at: now,
      })
      .onConflict(oc => oc.columns(['prompt_id', 'version']).doNothing())
      .execute()
    return this.requirePrompt(input.promptId, input.version)
  }

  async requirePrompt(promptId: string, version?: string): Promise<AIPromptRecord> {
    const query = this.db.selectFrom('greenfield_ai_prompts').selectAll().where('prompt_id', '=', promptId)
    const row = version
      ? await query.where('version', '=', version).executeTakeFirst()
      : await query.where('lifecycle_status', '=', 'active').orderBy('created_at', 'desc').executeTakeFirst()
    if (!row) throw moduleError('NOT_FOUND', 'AI prompt not found')
    return toPromptRecord(row)
  }

  async createRequestLedger(input: AIRequestLedgerInput): Promise<void> {
    const now = new Date()
    await this.db
      .insertInto('greenfield_ai_request_ledger')
      .values({
        request_id: input.requestId,
        requesting_module_id: input.requestingModuleId,
        account_id: input.accountId,
        actor_id: input.actorId ?? null,
        installation_id: input.installationId ?? null,
        conversation_id: input.conversationId ?? null,
        correlation_id: input.correlationId,
        provider_id: input.providerId ?? null,
        model_id: input.modelId ?? null,
        prompt_id: input.promptId ?? null,
        prompt_version: input.promptVersion ?? null,
        required_capabilities: jsonb(input.requiredCapabilities),
        policy_context: jsonb(input.policyContext ?? {}),
        response_schema: jsonb(input.responseSchema ?? {}),
        safety_requirements: jsonb(input.safetyRequirements ?? {}),
        context_summary: jsonb(input.contextSummary ?? {}),
        streaming_requested: input.streamingRequested ?? false,
        streaming_used: input.streamingUsed ?? false,
        status: input.status,
        timeout_ms: input.timeoutMs ?? 30_000,
        latency_ms: null,
        input_tokens: null,
        output_tokens: null,
        total_tokens: null,
        estimated_cost_microunits: null,
        retry_count: 0,
        failure_code: input.failureCode ?? null,
        started_at: input.status === 'accepted' || input.status === 'running' ? now : null,
        completed_at: input.status === 'denied' || input.status === 'failed' || input.status === 'cancelled' ? now : null,
        created_at: now,
        updated_at: now,
      })
      .execute()
  }

  async updateRequestUsage(requestId: string, input: AIRequestUsageUpdate): Promise<void> {
    const inputTokens = input.inputTokens ?? null
    const outputTokens = input.outputTokens ?? null
    const totalTokens = inputTokens === null && outputTokens === null ? null : (inputTokens ?? 0) + (outputTokens ?? 0)
    await this.db
      .updateTable('greenfield_ai_request_ledger')
      .set({
        status: input.status,
        latency_ms: input.latencyMs ?? null,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        estimated_cost_microunits: input.estimatedCostMicrounits ?? null,
        retry_count: input.retryCount ?? 0,
        failure_code: input.failureCode ?? null,
        streaming_used: input.streamingUsed ?? undefined,
        completed_at: ['completed', 'failed', 'cancelled', 'denied'].includes(input.status) ? new Date() : null,
        updated_at: new Date(),
      })
      .where('request_id', '=', requestId)
      .execute()
  }

  async declareTool(input: GreenfieldAIToolDeclaration & {installationId?: string | null}): Promise<GreenfieldAIToolDeclaration> {
    const now = new Date()
    await this.db
      .insertInto('greenfield_ai_tool_declarations')
      .values({
        tool_id: input.toolId,
        module_id: input.moduleId,
        installation_id: input.installationId ?? null,
        version: input.version,
        description: input.description,
        input_schema: jsonb(input.inputSchema),
        output_schema: jsonb(input.outputSchema ?? {}),
        side_effects: input.sideEffects,
        confirmation: input.confirmation,
        required_permissions: jsonb(input.requiredPermissions),
        lifecycle_status: input.lifecycleStatus,
        created_at: now,
        updated_at: now,
      })
      .onConflict(oc =>
        oc.column('tool_id').doUpdateSet({
          module_id: input.moduleId,
          installation_id: input.installationId ?? null,
          version: input.version,
          description: input.description,
          input_schema: jsonb(input.inputSchema),
          output_schema: jsonb(input.outputSchema ?? {}),
          side_effects: input.sideEffects,
          confirmation: input.confirmation,
          required_permissions: jsonb(input.requiredPermissions),
          lifecycle_status: input.lifecycleStatus,
          updated_at: now,
        }),
      )
      .execute()
    return this.requireTool(input.toolId)
  }

  async requireTool(toolId: string): Promise<GreenfieldAIToolDeclaration & {installationId: string | null}> {
    const row = await this.db.selectFrom('greenfield_ai_tool_declarations').selectAll().where('tool_id', '=', toolId).executeTakeFirst()
    if (!row) throw moduleError('NOT_FOUND', 'AI tool declaration not found')
    return {
      toolId: row.tool_id,
      moduleId: row.module_id,
      installationId: row.installation_id,
      version: row.version,
      description: row.description,
      inputSchema: recordFromJson(row.input_schema),
      outputSchema: recordFromJson(row.output_schema),
      sideEffects: row.side_effects,
      confirmation: row.confirmation,
      requiredPermissions: arrayOfStrings(row.required_permissions),
      lifecycleStatus: row.lifecycle_status,
    }
  }

  async createToolRun(input: {
    requestId?: string | null
    toolId: string
    moduleId: string
    installationId?: string | null
    accountId: string
    actorId?: string | null
    arguments: unknown
    status: Database['greenfield_ai_tool_runs']['status']
    confirmationStatus: Database['greenfield_ai_tool_runs']['confirmation_status']
    failureCode?: string | null
    details?: Record<string, unknown>
  }): Promise<string> {
    const toolRunId = `ai-tool-run-${uuidv7()}`
    await this.db
      .insertInto('greenfield_ai_tool_runs')
      .values({
        tool_run_id: toolRunId,
        request_id: input.requestId ?? null,
        tool_id: input.toolId,
        module_id: input.moduleId,
        installation_id: input.installationId ?? null,
        account_id: input.accountId,
        actor_id: input.actorId ?? null,
        argument_hash: sha256(canonicalJsonStringify(input.arguments)),
        status: input.status,
        confirmation_status: input.confirmationStatus,
        failure_code: input.failureCode ?? null,
        redacted_details: jsonb(input.details ?? {}),
        created_at: new Date(),
        completed_at: input.status === 'completed' || input.status === 'failed' || input.status === 'denied' ? new Date() : null,
      })
      .execute()
    return toolRunId
  }

  async updateToolRun(input: {
    toolRunId: string
    status: Database['greenfield_ai_tool_runs']['status']
    failureCode?: string | null
    details?: Record<string, unknown>
  }): Promise<void> {
    await this.db
      .updateTable('greenfield_ai_tool_runs')
      .set({
        status: input.status,
        failure_code: input.failureCode ?? null,
        redacted_details: input.details ? jsonb(input.details) : undefined,
        completed_at: ['completed', 'failed', 'denied'].includes(input.status) ? new Date() : undefined,
      })
      .where('tool_run_id', '=', input.toolRunId)
      .execute()
  }

  async createStream(input: {
    streamId?: string
    requestId: string
    accountId: string
    actorId?: string | null
    moduleId: string
    correlationId: string
  }): Promise<string> {
    const streamId = input.streamId ?? `ai-stream-${uuidv7()}`
    const now = new Date()
    await this.db
      .insertInto('greenfield_ai_streams')
      .values({
        stream_id: streamId,
        request_id: input.requestId,
        account_id: input.accountId,
        actor_id: input.actorId ?? null,
        module_id: input.moduleId,
        correlation_id: input.correlationId,
        status: 'open',
        last_sequence: 0,
        structured_completion: jsonb({}),
        usage_delta: jsonb({}),
        cancellation_requested_at: null,
        reconnect_expires_at: new Date(now.getTime() + 15 * 60_000),
        created_at: now,
        updated_at: now,
        completed_at: null,
      })
      .execute()
    return streamId
  }

  async updateStream(input: {
    streamId: string
    status?: GreenfieldAIStreamStatus
    lastSequence?: number
    structuredCompletion?: Record<string, unknown>
    usageDelta?: Record<string, unknown>
    cancellationRequested?: boolean
  }): Promise<void> {
    const terminal = input.status === 'completed' || input.status === 'cancelled' || input.status === 'failed'
    await this.db
      .updateTable('greenfield_ai_streams')
      .set({
        status: input.status,
        last_sequence: input.lastSequence,
        structured_completion: input.structuredCompletion ? jsonb(input.structuredCompletion) : undefined,
        usage_delta: input.usageDelta ? jsonb(input.usageDelta) : undefined,
        cancellation_requested_at: input.cancellationRequested ? new Date() : undefined,
        updated_at: new Date(),
        completed_at: terminal ? new Date() : undefined,
      })
      .where('stream_id', '=', input.streamId)
      .execute()
  }

  async requireStream(streamId: string): Promise<Database['greenfield_ai_streams']> {
    const row = await this.db.selectFrom('greenfield_ai_streams').selectAll().where('stream_id', '=', streamId).executeTakeFirst()
    if (!row) throw moduleError('NOT_FOUND', 'AI stream not found')
    return row
  }
}

export function toProviderDefinition(row: Database['greenfield_ai_providers']): GreenfieldAIProviderDefinition {
  return {
    providerId: row.provider_id,
    kind: row.provider_kind,
    displayName: row.display_name,
    status: row.status,
    configurationMode: row.configuration_mode,
    capabilities: arrayOfStrings(row.capabilities) as GreenfieldAIModelCapability[],
  }
}

export function toModelEntry(row: Database['greenfield_ai_models']): GreenfieldAIModelRegistryEntry {
  return {
    modelId: row.model_id,
    providerId: row.provider_id,
    providerKind: row.provider_kind,
    providerModelId: row.provider_model_id,
    displayName: row.display_name,
    capabilities: arrayOfStrings(row.capabilities) as GreenfieldAIModelCapability[],
    supportsStreaming: row.supports_streaming,
    supportsStructuredOutputs: row.supports_structured_outputs,
    supportsReasoning: row.supports_reasoning,
    supportsVision: row.supports_vision,
    supportsImageGeneration: row.supports_image_generation,
    supportsEmbeddings: row.supports_embeddings,
    supportsAudio: row.supports_audio,
    availability: row.availability,
    lifecycleStatus: row.lifecycle_status,
    enabled: row.enabled,
  }
}

export function toPromptRecord(row: Database['greenfield_ai_prompts']): AIPromptRecord {
  return {
    promptId: row.prompt_id,
    version: row.version,
    owner: row.owner,
    moduleId: row.module_id,
    purpose: row.purpose,
    variables: arrayOfStrings(row.variables),
    outputSchema: recordFromJson(row.output_schema),
    safetyPolicy: recordFromJson(row.safety_policy),
    lifecycleStatus: row.lifecycle_status,
    templateHash: row.template_hash,
    promptTemplate: row.prompt_template,
  }
}

export function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function recordFromJson(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values))
}

function capabilitiesSatisfied(model: GreenfieldAIModelRegistryEntry, requiredCapabilities: readonly string[]): boolean {
  const capabilities = new Set(model.capabilities)
  for (const capability of requiredCapabilities) {
    if (capability === 'streaming' && model.supportsStreaming) continue
    if (capability === 'structured-output' && model.supportsStructuredOutputs) continue
    if (capability === 'reasoning' && model.supportsReasoning) continue
    if (capability === 'vision' && model.supportsVision) continue
    if (capability === 'image-generation' && model.supportsImageGeneration) continue
    if (capability === 'embeddings' && model.supportsEmbeddings) continue
    if (capability === 'audio' && model.supportsAudio) continue
    if (!capabilities.has(capability as GreenfieldAIModelCapability)) return false
  }
  return true
}
