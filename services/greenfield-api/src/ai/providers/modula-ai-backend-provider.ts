import {createHmac, randomBytes} from 'node:crypto'
import type {GreenfieldAIExecutionFailureCode, GreenfieldAIUsageUnits} from '@modula/greenfield-contracts'
import {uuidv7} from '../../lib/uuidv7.js'
import {
  ProviderExecutionError,
  type DiscoveredAIModel,
  type GreenfieldAIProviderAdapter,
  type ProviderExecutionContext,
  type ProviderExecutionRequest,
  type ProviderExecutionResult,
  type ProviderHealthResult,
  type ProviderStreamEvent,
} from './contract.js'

type BackendProviderId = 'openai' | 'gemini' | 'anthropic' | 'local'

export type ModulaAIBackendAdapterConfig = {
  providerId: string
  backendProviderId: BackendProviderId
  baseUrl: string
  issuer: string
  signingKey: string
  maximumTimeoutMs: number
  fetch?: typeof globalThis.fetch
}

export class ModulaAIBackendProviderAdapter implements GreenfieldAIProviderAdapter {
  readonly credentialMode = 'credential-broker' as const
  readonly providerId: string
  private readonly fetch: typeof globalThis.fetch

  constructor(private readonly config: ModulaAIBackendAdapterConfig) {
    this.providerId = config.providerId
    this.fetch = config.fetch ?? globalThis.fetch
  }

  async discoverModels(_context: ProviderExecutionContext): Promise<DiscoveredAIModel[]> {
    return []
  }

  async execute(request: ProviderExecutionRequest, context: ProviderExecutionContext): Promise<ProviderExecutionResult> {
    if (request.toolIds.length) throw new ProviderExecutionError('AI_CAPABILITY_UNAVAILABLE', 'AI backend tool execution is not enabled', false)
    if (request.messages.some(message => message.role === 'tool')) throw new ProviderExecutionError('AI_CAPABILITY_UNAVAILABLE', 'AI backend tool messages are not enabled', false)
    const capability = request.structuredOutput ? 'ai.structured' : 'ai.generate'
    const assertion = this.issueAssertion(request, capability, request.structuredOutput ? 'structured.create' : 'completion.create')
    const body: Record<string, unknown> = {
      messages: request.messages.map(message => ({role: message.role, content: message.content})),
      targets: [{provider: this.config.backendProviderId, model: request.providerModelId}],
      maxOutputTokens: request.maxOutputUnits,
      timeoutMs: Math.min(request.timeoutMs, this.config.maximumTimeoutMs),
    }
    if (request.structuredOutput) body.outputSchema = request.outputSchema ?? {type: 'object'}
    const result = await this.call(request.structuredOutput ? '/v1/ai/structured' : '/v1/ai/completions', body, assertion, request, context.signal)
    const usage = record(result.usage)
    const structured = recordOrUndefined(result.structuredOutput)
    return {
      ...(typeof result.providerRequestId === 'string' ? {providerRequestId: result.providerRequestId} : {}),
      outputText: requiredString(result.outputText, 'AI backend output text is missing'),
      ...(structured ? {structuredOutput: structured} : {}),
      usage: usageUnits(usage),
      responseMetadata: {
        executionService: 'service.modula-ai',
        backendProvider: this.config.backendProviderId,
        attemptedTargets: safeAttemptMetadata(result.attemptedTargets),
      },
    }
  }

  async *stream(request: ProviderExecutionRequest, context: ProviderExecutionContext): AsyncIterable<ProviderStreamEvent> {
    yield {type: 'execution.started', metadata: {executionService: 'service.modula-ai'}}
    const result = await this.execute(request, context)
    if (result.outputText) yield {type: 'content.delta', delta: result.outputText}
    yield {type: 'usage.updated', usage: result.usage}
    yield {type: 'execution.completed', outputText: result.outputText, ...(result.structuredOutput ? {structuredOutput: result.structuredOutput} : {}), usage: result.usage}
  }

  async health(_context: ProviderExecutionContext): Promise<ProviderHealthResult> {
    const requestId = `ai-health:${uuidv7()}`
    const request: ProviderExecutionRequest = {
      executionId: requestId,
      requestId,
      accountId: 'platform:health',
      moduleId: 'digital.modula.engine-ai',
      installationId: 'engine.ai:platform',
      modelId: `${this.providerId}:health`,
      providerModelId: 'health',
      messages: [{role: 'user', content: 'health'}],
      maxInputUnits: 1,
      maxOutputUnits: 1,
      timeoutMs: Math.min(5_000, this.config.maximumTimeoutMs),
      structuredOutput: false,
      stream: false,
      toolIds: [],
      metadata: {},
    }
    const assertion = this.issueAssertion(request, 'ai.health', 'providers.health')
    const started = Date.now()
    try {
      const providers = await this.callHealth(assertion, request)
      const provider = providers.find(item => item.provider === this.config.backendProviderId)
      if (!provider) throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'AI backend provider health is missing', false)
      const state = typeof provider.state === 'string' ? provider.state : 'unavailable'
      return {
        state: state === 'healthy' ? 'healthy' : state === 'degraded' ? 'degraded' : state === 'not-configured' ? 'disabled' : 'unavailable',
        components: {
          configuration: state,
          credentials: typeof provider.errorCode === 'string' ? provider.errorCode : state,
          network: 'service-fabric',
          execution: 'service.modula-ai',
        },
        latencyMs: Date.now() - started,
        configuredModelCount: state === 'healthy' || state === 'degraded' ? 1 : 0,
        ...(state === 'not-configured' ? {failureCode: 'AI_MODEL_UNAVAILABLE' as const} : {}),
        diagnostics: {executionService: 'service.modula-ai', backendProvider: this.config.backendProviderId},
      }
    } catch (error) {
      const failure = normalizeBackendError(error)
      return {
        state: failure.failureCode === 'AI_PROVIDER_AUTH_FAILED' ? 'authentication-failed' : 'unavailable',
        components: {network: 'unavailable', execution: failure.failureCode},
        latencyMs: Date.now() - started,
        configuredModelCount: 0,
        failureCode: failure.failureCode,
        diagnostics: {executionService: 'service.modula-ai', backendProvider: this.config.backendProviderId},
      }
    }
  }

  private async call(
    pathname: string,
    body: Record<string, unknown>,
    assertion: {token: string; requestId: string; traceId: string},
    request: ProviderExecutionRequest,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const response = await this.request(pathname, {method: 'POST', body: JSON.stringify(body)}, assertion, Math.min(request.timeoutMs, this.config.maximumTimeoutMs), signal)
    const envelope = await readJsonBounded(response, 2_097_152)
    if (!response.ok) throw errorFromEnvelope(response.status, envelope)
    const data = recordOrUndefined(envelope.data)
    if (!data) throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'AI backend response data is missing', false)
    return data
  }

  private async callHealth(assertion: {token: string; requestId: string; traceId: string}, request: ProviderExecutionRequest): Promise<Array<Record<string, unknown>>> {
    const response = await this.request('/v1/providers/health', {method: 'GET'}, assertion, request.timeoutMs)
    const envelope = await readJsonBounded(response, 262_144)
    if (!response.ok) throw errorFromEnvelope(response.status, envelope)
    const data = record(envelope.data)
    return Array.isArray(data.providers) ? data.providers.filter(isRecord) : []
  }

  private async request(
    pathname: string,
    init: Pick<RequestInit, 'method' | 'body'>,
    assertion: {token: string; requestId: string; traceId: string},
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<Response> {
    const url = new URL(pathname, this.config.baseUrl)
    const signals = [AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]
    try {
      return await this.fetch(url, {
        ...init,
        redirect: 'error',
        signal: signals.length === 1 ? signals[0] : AbortSignal.any(signals),
        headers: {
          ...(init.body ? {'content-type': 'application/json'} : {}),
          'x-modula-service-assertion': assertion.token,
          'x-request-id': assertion.requestId,
          'x-trace-id': assertion.traceId,
        },
      })
    } catch (error) {
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw new ProviderExecutionError('AI_PROVIDER_TIMEOUT', 'Modula AI backend request timed out', true)
      throw new ProviderExecutionError('AI_PROVIDER_UNAVAILABLE', 'Modula AI backend is unavailable', true)
    }
  }

  private issueAssertion(request: ProviderExecutionRequest, capability: string, actionId: string): {token: string; requestId: string; traceId: string} {
    const now = Math.floor(Date.now() / 1000)
    const installationId = request.installationId ?? `engine.ai:${request.accountId}`
    const traceId = typeof request.metadata.traceId === 'string' ? request.metadata.traceId : request.requestId
    const claims = {
      issuer: this.config.issuer,
      subject: 'service.greenfield.gateway',
      consumer: request.moduleId,
      target: 'service.modula-ai',
      serviceId: 'service.modula-ai',
      targetProductId: request.moduleId,
      targetInstallationId: installationId,
      accountId: request.accountId,
      actorId: request.actorId ?? null,
      installationId,
      moduleId: request.moduleId,
      permissions: [],
      capabilities: [capability, 'secrets.use.direct'],
      audience: 'modula-engine:ai',
      sessionId: `engine-ai:${uuidv7()}`,
      actionId,
      scope: {accountId: request.accountId, productId: request.moduleId, installationId, operations: [capability, 'secrets.use.direct']},
      jti: `engine-ai-assertion:${uuidv7()}`,
      requestId: request.requestId,
      traceId,
      issuedAt: now,
      expiresAt: now + Math.min(300, Math.max(30, Math.ceil(request.timeoutMs / 1_000) + 30)),
    }
    const header = Buffer.from(JSON.stringify({alg: 'HS256', typ: 'modula-module-session+jwt', kid: 'greenfield-module-token-v1'})).toString('base64url')
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
    const signature = createHmac('sha256', this.config.signingKey).update(`${header}.${payload}`).digest('base64url')
    return {token: `${header}.${payload}.${signature}.${randomBytes(8).toString('base64url')}`, requestId: request.requestId, traceId}
  }
}

function usageUnits(value: Record<string, unknown>): GreenfieldAIUsageUnits {
  return {
    ...(number(value.inputTokens) !== undefined ? {inputTokens: number(value.inputTokens)} : {}),
    ...(number(value.outputTokens) !== undefined ? {outputTokens: number(value.outputTokens)} : {}),
    ...(number(value.cachedInputTokens) !== undefined ? {cachedInputTokens: number(value.cachedInputTokens)} : {}),
  }
}

function safeAttemptMetadata(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map(item => ({
    provider: typeof item.provider === 'string' ? item.provider : 'unknown',
    model: typeof item.model === 'string' ? item.model : 'unknown',
    outcome: item.outcome === 'succeeded' ? 'succeeded' : 'failed',
    errorCode: typeof item.errorCode === 'string' ? item.errorCode : null,
  }))
}

async function readJsonBounded(response: Response, maximumBytes: number): Promise<Record<string, unknown>> {
  const length = Number(response.headers.get('content-length') ?? '0')
  if (Number.isFinite(length) && length > maximumBytes) throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'AI backend response is too large', false)
  if (!response.body) throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'AI backend response body is missing', false)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let receivedBytes = 0
  while (true) {
    const {done, value} = await reader.read()
    if (done) break
    receivedBytes += value.byteLength
    if (receivedBytes > maximumBytes) {
      try {
        await reader.cancel()
      } catch {
        // The bounded read has already failed closed; cancellation is best effort.
      }
      throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'AI backend response is too large', false)
    }
    chunks.push(value)
  }
  let text: string
  try {
    text = new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks, receivedBytes))
  } catch {
    throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'AI backend response is not valid UTF-8', false)
  }
  try {
    const value = JSON.parse(text) as unknown
    if (isRecord(value)) return value
  } catch {
    // Mapped below without retaining response content.
  }
  throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'AI backend response is invalid JSON', false)
}

function errorFromEnvelope(status: number, envelope: Record<string, unknown>): ProviderExecutionError {
  const error = record(envelope.error)
  const code = typeof error.code === 'string' ? error.code : 'PROVIDER_UNAVAILABLE'
  const retryable = error.retryable === true
  const mapped: Record<string, GreenfieldAIExecutionFailureCode> = {
    PROVIDER_NOT_CONFIGURED: 'AI_MODEL_UNAVAILABLE',
    PROVIDER_UNAVAILABLE: 'AI_PROVIDER_UNAVAILABLE',
    PROVIDER_TIMEOUT: 'AI_PROVIDER_TIMEOUT',
    PROVIDER_RESPONSE_INVALID: 'AI_PROVIDER_RESPONSE_INVALID',
    OUTPUT_SCHEMA_INVALID: 'AI_STRUCTURED_OUTPUT_INVALID',
    RATE_LIMITED: 'AI_PROVIDER_RATE_LIMITED',
    UNAUTHENTICATED: 'AI_PROVIDER_AUTH_FAILED',
    FORBIDDEN: 'AI_PROVIDER_AUTH_FAILED',
  }
  return new ProviderExecutionError(mapped[code] ?? 'AI_PROVIDER_UNAVAILABLE', 'Modula AI backend rejected the provider request', retryable, status)
}

function normalizeBackendError(error: unknown): ProviderExecutionError {
  return error instanceof ProviderExecutionError ? error : new ProviderExecutionError('AI_PROVIDER_UNAVAILABLE', 'Modula AI backend request failed', true)
}

function requiredString(value: unknown, message: string): string {
  if (typeof value !== 'string') throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', message, false)
  return value
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function recordOrUndefined(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
