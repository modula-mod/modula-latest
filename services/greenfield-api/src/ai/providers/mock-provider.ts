import type {GreenfieldAIExecutionFailureCode, GreenfieldAIJsonSchema, GreenfieldAIModelCapability} from '@modula/greenfield-contracts'
import {
  estimateTextUnits,
  ProviderExecutionError,
  type DiscoveredAIModel,
  type GreenfieldAIProviderAdapter,
  type ProviderExecutionContext,
  type ProviderExecutionRequest,
  type ProviderExecutionResult,
  type ProviderHealthResult,
  type ProviderStreamEvent,
} from './contract.js'

export class MockGreenfieldAIProviderAdapter implements GreenfieldAIProviderAdapter {
  constructor(readonly providerId: string) {}

  async discoverModels(): Promise<DiscoveredAIModel[]> {
    return [{
      modelId: 'greenfield.mock.deterministic',
      providerModelId: 'mock-deterministic-v1',
      displayName: 'Deterministic Mock Model',
      capabilities: ['chat', 'text-generation', 'streaming', 'structured-output', 'tool-calling'],
      supportsStreaming: true,
      supportsStructuredOutputs: true,
      enabledByDefault: true,
    }]
  }

  async execute(request: ProviderExecutionRequest, context: ProviderExecutionContext = {providerId: this.providerId}): Promise<ProviderExecutionResult> {
    maybeThrowConfiguredFailure(request)
    const toolResult = await executeRequestedTool(request, context)
    const outputText = request.structuredOutput
      ? JSON.stringify(mockStructuredPayload(request.outputSchema ?? {}, request.metadata))
      : deterministicText(request, toolResult?.result)
    const structuredOutput = request.structuredOutput ? parseObject(outputText) : undefined
    return {
      providerRequestId: `mock-response:${request.executionId}`,
      outputText,
      structuredOutput,
      usage: {
        inputTokens: estimateTextUnits(request.messages.map(message => message.content).join('\n')),
        outputTokens: estimateTextUnits(outputText),
        providerCostMinorUnits: 0,
        currency: 'USD',
      },
      responseMetadata: {
        providerMode: 'development-mock',
        deterministic: true,
        toolRunId: toolResult?.toolRunId,
      },
    }
  }

  async *stream(request: ProviderExecutionRequest, context: ProviderExecutionContext = {providerId: this.providerId}): AsyncIterable<ProviderStreamEvent> {
    maybeThrowConfiguredFailure(request)
    yield {type: 'execution.started', metadata: {providerMode: 'development-mock'}}
    yield {type: 'reasoning.status', status: 'analysing'}
    if (request.toolIds.length > 0) {
      yield {type: 'tool.requested', toolId: request.toolIds[0]!, callId: `${request.executionId}:tool:1`, arguments: {metadata: true}}
    }
    const executed = await this.execute({...request, stream: false}, context)
    for (const delta of splitDeltas(executed.outputText)) {
      if (request.metadata.mockCancelAfterFirstDelta === true) {
        yield {type: 'execution.cancelled'}
        return
      }
      yield {type: 'content.delta', delta}
    }
    yield {type: 'usage.updated', usage: executed.usage}
    yield {
      type: 'execution.completed',
      outputText: executed.outputText,
      structuredOutput: executed.structuredOutput,
      usage: executed.usage,
      metadata: executed.responseMetadata,
    }
  }

  async cancel(): Promise<void> {}

  async health(): Promise<ProviderHealthResult> {
    return {
      state: 'healthy',
      components: {
        configuration: 'configured',
        credentials: 'not-required',
        network: 'local',
        'model-discovery': 'available',
        execution: 'available',
        streaming: 'available',
        'structured-output': 'available',
      },
      configuredModelCount: 1,
      diagnostics: {deterministic: true},
    }
  }
}

function deterministicText(request: ProviderExecutionRequest, toolResult?: Record<string, unknown>): string {
  const lastUser = [...request.messages].reverse().find(message => message.role === 'user')?.content ?? 'empty'
  const toolSuffix = toolResult ? `:tool:${stablePreview(JSON.stringify(toolResult))}` : ''
  return `mock:${request.moduleId}:${stablePreview(lastUser)}${toolSuffix}`
}

async function executeRequestedTool(
  request: ProviderExecutionRequest,
  context: ProviderExecutionContext,
): Promise<{toolRunId: string; result: Record<string, unknown>} | null> {
  const toolId = request.toolIds[0]
  if (!toolId || !context.executeTool) return null
  const result = await context.executeTool({
    toolId,
    callId: `${request.executionId}:tool:1`,
    arguments: {metadata: true},
  })
  return {toolRunId: result.toolRunId, result: result.result}
}

function maybeThrowConfiguredFailure(request: ProviderExecutionRequest): void {
  const code = request.metadata.mockFailureCode
  if (typeof code === 'string') {
    throw new ProviderExecutionError(code as GreenfieldAIExecutionFailureCode, `Mock provider failure: ${code}`, code !== 'AI_PROVIDER_AUTH_FAILED')
  }
}

function mockStructuredPayload(schema: GreenfieldAIJsonSchema, metadata: Record<string, unknown>): Record<string, unknown> {
  if (metadata.mockStructuredMode === 'invalid' || metadata.mockStructuredMode === 'invalid-then-valid') {
    return {unexpected: 'invalid'}
  }
  return objectForSchema(schema, 'result')
}

function objectForSchema(schema: GreenfieldAIJsonSchema, seed: string): Record<string, unknown> {
  const properties = schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
    ? schema.properties as Record<string, GreenfieldAIJsonSchema>
    : {summary: {type: 'string'}}
  const required = Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === 'string') : Object.keys(properties)
  const output: Record<string, unknown> = {}
  for (const key of required) output[key] = valueForSchema(properties[key] ?? {type: 'string'}, `${seed}:${key}`)
  return output
}

function valueForSchema(schema: GreenfieldAIJsonSchema, seed: string): unknown {
  if (schema.type === 'number' || schema.type === 'integer') return 1
  if (schema.type === 'boolean') return true
  if (schema.type === 'array') return []
  if (schema.type === 'object') return objectForSchema(schema, seed)
  return `mock:${seed}`
}

function parseObject(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
}

function splitDeltas(value: string): string[] {
  const chunks = value.match(/.{1,16}/g)
  return chunks?.length ? chunks : ['']
}

function stablePreview(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 80)
}
