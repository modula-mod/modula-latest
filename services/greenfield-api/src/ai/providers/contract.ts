import type {
  GreenfieldAIExecutionFailureCode,
  GreenfieldAIJsonSchema,
  GreenfieldAIModelCapability,
  GreenfieldAIUsageUnits,
} from '@modula/greenfield-contracts'
import type {AIProviderCredentialPlaintext} from '../../security/encryption/ai-provider-credentials.js'

export type ProviderMessageRole = 'system' | 'developer' | 'user' | 'assistant' | 'tool'

export type ProviderExecutionMessage = {
  role: ProviderMessageRole
  content: string
  name?: string
}

export type DiscoveredAIModel = {
  modelId: string
  providerModelId: string
  displayName: string
  capabilities: GreenfieldAIModelCapability[]
  supportsStreaming: boolean
  supportsStructuredOutputs: boolean
  enabledByDefault?: boolean
}

export type ProviderExecutionRequest = {
  executionId: string
  requestId: string
  accountId: string
  actorId?: string | null
  moduleId: string
  installationId?: string | null
  modelId: string
  providerModelId: string
  messages: ProviderExecutionMessage[]
  outputSchema?: GreenfieldAIJsonSchema
  maxInputUnits: number
  maxOutputUnits: number
  timeoutMs: number
  structuredOutput: boolean
  stream: boolean
  toolIds: string[]
  metadata: Record<string, unknown>
}

export type ProviderExecutionContext = {
  providerId: string
  credentials?: AIProviderCredentialPlaintext
  signal?: AbortSignal
  now?: Date
  executeTool?: (request: ProviderToolExecutionRequest) => Promise<ProviderToolExecutionResult>
}

export type ProviderToolExecutionRequest = {
  toolId: string
  callId: string
  arguments: Record<string, unknown>
}

export type ProviderToolExecutionResult = {
  toolRunId: string
  status: 'completed'
  result: Record<string, unknown>
}

export type ProviderExecutionResult = {
  providerRequestId?: string
  outputText: string
  structuredOutput?: Record<string, unknown>
  usage: GreenfieldAIUsageUnits
  responseMetadata?: Record<string, unknown>
}

export type ProviderStreamEvent =
  | {type: 'execution.started'; metadata?: Record<string, unknown>}
  | {type: 'content.delta'; delta: string; metadata?: Record<string, unknown>}
  | {type: 'reasoning.status'; status: 'analysing' | 'validating' | 'preparing-response'; metadata?: Record<string, unknown>}
  | {type: 'tool.requested'; toolId: string; callId: string; arguments: Record<string, unknown>; metadata?: Record<string, unknown>}
  | {type: 'usage.updated'; usage: GreenfieldAIUsageUnits; metadata?: Record<string, unknown>}
  | {type: 'execution.completed'; outputText?: string; structuredOutput?: Record<string, unknown>; usage?: GreenfieldAIUsageUnits; metadata?: Record<string, unknown>}
  | {type: 'execution.failed'; failureCode: GreenfieldAIExecutionFailureCode; retryable: boolean; metadata?: Record<string, unknown>}
  | {type: 'execution.cancelled'; metadata?: Record<string, unknown>}
  | {type: 'heartbeat'; metadata?: Record<string, unknown>}

export type ProviderHealthResult = {
  state: 'healthy' | 'degraded' | 'rate-limited' | 'authentication-failed' | 'unavailable' | 'disabled' | 'unknown'
  components: Partial<Record<'configuration' | 'credentials' | 'network' | 'model-discovery' | 'execution' | 'streaming' | 'structured-output', string>>
  latencyMs?: number
  configuredModelCount?: number
  failureCode?: GreenfieldAIExecutionFailureCode
  diagnostics?: Record<string, unknown>
}

export interface GreenfieldAIProviderAdapter {
  readonly providerId: string
  readonly credentialMode?: 'greenfield-encrypted' | 'credential-broker'
  discoverModels(
    context: ProviderExecutionContext
  ): Promise<DiscoveredAIModel[]>
  execute(
    request: ProviderExecutionRequest,
    context: ProviderExecutionContext
  ): Promise<ProviderExecutionResult>
  stream(
    request: ProviderExecutionRequest,
    context: ProviderExecutionContext
  ): AsyncIterable<ProviderStreamEvent>
  cancel?(
    executionId: string,
    context: ProviderExecutionContext
  ): Promise<void>
  health(
    context: ProviderExecutionContext
  ): Promise<ProviderHealthResult>
}

export class ProviderExecutionError extends Error {
  readonly code: GreenfieldAIExecutionFailureCode

  constructor(
    public readonly failureCode: GreenfieldAIExecutionFailureCode,
    message: string,
    public readonly retryable: boolean,
    public readonly statusCode?: number,
  ) {
    super(message)
    this.name = 'ProviderExecutionError'
    this.code = failureCode
  }
}

export function isProviderExecutionError(error: unknown): error is ProviderExecutionError {
  return error instanceof ProviderExecutionError
}

export function estimateTextUnits(value: string): number {
  return Math.ceil(Buffer.byteLength(value, 'utf8') / 4)
}

export function redactedProviderMetadata(input: Record<string, unknown> = {}): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (/key|token|secret|credential|authorization/i.test(key)) continue
    if (typeof value === 'string' && value.length > 512) output[key] = `${value.slice(0, 64)}...`
    else output[key] = value
  }
  return output
}
