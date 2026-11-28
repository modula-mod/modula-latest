import type {GreenfieldAIExecutionFailureCode, GreenfieldAIJsonSchema, GreenfieldAIUsageUnits} from '@modula/greenfield-contracts'
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

const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1'
const ANTHROPIC_VERSION = '2023-06-01'
const STRUCTURED_OUTPUT_TOOL_NAME = 'greenfield_response'

export class AnthropicGreenfieldAIProviderAdapter implements GreenfieldAIProviderAdapter {
  constructor(readonly providerId: string) {}

  async discoverModels(context: ProviderExecutionContext): Promise<DiscoveredAIModel[]> {
    const response = await this.fetchAnthropic(context, '/models', {method: 'GET'}, 10_000)
    const body = await response.json() as {data?: Array<{id?: string; display_name?: string}>}
    return (body.data ?? [])
      .filter((model): model is {id: string; display_name?: string} => typeof model.id === 'string')
      .map(model => ({
        modelId: `anthropic.${model.id}`,
        providerModelId: model.id,
        displayName: model.display_name ?? model.id,
        capabilities: ['chat', 'text-generation', 'streaming', 'structured-output', 'reasoning', 'vision', 'tool-calling'],
        supportsStreaming: true,
        supportsStructuredOutputs: true,
      }))
  }

  async execute(request: ProviderExecutionRequest, context: ProviderExecutionContext): Promise<ProviderExecutionResult> {
    const response = await this.fetchAnthropic(context, '/messages', {
      method: 'POST',
      body: JSON.stringify(toAnthropicRequest(request, false)),
    }, request.timeoutMs)
    const body = await response.json() as Record<string, unknown>
    const providerRequestId = typeof body.id === 'string' ? body.id : undefined
    if (request.structuredOutput) {
      const structured = extractAnthropicStructuredOutput(body, request.outputSchema)
      return {
        providerRequestId,
        outputText: JSON.stringify(structured),
        structuredOutput: structured,
        usage: extractAnthropicUsage(body),
        responseMetadata: redactedProviderMetadata({
          providerRequestId,
          model: body.model,
          stopReason: body.stop_reason,
        }),
      }
    }
    const outputText = extractAnthropicOutputText(body)
    if (!outputText) {
      throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'Anthropic response did not include output text', false, response.status)
    }
    return {
      providerRequestId,
      outputText,
      usage: extractAnthropicUsage(body),
      responseMetadata: redactedProviderMetadata({
        providerRequestId,
        model: body.model,
        stopReason: body.stop_reason,
      }),
    }
  }

  async *stream(request: ProviderExecutionRequest, context: ProviderExecutionContext): AsyncIterable<ProviderStreamEvent> {
    const response = await this.fetchAnthropic(context, '/messages', {
      method: 'POST',
      body: JSON.stringify(toAnthropicRequest(request, true)),
    }, request.timeoutMs)
    if (!response.body) throw new ProviderExecutionError('AI_STREAM_INTERRUPTED', 'Anthropic stream did not include a response body', true, response.status)
    yield {type: 'execution.started'}
    let outputText = ''
    let partialJsonText = ''
    let usage: GreenfieldAIUsageUnits = {}
    for await (const event of parseSse(response.body)) {
      const data = parseJsonObject(event.data)
      if (!data) continue
      const type = typeof data.type === 'string' ? data.type : event.event
      if (type === 'content_block_delta') {
        const delta = data.delta && typeof data.delta === 'object' ? data.delta as Record<string, unknown> : {}
        if (delta.type === 'text_delta' && typeof delta.text === 'string') {
          outputText += delta.text
          yield {type: 'content.delta', delta: delta.text}
        } else if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
          // Structured output arrives as partial JSON on the tool-use block.
          // It is accumulated raw and parsed once, at message_stop; deltas
          // are not forwarded as text.
          partialJsonText += delta.partial_json
        }
      } else if (type === 'message_delta') {
        const deltaUsage = data.usage && typeof data.usage === 'object' ? extractAnthropicUsage(data as Record<string, unknown>) : {}
        usage = {...usage, ...deltaUsage}
        if (typeof (data.delta as Record<string, unknown> | undefined)?.stop_reason === 'string') {
          yield {type: 'reasoning.status', status: 'validating'}
        }
      } else if (type === 'message_stop') {
        if (request.structuredOutput) {
          const structured = partialJsonText ? parseStructuredObject(partialJsonText) : outputText ? parseStructuredObject(outputText) : undefined
          if (!structured) throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'Anthropic structured response was empty', false)
          yield {
            type: 'execution.completed',
            outputText: JSON.stringify(structured),
            structuredOutput: structured,
            usage,
          }
        } else {
          yield {type: 'execution.completed', outputText, usage}
        }
      } else if (type === 'error') {
        const error = data.error && typeof data.error === 'object' ? data.error as Record<string, unknown> : {}
        const failureCode = anthropicErrorCode(error)
        yield {type: 'execution.failed', failureCode, retryable: failureCode === 'AI_PROVIDER_RATE_LIMITED' || failureCode === 'AI_PROVIDER_TIMEOUT' || failureCode === 'AI_PROVIDER_UNAVAILABLE'}
      }
    }
  }

  async cancel(): Promise<void> {
    // The Anthropic Messages API has no server-side cancel endpoint. The
    // runtime aborts the fetch via the AbortSignal and stops forwarding
    // output; this no-op keeps the adapter contract explicit about that.
  }

  async health(context: ProviderExecutionContext): Promise<ProviderHealthResult> {
    const started = Date.now()
    try {
      const response = await this.fetchAnthropic(context, '/models', {method: 'GET'}, 10_000)
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
      const mapped = normalizeAnthropicError(error)
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

  private async fetchAnthropic(
    context: ProviderExecutionContext,
    path: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const apiKey = context.credentials?.apiKey
    if (!apiKey) throw new ProviderExecutionError('AI_PROVIDER_AUTH_FAILED', 'Anthropic credential is not configured', false, 401)
    const baseUrl = context.credentials?.baseUrl ?? DEFAULT_ANTHROPIC_BASE_URL
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const abort = () => controller.abort()
    context.signal?.addEventListener('abort', abort, {once: true})
    try {
      const headers: Record<string, string> = {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      }
      for (const [key, value] of Object.entries(context.credentials?.headers ?? {})) headers[key] = value
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
        ...init,
        headers: {...headers, ...(init.headers as Record<string, string> | undefined)},
        signal: controller.signal,
      })
      if (!response.ok) throw await providerErrorFromResponse(response)
      return response
    } catch (error) {
      throw normalizeAnthropicError(error)
    } finally {
      clearTimeout(timeout)
      context.signal?.removeEventListener('abort', abort)
    }
  }
}

function toAnthropicRequest(request: ProviderExecutionRequest, stream: boolean): Record<string, unknown> {
  const {system, messages} = splitSystemMessages(request.messages)
  const body: Record<string, unknown> = {
    model: request.providerModelId,
    max_tokens: request.maxOutputUnits,
    messages,
    stream,
    metadata: {
      user_id: `modula:${request.accountId}:${request.executionId}`.slice(0, 128),
    },
  }
  if (system) body.system = system
  if (request.structuredOutput && request.outputSchema) {
    body.tools = [{
      name: STRUCTURED_OUTPUT_TOOL_NAME,
      description: 'Return the Greenfield structured response. Use this tool for the entire response.',
      input_schema: request.outputSchema,
    }]
    body.tool_choice = {type: 'tool', name: STRUCTURED_OUTPUT_TOOL_NAME}
  }
  return body
}

function splitSystemMessages(messages: ProviderExecutionMessage[]): {system?: string; messages: Array<{role: 'user' | 'assistant'; content: string}>} {
  const systemParts: string[] = []
  const rest: Array<{role: 'user' | 'assistant'; content: string}> = []
  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(message.content)
      continue
    }
    const role = message.role === 'assistant' ? 'assistant' : 'user'
    const last = rest[rest.length - 1]
    // Anthropic requires strictly alternating roles; merge consecutive
    // same-role messages (the gateway assembles several user fragments).
    if (last && last.role === role) last.content = `${last.content}\n\n${message.content}`
    else rest.push({role, content: message.content})
  }
  return {system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined, messages: rest}
}

function extractAnthropicOutputText(body: Record<string, unknown>): string {
  const content = Array.isArray(body.content) ? body.content : []
  const pieces: string[] = []
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    if ((block as {type?: unknown}).type === 'text' && typeof (block as {text?: unknown}).text === 'string') {
      pieces.push((block as {text: string}).text)
    }
  }
  return pieces.join('')
}

function extractAnthropicStructuredOutput(body: Record<string, unknown>, _schema: GreenfieldAIJsonSchema | undefined): Record<string, unknown> {
  const content = Array.isArray(body.content) ? body.content : []
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    if ((block as {type?: unknown}).type === 'tool_use' && (block as {name?: unknown}).name === STRUCTURED_OUTPUT_TOOL_NAME) {
      const input = (block as {input?: unknown}).input
      if (input && typeof input === 'object' && !Array.isArray(input)) return input as Record<string, unknown>
      throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'Anthropic structured response was not a JSON object', false)
    }
  }
  // Fall back to parsing the text output (the runtime's repair path also
  // does this); a model that ignored the tool still yields a valid object.
  const text = extractAnthropicOutputText(body)
  if (!text) throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'Anthropic structured response was empty', false)
  return parseStructuredObject(text)
}

function extractAnthropicUsage(body: Record<string, unknown>): GreenfieldAIUsageUnits {
  const usage = body.usage && typeof body.usage === 'object' ? body.usage as Record<string, unknown> : {}
  return {
    inputTokens: numberOrUndefined(usage.input_tokens),
    outputTokens: numberOrUndefined(usage.output_tokens),
    cachedInputTokens: numberOrUndefined(usage.cache_read_input_tokens),
  }
}

function parseStructuredObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {
    throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'Anthropic structured response was not valid JSON', false)
  }
  throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'Anthropic structured response was not a JSON object', false)
}

function anthropicErrorCode(error: Record<string, unknown>): GreenfieldAIExecutionFailureCode {
  const type = typeof error.type === 'string' ? error.type : ''
  if (type === 'authentication_error' || type === 'permission_error') return 'AI_PROVIDER_AUTH_FAILED'
  if (type === 'rate_limit_error') return 'AI_PROVIDER_RATE_LIMITED'
  if (type === 'overloaded_error') return 'AI_PROVIDER_UNAVAILABLE'
  if (type === 'not_found_error') return 'AI_MODEL_UNAVAILABLE'
  if (type === 'invalid_request_error') return 'AI_PROVIDER_RESPONSE_INVALID'
  return 'AI_PROVIDER_UNAVAILABLE'
}

async function providerErrorFromResponse(response: Response): Promise<ProviderExecutionError> {
  const text = await response.text().catch(() => '')
  let errorType = ''
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const error = parsed.error && typeof parsed.error === 'object' ? parsed.error as Record<string, unknown> : {}
    if (typeof error.type === 'string') errorType = error.type
  } catch {
    // Fall through to the status-based mapping.
  }
  if (response.status === 401 || response.status === 403 || errorType === 'authentication_error' || errorType === 'permission_error') {
    return new ProviderExecutionError('AI_PROVIDER_AUTH_FAILED', 'Anthropic authentication failed', false, response.status)
  }
  if (response.status === 408 || response.status === 504) return new ProviderExecutionError('AI_PROVIDER_TIMEOUT', 'Anthropic request timed out', true, response.status)
  if (response.status === 429 || errorType === 'rate_limit_error') return new ProviderExecutionError('AI_PROVIDER_RATE_LIMITED', 'Anthropic rate limited the request', true, response.status)
  if (response.status === 404 || errorType === 'not_found_error') return new ProviderExecutionError('AI_MODEL_UNAVAILABLE', 'Anthropic model is unavailable', false, response.status)
  if (errorType === 'overloaded_error') return new ProviderExecutionError('AI_PROVIDER_UNAVAILABLE', 'Anthropic is overloaded', true, response.status)
  if (errorType === 'invalid_request_error') return new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'Anthropic request was invalid', false, response.status)
  return new ProviderExecutionError('AI_PROVIDER_UNAVAILABLE', text ? 'Anthropic request failed' : 'Anthropic provider unavailable', response.status >= 500, response.status)
}

function normalizeAnthropicError(error: unknown): ProviderExecutionError {
  if (error instanceof ProviderExecutionError) return error
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ProviderExecutionError('AI_PROVIDER_TIMEOUT', 'Anthropic request timed out', true)
  }
  return new ProviderExecutionError('AI_PROVIDER_UNAVAILABLE', 'Anthropic provider unavailable', true)
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
