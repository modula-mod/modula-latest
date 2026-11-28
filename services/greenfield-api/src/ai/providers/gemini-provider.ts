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

const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

export class GeminiGreenfieldAIProviderAdapter implements GreenfieldAIProviderAdapter {
  constructor(readonly providerId: string) {}

  async discoverModels(context: ProviderExecutionContext): Promise<DiscoveredAIModel[]> {
    const response = await this.fetchGemini(context, '/models', {method: 'GET'}, 10_000)
    const body = await response.json() as {models?: Array<{name?: string; displayName?: string; supportedGenerationMethods?: string[]}>}
    return (body.models ?? [])
      .filter((model): model is {name: string; displayName?: string; supportedGenerationMethods?: string[]} =>
        typeof model.name === 'string' && (model.supportedGenerationMethods ?? []).includes('generateContent'))
      .map(model => {
        const providerModelId = model.name.replace(/^models\//, '')
        return {
          modelId: `gemini.${providerModelId}`,
          providerModelId,
          displayName: model.displayName ?? providerModelId,
          capabilities: ['chat', 'text-generation', 'streaming', 'structured-output', 'reasoning', 'vision', 'tool-calling'],
          supportsStreaming: true,
          supportsStructuredOutputs: true,
        }
      })
  }

  async execute(request: ProviderExecutionRequest, context: ProviderExecutionContext): Promise<ProviderExecutionResult> {
    const response = await this.fetchGemini(context, `/models/${encodeURIComponent(request.providerModelId)}:generateContent`, {
      method: 'POST',
      body: JSON.stringify(toGeminiRequest(request)),
    }, request.timeoutMs)
    const body = await response.json() as Record<string, unknown>
    const outputText = extractGeminiOutputText(body)
    if (request.structuredOutput) {
      if (!outputText) {
        throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'Gemini structured response was empty', false, response.status)
      }
      const structured = parseStructuredObject(outputText)
      return {
        outputText,
        structuredOutput: structured,
        usage: extractGeminiUsage(body),
        responseMetadata: redactedProviderMetadata({
          modelVersion: body.modelVersion,
          finishReason: firstCandidate(body)?.finishReason,
        }),
      }
    }
    if (!outputText) {
      throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'Gemini response did not include output text', false, response.status)
    }
    return {
      outputText,
      usage: extractGeminiUsage(body),
      responseMetadata: redactedProviderMetadata({
        modelVersion: body.modelVersion,
        finishReason: firstCandidate(body)?.finishReason,
      }),
    }
  }

  async *stream(request: ProviderExecutionRequest, context: ProviderExecutionContext): AsyncIterable<ProviderStreamEvent> {
    const response = await this.fetchGemini(context, `/models/${encodeURIComponent(request.providerModelId)}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      body: JSON.stringify(toGeminiRequest(request)),
    }, request.timeoutMs)
    if (!response.body) throw new ProviderExecutionError('AI_STREAM_INTERRUPTED', 'Gemini stream did not include a response body', true, response.status)
    yield {type: 'execution.started'}
    let outputText = ''
    let usage: GreenfieldAIUsageUnits = {}
    for await (const event of parseSse(response.body)) {
      const data = parseJsonObject(event.data)
      if (!data) continue
      const chunkText = extractGeminiOutputText(data)
      if (chunkText) {
        outputText += chunkText
        yield {type: 'content.delta', delta: chunkText}
      }
      const chunkUsage = extractGeminiUsage(data)
      if (chunkUsage.inputTokens !== undefined || chunkUsage.outputTokens !== undefined) usage = {...usage, ...chunkUsage}
      const finishReason = firstCandidate(data)?.finishReason
      if (typeof finishReason === 'string' && finishReason !== '') {
        yield {type: 'reasoning.status', status: 'validating'}
      }
    }
    if (request.structuredOutput) {
      if (!outputText) throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'Gemini structured response was empty', false)
      const structured = parseStructuredObject(outputText)
      yield {type: 'execution.completed', outputText, structuredOutput: structured, usage}
    } else {
      yield {type: 'execution.completed', outputText, usage}
    }
  }

  async cancel(): Promise<void> {
    // The Generative Language API has no server-side cancel endpoint. The
    // runtime aborts the fetch via the AbortSignal and stops forwarding
    // output; this no-op keeps the adapter contract explicit about that.
  }

  async health(context: ProviderExecutionContext): Promise<ProviderHealthResult> {
    const started = Date.now()
    try {
      const response = await this.fetchGemini(context, '/models', {method: 'GET'}, 10_000)
      const body = await response.json() as {models?: unknown[]}
      return {
        state: 'healthy',
        components: {
          configuration: 'configured',
          credentials: 'verified',
          network: 'reachable',
          'model-discovery': 'available',
        },
        latencyMs: Date.now() - started,
        configuredModelCount: Array.isArray(body.models) ? body.models.length : 0,
      }
    } catch (error) {
      const mapped = normalizeGeminiError(error)
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

  private async fetchGemini(
    context: ProviderExecutionContext,
    path: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const apiKey = context.credentials?.apiKey
    if (!apiKey) throw new ProviderExecutionError('AI_PROVIDER_AUTH_FAILED', 'Gemini credential is not configured', false, 401)
    const baseUrl = context.credentials?.baseUrl ?? DEFAULT_GEMINI_BASE_URL
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const abort = () => controller.abort()
    context.signal?.addEventListener('abort', abort, {once: true})
    try {
      const headers: Record<string, string> = {
        'x-goog-api-key': apiKey,
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
      throw normalizeGeminiError(error)
    } finally {
      clearTimeout(timeout)
      context.signal?.removeEventListener('abort', abort)
    }
  }
}

function toGeminiRequest(request: ProviderExecutionRequest): Record<string, unknown> {
  const {systemInstruction, contents} = splitSystemMessages(request.messages)
  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: request.maxOutputUnits,
      ...(request.structuredOutput && request.outputSchema
        ? {responseMimeType: 'application/json', responseSchema: request.outputSchema}
        : {}),
    },
  }
  if (systemInstruction) body.systemInstruction = {parts: [{text: systemInstruction}]}
  return body
}

function splitSystemMessages(messages: ProviderExecutionMessage[]): {systemInstruction?: string; contents: Array<{role: 'user' | 'model'; parts: Array<{text: string}>}>} {
  const systemParts: string[] = []
  const contents: Array<{role: 'user' | 'model'; parts: Array<{text: string}>}> = []
  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(message.content)
      continue
    }
    const role = message.role === 'assistant' ? 'model' : 'user'
    const last = contents[contents.length - 1]
    // Gemini requires strictly alternating roles; merge consecutive
    // same-role messages (the gateway assembles several user fragments).
    if (last && last.role === role) last.parts[0]!.text = `${last.parts[0]!.text}\n\n${message.content}`
    else contents.push({role, parts: [{text: message.content}]})
  }
  return {systemInstruction: systemParts.length > 0 ? systemParts.join('\n\n') : undefined, contents}
}

function firstCandidate(body: Record<string, unknown>): Record<string, unknown> | undefined {
  const candidates = Array.isArray(body.candidates) ? body.candidates : []
  const first = candidates[0]
  return first && typeof first === 'object' ? first as Record<string, unknown> : undefined
}

function extractGeminiOutputText(body: Record<string, unknown>): string {
  const candidates = Array.isArray(body.candidates) ? body.candidates : []
  const pieces: string[] = []
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const content = (candidate as {content?: unknown}).content
    const parts = content && typeof content === 'object' && Array.isArray((content as {parts?: unknown}).parts)
      ? (content as {parts: unknown[]}).parts
      : []
    for (const part of parts) {
      if (!part || typeof part !== 'object') continue
      const text = (part as {text?: unknown}).text
      if (typeof text === 'string') pieces.push(text)
    }
  }
  return pieces.join('')
}

function extractGeminiUsage(body: Record<string, unknown>): GreenfieldAIUsageUnits {
  const usage = body.usageMetadata && typeof body.usageMetadata === 'object' ? body.usageMetadata as Record<string, unknown> : {}
  return {
    inputTokens: numberOrUndefined(usage.promptTokenCount),
    outputTokens: numberOrUndefined(usage.candidatesTokenCount),
    cachedInputTokens: numberOrUndefined(usage.cachedContentTokenCount),
  }
}

function parseStructuredObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {
    throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'Gemini structured response was not valid JSON', false)
  }
  throw new ProviderExecutionError('AI_PROVIDER_RESPONSE_INVALID', 'Gemini structured response was not a JSON object', false)
}

function geminiErrorCode(status: string): GreenfieldAIExecutionFailureCode {
  if (status === 'UNAUTHENTICATED' || status === 'PERMISSION_DENIED') return 'AI_PROVIDER_AUTH_FAILED'
  if (status === 'RESOURCE_EXHAUSTED') return 'AI_PROVIDER_RATE_LIMITED'
  if (status === 'NOT_FOUND') return 'AI_MODEL_UNAVAILABLE'
  if (status === 'INVALID_ARGUMENT' || status === 'FAILED_PRECONDITION') return 'AI_PROVIDER_RESPONSE_INVALID'
  if (status === 'DEADLINE_EXCEEDED') return 'AI_PROVIDER_TIMEOUT'
  return 'AI_PROVIDER_UNAVAILABLE'
}

async function providerErrorFromResponse(response: Response): Promise<ProviderExecutionError> {
  const text = await response.text().catch(() => '')
  let status = ''
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const error = parsed.error && typeof parsed.error === 'object' ? parsed.error as Record<string, unknown> : {}
    if (typeof error.status === 'string') status = error.status
  } catch {
    // Fall through to the status-based mapping.
  }
  const failureCode = status ? geminiErrorCode(status) : response.status === 401 || response.status === 403
    ? 'AI_PROVIDER_AUTH_FAILED'
    : response.status === 408 || response.status === 504
      ? 'AI_PROVIDER_TIMEOUT'
      : response.status === 429
        ? 'AI_PROVIDER_RATE_LIMITED'
        : response.status === 404
          ? 'AI_MODEL_UNAVAILABLE'
          : 'AI_PROVIDER_UNAVAILABLE'
  const retryable = failureCode === 'AI_PROVIDER_RATE_LIMITED' || failureCode === 'AI_PROVIDER_TIMEOUT' || (failureCode === 'AI_PROVIDER_UNAVAILABLE' && response.status >= 500)
  return new ProviderExecutionError(failureCode, text ? 'Gemini request failed' : 'Gemini provider unavailable', retryable, response.status)
}

function normalizeGeminiError(error: unknown): ProviderExecutionError {
  if (error instanceof ProviderExecutionError) return error
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ProviderExecutionError('AI_PROVIDER_TIMEOUT', 'Gemini request timed out', true)
  }
  return new ProviderExecutionError('AI_PROVIDER_UNAVAILABLE', 'Gemini provider unavailable', true)
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
