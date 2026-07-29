export type GreenfieldAIProviderKind =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'ollama'
  | 'lm-studio'
  | 'azure-openai'
  | 'local'
  | 'future'

export type GreenfieldAIProviderStatus =
  | 'available'
  | 'unconfigured'
  | 'disabled'
  | 'degraded'
  | 'retired'

export type GreenfieldAIProviderConfigurationMode =
  | 'disabled'
  | 'platform-managed'
  | 'customer-managed'
  | 'local'
  | 'development-mock'
  | 'server-managed'
  | 'account-managed'
  | 'local-runtime'
  | 'future'

export type GreenfieldAIProviderHealthState =
  | 'healthy'
  | 'degraded'
  | 'rate-limited'
  | 'authentication-failed'
  | 'unavailable'
  | 'disabled'
  | 'unknown'

export type GreenfieldAIProviderRoutingStrategy =
  | 'fixed'
  | 'capability-first'
  | 'cost-aware'
  | 'latency-aware'
  | 'privacy-first'
  | 'local-first'

export type GreenfieldAIExecutionFailureCode =
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_PROVIDER_AUTH_FAILED'
  | 'AI_PROVIDER_RATE_LIMITED'
  | 'AI_PROVIDER_TIMEOUT'
  | 'AI_MODEL_UNAVAILABLE'
  | 'AI_CAPABILITY_UNAVAILABLE'
  | 'AI_STRUCTURED_OUTPUT_INVALID'
  | 'AI_STREAM_INTERRUPTED'
  | 'AI_QUOTA_EXCEEDED'
  | 'AI_EXECUTION_CANCELLED'
  | 'AI_PROVIDER_RESPONSE_INVALID'
  | 'AI_CONTEXT_TOO_LARGE'
  | 'AI_OUTPUT_LIMIT_EXCEEDED'
  | 'AI_CONCURRENCY_LIMIT'
  | 'AI_TOOL_LIMIT_EXCEEDED'

export type GreenfieldAIModelCapability =
  | 'chat'
  | 'text-generation'
  | 'streaming'
  | 'structured-output'
  | 'reasoning'
  | 'vision'
  | 'image-generation'
  | 'embeddings'
  | 'audio'
  | 'tool-calling'

export type GreenfieldAIModelAvailability =
  | 'available'
  | 'unavailable'
  | 'coming-soon'

export type GreenfieldAIModelLifecycleStatus =
  | 'active'
  | 'preview'
  | 'deprecated'
  | 'retired'

export type GreenfieldAIPromptLifecycleStatus =
  | 'draft'
  | 'active'
  | 'deprecated'
  | 'retired'

export type GreenfieldAIRequestStatus =
  | 'accepted'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'denied'

export type GreenfieldAIStreamStatus =
  | 'open'
  | 'reconnecting'
  | 'completed'
  | 'cancelled'
  | 'failed'

export type GreenfieldAIToolSideEffect =
  | 'none'
  | 'internal-write'
  | 'external-write'
  | 'financial'
  | 'destructive'

export type GreenfieldAIToolConfirmation =
  | 'none'
  | 'user'
  | 'reauthentication'
  | 'operator'

export type GreenfieldAIMemoryScope =
  | 'transient-request'
  | 'conversation'
  | 'module'
  | 'future-persistent'

export type GreenfieldAIJsonSchema = Record<string, unknown>

export interface GreenfieldAIProviderDefinition {
  providerId: string
  kind: GreenfieldAIProviderKind
  displayName: string
  status: GreenfieldAIProviderStatus
  capabilities: GreenfieldAIModelCapability[]
  configurationMode: GreenfieldAIProviderConfigurationMode
}

export interface GreenfieldAIModelRegistryEntry {
  modelId: string
  providerId: string
  providerKind: GreenfieldAIProviderKind
  providerModelId: string
  displayName: string
  capabilities: GreenfieldAIModelCapability[]
  supportsStreaming: boolean
  supportsStructuredOutputs: boolean
  supportsReasoning: boolean
  supportsVision: boolean
  supportsImageGeneration: boolean
  supportsEmbeddings: boolean
  supportsAudio: boolean
  availability: GreenfieldAIModelAvailability
  lifecycleStatus: GreenfieldAIModelLifecycleStatus
  enabled: boolean
}

export interface GreenfieldAIPromptResource {
  promptId: string
  version: string
  owner: string
  moduleId?: string
  purpose: string
  variables: string[]
  outputSchema?: GreenfieldAIJsonSchema
  safetyPolicy: Record<string, unknown>
  lifecycleStatus: GreenfieldAIPromptLifecycleStatus
  templateHash: string
}

export interface GreenfieldAIContextResourceReference {
  type: string
  id: string
  ownerActorId?: string
  ownerAccountId?: string
  visibility?: string
  purpose?: string
}

export interface GreenfieldAIContextFragment {
  sourceType: string
  sourceId?: string
  classification: 'public' | 'internal' | 'private' | 'sensitive' | 'restricted'
  content: string
  tokenEstimate?: number
  permissions: string[]
  retentionPolicy: 'none' | 'transient' | 'provider-policy'
}

export interface GreenfieldAIRequestContract {
  requestId?: string
  requestingModuleId: string
  accountId: string
  actorId?: string
  installationId?: string
  conversationId?: string
  correlationId?: string
  policyContext?: Record<string, unknown>
  requiredCapabilities: GreenfieldAIModelCapability[]
  preferredModelId?: string
  timeoutMs?: number
  stream?: boolean
  responseSchema?: GreenfieldAIJsonSchema
  safetyRequirements?: Record<string, unknown>
  prompt?: {
    promptId: string
    version?: string
    variables?: Record<string, unknown>
  }
  context?: {
    resources?: GreenfieldAIContextResourceReference[]
    fragments?: GreenfieldAIContextFragment[]
    transient?: Record<string, unknown>
    conversationHistoryRef?: string
    systemInstructionRefs?: string[]
  }
  tools?: string[]
  memory?: {
    scopes: GreenfieldAIMemoryScope[]
    conversationId?: string
    moduleNamespace?: string
  }
}

export interface GreenfieldAIContextBuildResult {
  allowedResources: GreenfieldAIContextResourceReference[]
  redactedResources: Array<GreenfieldAIContextResourceReference & {reason: string}>
  allowedFragments?: GreenfieldAIContextFragment[]
  redactedFragments?: Array<Pick<GreenfieldAIContextFragment, 'sourceType' | 'sourceId' | 'classification'> & {reason: string}>
  tokenEstimate?: number
  transientKeys: string[]
  systemInstructionRefs: string[]
  conversationHistoryRef?: string
}

export interface GreenfieldAIToolDeclaration {
  toolId: string
  moduleId: string
  version: string
  description: string
  inputSchema: GreenfieldAIJsonSchema
  outputSchema?: GreenfieldAIJsonSchema
  sideEffects: GreenfieldAIToolSideEffect
  confirmation: GreenfieldAIToolConfirmation
  requiredPermissions: string[]
  lifecycleStatus: 'active' | 'disabled' | 'deprecated' | 'retired'
}

export interface GreenfieldAIUsageLedgerEntry {
  requestId: string
  providerId?: string
  modelId?: string
  promptId?: string
  promptVersion?: string
  requestingModuleId: string
  accountId: string
  actorId?: string
  installationId?: string
  conversationId?: string
  correlationId: string
  latencyMs?: number
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  estimatedCostMicrounits?: number
  status: GreenfieldAIRequestStatus
  retryCount: number
}

export interface GreenfieldAIUsageUnits {
  inputTokens?: number
  outputTokens?: number
  cachedInputTokens?: number
  imageUnits?: number
  audioSeconds?: number
  providerCostMinorUnits?: number
  currency?: string
}

export interface ResolvedAIExecutionTarget {
  providerId: string
  modelId: string
  reason: string
  fallbackTargets: Array<{
    providerId: string
    modelId: string
  }>
}

export interface GreenfieldAIExecutionResult {
  executionId: string
  requestId: string
  status: GreenfieldAIRequestStatus
  providerId?: string
  modelId?: string
  structuredOutput: boolean
  streaming: boolean
  output?: string
  structured?: Record<string, unknown>
  streamId?: string
  usage: GreenfieldAIUsageUnits
  failureCode?: GreenfieldAIExecutionFailureCode
  routing: ResolvedAIExecutionTarget
}
