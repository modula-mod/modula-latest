import type {GreenfieldAIJsonSchema, GreenfieldAIUsageUnits} from '@modula/greenfield-contracts'
import {
  ProviderExecutionError,
  redactedProviderMetadata,
  type DiscoveredAIModel,
  type GreenfieldAIProviderAdapter,
  type ProviderExecutionContext,
  type ProviderExecutionMessage,
  type ProviderExecutionRequest,
  type ProviderExecutionResult,
  type ProviderHealthResult,
  type ProviderStreamEvent,
} from './contract.js'

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'

export class OpenAIGreenfieldAIProviderAdapter implements GreenfieldAIProviderAdapter {
  private readonly providerResponseIds = new Map<string, string>()

  constructor(readonly providerId: string) {}

  async discoverModels(context: ProviderExecutionContext): Promise<DiscoveredAIModel[]> {
    const response = await this.fetchOpenAI(context, '/models', {method: 'GET'}, 10_000)
    const body = await response.json() as {data?: Array<{id?: string}>}
    return (body.data ?? [])
      .filter((model): model is {id: string} => typeof model.id === 'string')
      .map(model => ({
        modelId: `openai.${model.id}`,
        providerModelId: model.id,
        displayName: model.id,
        capabilities: ['chat', 'text-generation', 'streaming', 'structured-output'],
        supportsStreaming: true,
        supportsStructuredOutputs: true,
      }))
  }

  async execute(request: ProviderExecutionRequest, context: ProviderExecutionContext): Promise<ProviderExecutionResult> {
    const response = await this.fetchOpenAI(context, '/responses', {
      method: 'POST',
      body: JSON.stringify(toOpenAIRequest(request, false)),
    }, request.timeoutMs)
    const body = await response.json() as Record<string, unknown>
    const providerRequestId = typeof body.id === 'string' ? body.id : undefined
    if (providerRequestId) this.providerResponseIds.set(request.executionId, providerRequestId)
    const outputText = extractOpenAIOutputText(body)
    if (!outputText) {
      throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'OpenAI response did not include output text', false, response.status)
    }
    return {
      providerRequestId,
      outputText,
      structuredOutput: request.structuredOutput ? parseStructuredObject(outputText) : undefined,
      usage: extractOpenAIUsage(body),
      responseMetadata: redactedProviderMetadata({
        providerRequestId,
        status: body.status,
        createdAt: body.created_at,
      }),
    }
  }

  async *stream(request: ProviderExecutionRequest, context: ProviderExecutionContext): AsyncIterable<ProviderStreamEvent> {
    const response = await this.fetchOpenAI(context, '/responses', {
      method: 'POST',
      body: JSON.stringify(toOpenAIRequest(request, true)),
    }, request.timeoutMs)
    if (!response.body) throw new ProviderExecutionError('AI_STREAM_INTERRUPTED', 'OpenAI stream did not include a response body', true, response.status)
    yield {type: 'execution.started'}
    let outputText = ''
    for await (const event of parseSse(response.body)) {
      const data = event.data === '[DONE]' ? null : parseJsonObject(event.data)
      const providerId = data && typeof data.id === 'string' ? data.id : undefined
      if (providerId) this.providerResponseIds.set(request.executionId, providerId)
      const type = typeof data?.type === 'string' ? data.type : event.event
      if (type === 'response.output_text.delta') {
        const delta = typeof data?.delta === 'string' ? data.delta : ''
        outputText += delta
        if (delta) yield {type: 'content.delta', delta}
      } else if (type === 'response.completed') {
        const responseObject = parseJsonObject(data?.response)
        const usage = extractOpenAIUsage(responseObject ?? data ?? {})
        yield {
          type: 'execution.completed',
          outputText,
          structuredOutput: request.structuredOutput ? parseStructuredObject(outputText) : undefined,
          usage,
          metadata: redactedProviderMetadata({providerRequestId: providerId}),
        }
      } else if (type === 'response.failed') {
        yield {type: 'execution.failed', failureCode: 'AI_PROVIDER_RESPONSE_INVALID', retryable: false}
      } else if (type === 'response.reasoning_summary_part.added' || type === 'response.reasoning_summary_text.delta') {
        yield {type: 'reasoning.status', status: 'analysing'}
      }
    }
  }

  async cancel(executionId: string, context: ProviderExecutionContext): Promise<void> {
    const responseId = this.providerResponseIds.get(executionId)
    if (!responseId) return
    await this.fetchOpenAI(context, `/responses/${encodeURIComponent(responseId)}/cancel`, {method: 'POST'}, 10_000)
  }

  async health(context: ProviderExecutionContext): Promise<ProviderHealthResult> {
    const started = Date.now()
    try {
      const response = await this.fetchOpenAI(context, '/models', {method: 'GET'}, 10_000)
      const body = await response.json() as {data?: unknown[]}
      return {
        state: 'healthy',
        components: {
          configuration: 'configured',
          credentials: 'verified',
          network: 'reachable',
          'model-discovery': 'available',
        },
        latencyMs: Date.now() - started,
        configuredModelCount: Array.isArray(body.data) ? body.data.length : 0,
      }
    } catch (error) {
      const mapped = normalizeOpenAIError(error)
      return {
        state: mapped.failureCode === 'AI_PROVIDER_AUTH_FAILED' ? 'authentication-failed' : mapped.failureCode === 'AI_PROVIDER_RATE_LIMITED' ? 'rate-limited' : 'unavailable',
        components: {
          configuration: 'configured',
          credentials: mapped.failureCode === 'AI_PROVIDER_AUTH_FAILED' ? 'failed' : 'unknown',
          network: mapped.failureCode === 'AI_PROVIDER_TIMEOUT' ? 'timeout' : 'unavailable',
        },
        latencyMs: Date.now() - started,
        failureCode: mapped.failureCode,
      }
    }
  }

  private async fetchOpenAI(
    context: ProviderExecutionContext,
    path: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const apiKey = context.credentials?.apiKey
    if (!apiKey) throw new ProviderExecutionError('AI_PROVIDER_AUTH_FAILED', 'OpenAI credential is not configured', false, 401)
    const baseUrl = context.credentials?.baseUrl ?? DEFAULT_OPENAI_BASE_URL
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const abort = () => controller.abort()
    context.signal?.addEventListener('abort', abort, {once: true})
    try {
      const headers: Record<string, string> = {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      }
      if (context.credentials?.organisationId) headers['OpenAI-Organization'] = context.credentials.organisationId
      if (context.credentials?.projectId) headers['OpenAI-Project'] = context.credentials.projectId
      for (const [key, value] of Object.entries(context.credentials?.headers ?? {})) headers[key] = value
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
        ...init,
        headers: {...headers, ...(init.headers as Record<string, string> | undefined)},
        signal: controller.signal,
      })
      if (!response.ok) throw await providerErrorFromResponse(response)
      return response
    } catch (error) {
      throw normalizeOpenAIError(error)
    } finally {
      clearTimeout(timeout)
      context.signal?.removeEventListener('abort', abort)
    }
  }
}

function toOpenAIRequest(request: ProviderExecutionRequest, stream: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.providerModelId,
    input: request.messages.map(toOpenAIMessage),
    max_output_tokens: request.maxOutputUnits,
    stream,
    store: false,
    metadata: {
      modula_execution_id: request.executionId,
      modula_module_id: request.moduleId,
    },
  }
  if (request.structuredOutput && request.outputSchema) {
    body.text = {
      format: {
        type: 'json_schema',
        name: 'greenfield_response',
        strict: true,
        schema: request.outputSchema,
      },
    }
  }
  return body
}

function toOpenAIMessage(message: ProviderExecutionMessage): Record<string, string> {
  return {
    role: message.role === 'tool' ? 'user' : message.role,
    content: message.content,
  }
}

function extractOpenAIOutputText(body: Record<string, unknown>): string {
  if (typeof body.output_text === 'string') return body.output_text
  const output = Array.isArray(body.output) ? body.output : []
  const pieces: string[] = []
  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const content = Array.isArray((item as {content?: unknown}).content) ? (item as {content: unknown[]}).content : []
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const text = (part as {text?: unknown}).text
      if (typeof text === 'string') pieces.push(text)
    }
  }
  return pieces.join('')
}

function extractOpenAIUsage(body: Record<string, unknown>): GreenfieldAIUsageUnits {
  const usage = body.usage && typeof body.usage === 'object' ? body.usage as Record<string, unknown> : {}
  return {
    inputTokens: numberOrUndefined(usage.input_tokens),
    outputTokens: numberOrUndefined(usage.output_tokens),
    cachedInputTokens: numberOrUndefined((usage.input_tokens_details as Record<string, unknown> | undefined)?.cached_tokens),
  }
}

function parseStructuredObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {
    throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'OpenAI structured response was not valid JSON', false)
  }
  throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'OpenAI structured response was not a JSON object', false)
}

async function providerErrorFromResponse(response: Response): Promise<ProviderExecutionError> {
  const text = await response.text().catch(() => '')
  if (response.status === 401 || response.status === 403) return new ProviderExecutionError('AI_PROVIDER_AUTH_FAILED', 'OpenAI authentication failed', false, response.status)
  if (response.status === 408 || response.status === 504) return new ProviderExecutionError('AI_PROVIDER_TIMEOUT', 'OpenAI request timed out', true, response.status)
  if (response.status === 429) return new ProviderExecutionError('AI_PROVIDER_RATE_LIMITED', 'OpenAI rate limited the request', true, response.status)
  if (response.status === 404) return new ProviderExecutionError('AI_MODEL_UNAVAILABLE', 'OpenAI model is unavailable', false, response.status)
  return new ProviderExecutionError('AI_PROVIDER_UNAVAILABLE', text ? 'OpenAI request failed' : 'OpenAI provider unavailable', response.status >= 500, response.status)
}

function normalizeOpenAIError(error: unknown): ProviderExecutionError {
  if (error instanceof ProviderExecutionError) return error
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ProviderExecutionError('AI_PROVIDER_TIMEOUT', 'OpenAI request timed out', true)
  }
  return new ProviderExecutionError('AI_PROVIDER_UNAVAILABLE', 'OpenAI provider unavailable', true)
}

async function *parseSse(body: ReadableStream<Uint8Array>): AsyncIterable<{event: string; data: string}> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const {done, value} = await reader.read()
      if (done) break
      buffer += decoder.decode(value, {stream: true})
      let boundary = buffer.indexOf('\n\n')
      while (boundary >= 0) {
        const raw = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const event = parseSseEvent(raw)
        if (event) yield event
        boundary = buffer.indexOf('\n\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function parseSseEvent(raw: string): {event: string; data: string} | null {
  let event = 'message'
  const data: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    if (line.startsWith('data:')) data.push(line.slice(5).trim())
  }
  if (data.length === 0) return null
  return {event, data: data.join('\n')}
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string' || !value) return null
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
