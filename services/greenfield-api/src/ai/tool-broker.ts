import type {GreenfieldAIToolDeclaration} from '@modula/greenfield-contracts'
import type {ModulaDb} from '../database/client.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {GreenfieldPolicyEngine} from '../domains/policy/index.js'
import {GreenfieldEventBus} from '../events/index.js'
import {moduleError} from '../modules/module-errors.js'
import {arrayOfStrings, GreenfieldAIRepository, recordFromJson} from './repository.js'
import {validateStructuredOutput} from './schema-validator.js'

export type SafeAIToolExecutionResult =
  | {toolRunId: string; status: 'confirmation_required'; result?: undefined}
  | {toolRunId: string; status: 'completed'; result: Record<string, unknown>}

export class GreenfieldAIToolBroker {
  private readonly repository: GreenfieldAIRepository
  private readonly policies: GreenfieldPolicyEngine
  private readonly audit: AuditRepository
  private readonly events: GreenfieldEventBus

  constructor(private readonly db: ModulaDb) {
    this.repository = new GreenfieldAIRepository(db)
    this.policies = new GreenfieldPolicyEngine(db)
    this.audit = new AuditRepository(db)
    this.events = new GreenfieldEventBus(db)
  }

  declareTool(input: GreenfieldAIToolDeclaration & {installationId?: string | null}) {
    validateToolDeclaration(input)
    return this.repository.declareTool(input)
  }

  async validateAndRecord(input: {
    requestId?: string | null
    toolId: string
    accountId: string
    actorId?: string | null
    arguments: Record<string, unknown>
    grantedPermissions?: string[]
    confirmed?: boolean
    requestContext?: {requestId?: string; correlationId?: string}
  }): Promise<{toolRunId: string; status: 'validated' | 'confirmation_required' | 'completed'}> {
    const tool = await this.repository.requireTool(input.toolId)
    if (tool.lifecycleStatus !== 'active') throw moduleError('CAPABILITY_DISABLED', 'AI tool is not active')
    validateArguments(tool.inputSchema, input.arguments)
    const granted = new Set(input.grantedPermissions ?? [])
    for (const permission of tool.requiredPermissions) {
      if (!granted.has(permission)) throw moduleError('FORBIDDEN', `AI tool permission denied: ${permission}`)
    }
    await this.policies.assertAllowed({
      accountId: input.accountId,
      actorId: input.actorId ?? null,
      moduleId: tool.moduleId,
      action: 'ai.tool.call',
      capability: tool.toolId,
      riskClassification: tool.sideEffects === 'none' ? undefined : 'sensitive',
      requestContext: input.requestContext,
    })
    const needsConfirmation = tool.confirmation !== 'none' || tool.sideEffects === 'financial' || tool.sideEffects === 'destructive'
    if (needsConfirmation && !input.confirmed) {
      const toolRunId = await this.repository.createToolRun({
        requestId: input.requestId,
        toolId: tool.toolId,
        moduleId: tool.moduleId,
        installationId: tool.installationId,
        accountId: input.accountId,
        actorId: input.actorId,
        arguments: input.arguments,
        status: 'confirmation_required',
        confirmationStatus: 'required',
        details: {sideEffects: tool.sideEffects, confirmation: tool.confirmation},
      })
      await this.auditTool(input, tool, toolRunId, 'confirmation_required')
      await this.publishToolEvent(input, tool, toolRunId, 'ai.tool-requested')
      return {toolRunId, status: 'confirmation_required'}
    }

    const toolRunId = await this.repository.createToolRun({
      requestId: input.requestId,
      toolId: tool.toolId,
      moduleId: tool.moduleId,
      installationId: tool.installationId,
      accountId: input.accountId,
      actorId: input.actorId,
      arguments: input.arguments,
      status: needsConfirmation ? 'completed' : 'validated',
      confirmationStatus: needsConfirmation ? 'confirmed' : 'not-required',
      details: {sideEffects: tool.sideEffects, confirmation: tool.confirmation},
    })
    await this.auditTool(input, tool, toolRunId, needsConfirmation ? 'completed' : 'validated')
    await this.publishToolEvent(input, tool, toolRunId, needsConfirmation ? 'ai.tool-completed' : 'ai.tool-requested')
    return {toolRunId, status: needsConfirmation ? 'completed' : 'validated'}
  }

  async executeSafeTool(input: {
    requestId?: string | null
    toolId: string
    accountId: string
    actorId?: string | null
    arguments: Record<string, unknown>
    grantedPermissions?: string[]
    confirmed?: boolean
    executionToolCallCount?: number
    maxToolCallCount?: number
    requestContext?: {requestId?: string; correlationId?: string}
  }): Promise<SafeAIToolExecutionResult> {
    if ((input.executionToolCallCount ?? 0) >= (input.maxToolCallCount ?? 1)) {
      throw moduleError('CAPABILITY_DISABLED', 'AI tool-call limit exceeded')
    }
    const granted = new Set(input.grantedPermissions ?? [])
    if (!granted.has('ai.tools.execute')) throw moduleError('FORBIDDEN', 'AI tool execution permission denied: ai.tools.execute')

    const tool = await this.repository.requireTool(input.toolId)
    if (tool.sideEffects !== 'none') throw moduleError('CAPABILITY_DISABLED', 'Only read-only AI tools may execute in this phase')
    if (!isSafeExecutableTool(tool.toolId)) throw moduleError('CAPABILITY_DISABLED', 'AI tool execution is limited to approved deterministic tools')

    const validation = await this.validateAndRecord(input)
    if (validation.status === 'confirmation_required') return {toolRunId: validation.toolRunId, status: 'confirmation_required'}

    try {
      const result = executeDeterministicTool(tool, input.arguments)
      const outputValidation = validateStructuredOutput(recordFromJson(tool.outputSchema), result)
      if (!outputValidation.valid) {
        throw moduleError('VALIDATION_FAILED', `AI tool output failed schema validation: ${outputValidation.errors[0] ?? 'invalid output'}`)
      }
      await this.repository.updateToolRun({
        toolRunId: validation.toolRunId,
        status: 'completed',
        details: {
          sideEffects: tool.sideEffects,
          confirmation: tool.confirmation,
          outputKeys: Object.keys(result).sort(),
        },
      })
      await this.auditTool(input, tool, validation.toolRunId, 'completed')
      await this.publishToolEvent(input, tool, validation.toolRunId, 'ai.tool-completed')
      return {toolRunId: validation.toolRunId, status: 'completed', result: sanitizeToolResult(result)}
    } catch (error) {
      await this.repository.updateToolRun({
        toolRunId: validation.toolRunId,
        status: 'failed',
        failureCode: error instanceof Error ? error.name : 'TOOL_EXECUTION_FAILED',
        details: {sideEffects: tool.sideEffects, confirmation: tool.confirmation},
      })
      throw error
    }
  }

  private async auditTool(
    input: {accountId: string; actorId?: string | null; requestContext?: {requestId?: string; correlationId?: string}},
    tool: GreenfieldAIToolDeclaration & {installationId: string | null},
    toolRunId: string,
    status: string,
  ) {
    await this.audit.append(
      'ai.tool.validated',
      {
        toolRunId,
        toolId: tool.toolId,
        moduleId: tool.moduleId,
        status,
        sideEffects: tool.sideEffects,
        confirmation: tool.confirmation,
      },
      {type: 'aiToolRun', id: toolRunId, actorId: input.actorId ?? null},
      {
        accountId: input.accountId,
        requestId: input.requestContext?.requestId ?? null,
        correlationId: input.requestContext?.correlationId ?? input.requestContext?.requestId ?? null,
      },
    )
  }

  private async publishToolEvent(
    input: {requestId?: string | null; accountId: string; actorId?: string | null; requestContext?: {requestId?: string; correlationId?: string}},
    tool: GreenfieldAIToolDeclaration & {installationId: string | null},
    toolRunId: string,
    eventType: string,
  ) {
    const requestId = input.requestContext?.requestId ?? input.requestId ?? toolRunId
    await this.events.publish({
      eventType,
      aggregateType: 'aiToolRun',
      aggregateId: toolRunId,
      accountId: input.accountId,
      actorId: input.actorId ?? null,
      requestId,
      correlationId: input.requestContext?.correlationId ?? requestId,
      idempotencyKey: `${toolRunId}:${eventType}`,
      visibility: 'internal',
      classification: 'restricted',
      payload: {
        toolRunId,
        toolId: tool.toolId,
        moduleId: tool.moduleId,
        sideEffects: tool.sideEffects,
        confirmation: tool.confirmation,
      },
    })
  }
}

function validateToolDeclaration(input: GreenfieldAIToolDeclaration): void {
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(input.toolId)) throw moduleError('VALIDATION_FAILED', 'AI toolId must be a lowercase dotted identifier')
  if (!input.toolId.startsWith(`${input.moduleId}.`) && !input.toolId.includes('.')) {
    throw moduleError('VALIDATION_FAILED', 'AI toolId must be module-scoped')
  }
  if (!input.description.trim()) throw moduleError('VALIDATION_FAILED', 'AI tool description is required')
  const normalized = recordFromJson(input.inputSchema)
  if (normalized.type !== undefined && normalized.type !== 'object') throw moduleError('VALIDATION_FAILED', 'AI tool input schema must describe an object')
  arrayOfStrings(normalized.required)
}

function validateArguments(schema: Record<string, unknown>, args: Record<string, unknown>): void {
  const normalized = recordFromJson(schema)
  if (normalized.type !== undefined && normalized.type !== 'object') throw moduleError('VALIDATION_FAILED', 'AI tool input schema must describe an object')
  for (const key of arrayOfStrings(normalized.required)) {
    if (!(key in args)) throw moduleError('VALIDATION_FAILED', `Missing AI tool argument: ${key}`)
  }
}

function isSafeExecutableTool(toolId: string): boolean {
  return toolId === 'greenfield.metadata.read' || toolId.endsWith('.test.read')
}

function executeDeterministicTool(
  tool: GreenfieldAIToolDeclaration & {installationId: string | null},
  args: Record<string, unknown>,
): Record<string, unknown> {
  if (tool.toolId === 'greenfield.metadata.read') {
    return {
      platform: 'greenfield',
      capability: 'ai-provider-runtime',
      moduleId: tool.moduleId,
      installationScoped: Boolean(tool.installationId),
      requestedKeys: Object.keys(args).sort(),
    }
  }
  if (tool.toolId.endsWith('.test.read')) {
    return {
      toolId: tool.toolId,
      moduleId: tool.moduleId,
      accepted: true,
      argumentKeys: Object.keys(args).sort(),
    }
  }
  throw moduleError('CAPABILITY_DISABLED', 'Unsupported AI tool')
}

function sanitizeToolResult(result: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string' && /(?:api[_-]?key|token|secret|credential)/i.test(key)) output[key] = '[redacted]'
    else output[key] = value
  }
  return output
}
