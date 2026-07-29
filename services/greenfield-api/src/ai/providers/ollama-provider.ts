import type {GreenfieldAIJsonSchema} from '@modula/greenfield-contracts'
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

const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434'

export class OllamaGreenfieldAIProviderAdapter implements GreenfieldAIProviderAdapter {
  constructor(readonly providerId: string) {}

  async discoverModels(context: ProviderExecutionContext): Promise<DiscoveredAIModel[]> {
    const response = await this.fetchOllama(context, '/api/tags', {method: 'GET'}, 10_000)
    const body = await response.json() as {models?: Array<{name?: string; model?: string}>}
    return (body.models ?? [])
      .map(model => model.name ?? model.model)
      .filter((model): model is string => typeof model === 'string' && model.length > 0)
      .map(model => ({
        modelId: `ollama.${model}`,
        providerModelId: model,
        displayName: model,
        capabilities: ['chat', 'text-generation', 'streaming', 'structured-output'],
        supportsStreaming: true,
        supportsStructuredOutputs: true,
      }))
  }

  async execute(request: ProviderExecutionRequest, context: ProviderExecutionContext): Promise<ProviderExecutionResult> {
    const response = await this.fetchOllama(context, '/api/chat', {
      method: 'POST',
      body: JSON.stringify(toOllamaRequest(request, false)),
    }, request.timeoutMs)
    const body = await response.json() as Record<string, unknown>
    const outputText = extractOllamaContent(body)
    if (!outputText) throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'Ollama response did not include message content', false, response.status)
    return {
      providerRequestId: typeof body.created_at === 'string' ? body.created_at : undefined,
      outputText,
      structuredOutput: request.structuredOutput ? parseStructuredObject(outputText) : undefined,
      usage: {
        inputTokens: numberOrUndefined(body.prompt_eval_count),
        outputTokens: numberOrUndefined(body.eval_count),
      },
      responseMetadata: redactedProviderMetadata({
        doneReason: body.done_reason,
        totalDuration: body.total_duration,
        loadDuration: body.load_duration,
      }),
    }
  }

  async *stream(request: ProviderExecutionRequest, context: ProviderExecutionContext): AsyncIterable<ProviderStreamEvent> {
    const response = await this.fetchOllama(context, '/api/chat', {
      method: 'POST',
      body: JSON.stringify(toOllamaRequest(request, true)),
    }, request.timeoutMs)
    if (!response.body) throw new ProviderExecutionError('AI_STREAM_INTERRUPTED', 'Ollama stream did not include a response body', true, response.status)
    yield {type: 'execution.started'}
    let outputText = ''
    for await (const body of parseJsonLines(response.body)) {
      const delta = extractOllamaContent(body)
      if (delta) {
        outputText += delta
        yield {type: 'content.delta', delta}
      }
      if (body.done === true) {
        const usage = {
          inputTokens: numberOrUndefined(body.prompt_eval_count),
          outputTokens: numberOrUndefined(body.eval_count),
        }
        yield {type: 'usage.updated', usage}
        yield {
          type: 'execution.completed',
          outputText,
          structuredOutput: request.structuredOutput ? parseStructuredObject(outputText) : undefined,
          usage,
          metadata: redactedProviderMetadata({doneReason: body.done_reason}),
        }
      }
    }
  }

  async cancel(): Promise<void> {}

  async health(context: ProviderExecutionContext): Promise<ProviderHealthResult> {
    const started = Date.now()
    try {
      const models = await this.discoverModels(context)
      return {
        state: 'healthy',
        components: {
          configuration: 'configured',
          credentials: 'not-required',
          network: 'reachable',
          'model-discovery': 'available',
        },
        latencyMs: Date.now() - started,
        configuredModelCount: models.length,
      }
    } catch (error) {
      const mapped = normalizeOllamaError(error)
      return {
        state: mapped.failureCode === 'AI_PROVIDER_TIMEOUT' ? 'degraded' : 'unavailable',
        components: {
          configuration: 'configured',
          credentials: 'not-required',
          network: mapped.failureCode === 'AI_PROVIDER_TIMEOUT' ? 'timeout' : 'unavailable',
          'model-discovery': 'failed',
        },
        latencyMs: Date.now() - started,
        failureCode: mapped.failureCode,
      }
    }
  }

  private async fetchOllama(
    context: ProviderExecutionContext,
    path: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const baseUrl = context.credentials?.baseUrl ?? DEFAULT_OLLAMA_BASE_URL
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const abort = () => controller.abort()
    context.signal?.addEventListener('abort', abort, {once: true})
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...(context.credentials?.headers ?? {}),
          ...(init.headers as Record<string, string> | undefined),
        },
        signal: controller.signal,
      })
      if (!response.ok) throw await providerErrorFromResponse(response)
      return response
    } catch (error) {
      throw normalizeOllamaError(error)
    } finally {
      clearTimeout(timeout)
      context.signal?.removeEventListener('abort', abort)
    }
  }
}

function toOllamaRequest(request: ProviderExecutionRequest, stream: boolean): Record<string, unknown> {
  return {
    model: request.providerModelId,
    messages: request.messages.map(toOllamaMessage),
    stream,
    format: request.structuredOutput ? (request.outputSchema ?? {type: 'object'}) : undefined,
    options: {
      num_predict: request.maxOutputUnits,
    },
  }
}

function toOllamaMessage(message: ProviderExecutionMessage): Record<string, string> {
  return {
    role: message.role === 'developer' || message.role === 'tool' ? 'user' : message.role,
    content: message.content,
  }
}

function extractOllamaContent(body: Record<string, unknown>): string {
  const message = body.message && typeof body.message === 'object' ? body.message as Record<string, unknown> : null
  if (typeof message?.content === 'string') return message.content
  if (typeof body.response === 'string') return body.response
  return ''
}

function parseStructuredObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {
    throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'Ollama structured response was not valid JSON', false)
  }
  throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'Ollama structured response was not a JSON object', false)
}

async function providerErrorFromResponse(response: Response): Promise<ProviderExecutionError> {
  const text = await response.text().catch(() => '')
  if (response.status === 404) return new ProviderExecutionError('AI_MODEL_UNAVAILABLE', 'Ollama model is unavailable', false, response.status)
  if (response.status === 408 || response.status === 504) return new ProviderExecutionError('AI_PROVIDER_TIMEOUT', 'Ollama request timed out', true, response.status)
  if (response.status === 429) return new ProviderExecutionError('AI_PROVIDER_RATE_LIMITED', 'Ollama request was rate limited', true, response.status)
  return new ProviderExecutionError('AI_PROVIDER_UNAVAILABLE', text ? 'Ollama request failed' : 'Ollama provider unavailable', response.status >= 500, response.status)
}

function normalizeOllamaError(error: unknown): ProviderExecutionError {
  if (error instanceof ProviderExecutionError) return error
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ProviderExecutionError('AI_PROVIDER_TIMEOUT', 'Ollama request timed out', true)
  }
  return new ProviderExecutionError('AI_PROVIDER_UNAVAILABLE', 'Ollama provider unavailable', true)
}

async function *parseJsonLines(body: ReadableStream<Uint8Array>): AsyncIterable<Record<string, unknown>> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const {done, value} = await reader.read()
      if (done) break
      buffer += decoder.decode(value, {stream: true})
      let boundary = buffer.indexOf('\n')
      while (boundary >= 0) {
        const raw = buffer.slice(0, boundary).trim()
        buffer = buffer.slice(boundary + 1)
        if (raw) {
          const parsed = JSON.parse(raw) as unknown
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) yield parsed as Record<string, unknown>
        }
        boundary = buffer.indexOf('\n')
      }
    }
    if (buffer.trim()) {
      const parsed = JSON.parse(buffer.trim()) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) yield parsed as Record<string, unknown>
    }
  } finally {
    reader.releaseLock()
  }
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
