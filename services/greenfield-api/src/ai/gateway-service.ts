import type {GreenfieldAIModelCapability, GreenfieldAIRequestContract} from '@modula/greenfield-contracts'
import type {ModulaDb} from '../database/client.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {GreenfieldPolicyEngine} from '../domains/policy/index.js'
import {GreenfieldEventBus} from '../events/index.js'
import {uuidv7} from '../lib/uuidv7.js'
import {moduleError} from '../modules/module-errors.js'
import {GreenfieldAIContextBuilder} from './context-builder.js'
import {GreenfieldAIRepository, recordFromJson} from './repository.js'

const PROVIDER_BOUND_KEYS = new Set(['provider', 'providerId', 'providerKind', 'providerPayload', 'providerOptions', 'modelProvider'])

export type GreenfieldAIGatewayAcceptedRequest = {
  requestId: string
  correlationId: string
  status: 'accepted'
  requestingModuleId: string
  prompt?: {promptId: string; version: string; templateHash: string}
  structuredOutput: boolean
  streaming: {requested: boolean; streamId?: string}
  context: {
    allowedResourceCount: number
    redactedResourceCount: number
    transientKeys: string[]
  }
  policy: {code: string; auditRequired: boolean}
}

export class GreenfieldAIGatewayService {
  private readonly repository: GreenfieldAIRepository
  private readonly policies: GreenfieldPolicyEngine
  private readonly audit: AuditRepository
  private readonly events: GreenfieldEventBus
  private readonly contextBuilder: GreenfieldAIContextBuilder

  constructor(private readonly db: ModulaDb) {
    this.repository = new GreenfieldAIRepository(db)
    this.policies = new GreenfieldPolicyEngine(db)
    this.audit = new AuditRepository(db)
    this.events = new GreenfieldEventBus(db)
    this.contextBuilder = new GreenfieldAIContextBuilder(db)
  }

  async createRequest(input: GreenfieldAIRequestContract): Promise<GreenfieldAIGatewayAcceptedRequest> {
    rejectProviderBoundPayload(input)
    const requestId = boundedId(input.requestId, `ai-request-${uuidv7()}`)
    const correlationId = boundedId(input.correlationId, requestId)
    const actorId = input.actorId ?? await this.actorIdForAccount(input.accountId)
    const timeoutMs = clampTimeout(input.timeoutMs)
    const prompt = input.prompt ? await this.repository.requirePrompt(input.prompt.promptId, input.prompt.version) : undefined
    if (prompt) validatePromptVariables(prompt.variables, input.prompt?.variables ?? {})

    const responseSchema = validateResponseSchema(input.responseSchema ?? prompt?.outputSchema ?? {})
    const requiredCapabilities = normalizeCapabilities(input.requiredCapabilities, {
      streaming: Boolean(input.stream),
      structuredOutput: Object.keys(responseSchema).length > 0,
      tools: Boolean(input.tools?.length),
    })

    const decision = await this.policies.evaluateAndAudit({
      actorId,
      accountId: input.accountId,
      moduleId: input.requestingModuleId,
      action: 'ai.request.create',
      riskClassification: riskClassification(input.safetyRequirements),
      currentState: typeof input.policyContext?.currentState === 'string' ? input.policyContext.currentState : undefined,
      requestContext: {requestId, correlationId},
    })
    if (!decision.allowed) {
      await this.repository.createRequestLedger({
        requestId,
        requestingModuleId: input.requestingModuleId,
        accountId: input.accountId,
        actorId,
        installationId: input.installationId,
        conversationId: input.conversationId,
        correlationId,
        promptId: prompt?.promptId,
        promptVersion: prompt?.version,
        requiredCapabilities,
        policyContext: input.policyContext,
        responseSchema,
        safetyRequirements: input.safetyRequirements,
        streamingRequested: Boolean(input.stream),
        status: 'denied',
        timeoutMs,
        failureCode: decision.code,
      })
      throw moduleError('FORBIDDEN', `AI request denied by policy: ${decision.code}`)
    }

    const model = await this.repository.resolveModel({
      preferredModelId: input.preferredModelId,
      requiredCapabilities,
    })
    const context = await this.contextBuilder.build({
      accountId: input.accountId,
      actorId,
      moduleId: input.requestingModuleId,
      resources: input.context?.resources,
      transient: input.context?.transient,
      conversationHistoryRef: input.context?.conversationHistoryRef,
      systemInstructionRefs: input.context?.systemInstructionRefs,
      requestId,
      correlationId,
    })
    await this.repository.createRequestLedger({
      requestId,
      requestingModuleId: input.requestingModuleId,
      accountId: input.accountId,
      actorId,
      installationId: input.installationId,
      conversationId: input.conversationId,
      correlationId,
      providerId: model.provider.providerId,
      modelId: model.model.modelId,
      promptId: prompt?.promptId,
      promptVersion: prompt?.version,
      requiredCapabilities,
      policyContext: input.policyContext,
      responseSchema,
      safetyRequirements: input.safetyRequirements,
      contextSummary: {
        allowedResources: context.allowedResources.length,
        redactedResources: context.redactedResources.length,
        transientKeys: context.transientKeys,
        systemInstructionRefs: context.systemInstructionRefs,
        conversationHistoryRef: context.conversationHistoryRef,
      },
      streamingRequested: Boolean(input.stream),
      status: 'accepted',
      timeoutMs,
    })
    let streamId: string | undefined
    if (input.stream) {
      streamId = await this.repository.createStream({
        requestId,
        accountId: input.accountId,
        actorId,
        moduleId: input.requestingModuleId,
        correlationId,
      })
      await this.repository.updateRequestUsage(requestId, {status: 'running', streamingUsed: true})
    }
    await this.audit.append(
      'ai.request.accepted',
      {
        requestId,
        moduleId: input.requestingModuleId,
        modelId: model.model.modelId,
        promptId: prompt?.promptId,
        promptVersion: prompt?.version,
        requiredCapabilities,
        structuredOutput: Object.keys(responseSchema).length > 0,
        streaming: Boolean(input.stream),
      },
      {type: 'aiRequest', id: requestId, actorId},
      {accountId: input.accountId, requestId, correlationId},
    )
    await this.events.publish({
      eventType: 'ai.requested',
      aggregateType: 'aiRequest',
      aggregateId: requestId,
      accountId: input.accountId,
      actorId,
      requestId,
      correlationId,
      idempotencyKey: requestId,
      visibility: 'internal',
      classification: 'sensitive',
      payload: {
        requestId,
        moduleId: input.requestingModuleId,
        modelId: model.model.modelId,
        promptId: prompt?.promptId,
        structuredOutput: Object.keys(responseSchema).length > 0,
        streaming: Boolean(input.stream),
      },
    })
    return {
      requestId,
      correlationId,
      status: 'accepted',
      requestingModuleId: input.requestingModuleId,
      prompt: prompt ? {promptId: prompt.promptId, version: prompt.version, templateHash: prompt.templateHash} : undefined,
      structuredOutput: Object.keys(responseSchema).length > 0,
      streaming: {requested: Boolean(input.stream), streamId},
      context: {
        allowedResourceCount: context.allowedResources.length,
        redactedResourceCount: context.redactedResources.length,
        transientKeys: context.transientKeys,
      },
      policy: {code: decision.code, auditRequired: decision.auditRequired},
    }
  }

  async completeRequest(input: {
    requestId: string
    latencyMs: number
    inputTokens?: number
    outputTokens?: number
    estimatedCostMicrounits?: number
  }): Promise<void> {
    await this.repository.updateRequestUsage(input.requestId, {
      status: 'completed',
      latencyMs: input.latencyMs,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      estimatedCostMicrounits: input.estimatedCostMicrounits,
    })
    const row = await this.db.selectFrom('greenfield_ai_request_ledger').selectAll().where('request_id', '=', input.requestId).executeTakeFirstOrThrow()
    await this.events.publish({
      eventType: 'ai.completed',
      aggregateType: 'aiRequest',
      aggregateId: input.requestId,
      accountId: row.account_id,
      actorId: row.actor_id,
      requestId: row.request_id,
      correlationId: row.correlation_id,
      idempotencyKey: `${input.requestId}:completed`,
      visibility: 'internal',
      classification: 'sensitive',
      payload: {
        requestId: input.requestId,
        moduleId: row.requesting_module_id,
        modelId: row.model_id,
        promptId: row.prompt_id,
        totalTokens: (input.inputTokens ?? 0) + (input.outputTokens ?? 0),
      },
    })
  }

  private async actorIdForAccount(accountId: string): Promise<string | null> {
    const row = await this.db.selectFrom('actors').select('id').where('account_id', '=', accountId).orderBy('created_at', 'asc').executeTakeFirst()
    return row?.id ?? null
  }
}

function rejectProviderBoundPayload(input: object): void {
  for (const key of Object.keys(input as Record<string, unknown>)) {
    if (PROVIDER_BOUND_KEYS.has(key)) throw moduleError('VALIDATION_FAILED', 'AI requests must use Greenfield gateway contracts, not provider payloads')
  }
}

function normalizeCapabilities(
  capabilities: readonly GreenfieldAIModelCapability[] | undefined,
  implied: {streaming: boolean; structuredOutput: boolean; tools: boolean},
): GreenfieldAIModelCapability[] {
  const output = new Set<GreenfieldAIModelCapability>(capabilities ?? [])
  if (implied.streaming) output.add('streaming')
  if (implied.structuredOutput) output.add('structured-output')
  if (implied.tools) output.add('tool-calling')
  if (output.size === 0) output.add('chat')
  return Array.from(output)
}

function validatePromptVariables(required: readonly string[], variables: Record<string, unknown>): void {
  for (const variable of required) {
    if (!(variable in variables)) throw moduleError('VALIDATION_FAILED', `Missing AI prompt variable: ${variable}`)
  }
}

function validateResponseSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const normalized = recordFromJson(schema)
  if (Object.keys(normalized).length === 0) return {}
  if (normalized.type !== undefined && normalized.type !== 'object') throw moduleError('VALIDATION_FAILED', 'AI response schema must describe an object')
  if (normalized.required !== undefined && !Array.isArray(normalized.required)) throw moduleError('VALIDATION_FAILED', 'AI response schema required must be an array')
  return normalized
}

function riskClassification(safety?: Record<string, unknown>): string | undefined {
  const explicit = safety?.riskClassification
  if (typeof explicit === 'string') return explicit
  if (safety?.restricted === true) return 'restricted'
  if (safety?.sensitive === true) return 'sensitive'
  return undefined
}

function boundedId(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, 160) : fallback
}

function clampTimeout(value: number | undefined): number {
  if (!Number.isFinite(value)) return 30_000
  return Math.max(1000, Math.min(120_000, Math.trunc(value!)))
}
