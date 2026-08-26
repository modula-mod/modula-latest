import {describe, expect, it} from 'vitest'
import {ModulaAIBackendProviderAdapter} from '../src/ai/providers/modula-ai-backend-provider.js'
import type {ProviderExecutionRequest} from '../src/ai/providers/contract.js'
import {loadConfig} from '../src/config/env.js'

describe('Greenfield Backend V1 AI backend adapter', () => {
  it('sends a provider-neutral request with a scoped service assertion and no raw bearer', async () => {
    let captured: {url: string; init?: RequestInit} | null = null
    const fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
      captured = {url: String(input), ...(init ? {init} : {})}
      return response({ok: true, data: {
        requestId: 'request-ai-adapter', provider: 'openai', model: 'gpt-test', providerRequestId: 'provider-request',
        outputText: 'provider result', structuredOutput: null,
        usage: {inputTokens: 11, outputTokens: 4, cachedInputTokens: 2, requests: 1},
        attemptedTargets: [{provider: 'openai', model: 'gpt-test', outcome: 'succeeded', errorCode: null}],
      }})
    }) as typeof globalThis.fetch
    const adapter = createAdapter(fetch)
    const result = await adapter.execute(providerRequest(), {providerId: 'provider:openai'})
    const call = captured as unknown as {url: string; init?: RequestInit}
    expect(call.url).toBe('http://modula-ai-backend:4040/v1/ai/completions')
    const headers = new Headers(call.init?.headers)
    expect(headers.get('authorization')).toBeNull()
    const claims = assertionClaims(headers.get('x-modula-service-assertion'))
    expect(claims).toMatchObject({
      issuer: 'https://api.modula.digital', subject: 'service.greenfield.gateway', consumer: 'digital.modula.vault-ai',
      target: 'service.modula-ai', serviceId: 'service.modula-ai', audience: 'modula-engine:ai',
      accountId: 'account-ai-adapter', targetInstallationId: 'installation-ai-adapter',
    })
    expect(claims.capabilities).toEqual(['ai.generate', 'secrets.use.direct'])
    expect(result).toMatchObject({outputText: 'provider result', usage: {inputTokens: 11, outputTokens: 4, cachedInputTokens: 2}})
  })

  it('maps truthful not-configured and provider health without exposing credential material', async () => {
    let call = 0
    const fetch = (async () => {
      call += 1
      if (call === 1) return response({ok: false, error: {code: 'PROVIDER_NOT_CONFIGURED', message: 'not configured', retryable: false}}, 503)
      return response({ok: true, data: {providers: [{provider: 'openai', state: 'not-configured', errorCode: 'CREDENTIAL_NOT_CONFIGURED'}]}})
    }) as typeof globalThis.fetch
    const adapter = createAdapter(fetch)
    await expect(adapter.execute(providerRequest(), {providerId: 'provider:openai'})).rejects.toMatchObject({failureCode: 'AI_MODEL_UNAVAILABLE'})
    expect(await adapter.health({providerId: 'provider:openai'})).toMatchObject({
      state: 'disabled', failureCode: 'AI_MODEL_UNAVAILABLE', components: {network: 'service-fabric', execution: 'service.modula-ai'},
    })
  })

  it('rejects an oversized chunked backend response before parsing it', async () => {
    const fetch = (async () => response({
      ok: true,
      data: {outputText: 'x'.repeat(2_097_152), usage: {}},
    })) as typeof globalThis.fetch
    const adapter = createAdapter(fetch)
    await expect(adapter.execute(providerRequest(), {providerId: 'provider:openai'})).rejects.toMatchObject({
      failureCode: 'AI_PROVIDER_RESPONSE_INVALID',
    })
  })

  it('accepts only the registered private AI service origin in production', () => {
    expect(loadConfig(configEnv({MODULA_AI_BACKEND_URL: 'http://modula-ai-backend:4040'})).aiBackendUrl)
      .toBe('http://modula-ai-backend:4040')
    for (const target of ['https://example.invalid', 'http://modula-ai-backend:9999', 'http://127.0.0.1:4040']) {
      expect(() => loadConfig(configEnv({MODULA_AI_BACKEND_URL: target}))).toThrow(/approved private service identity/)
    }
  })
})

function createAdapter(fetch: typeof globalThis.fetch) {
  return new ModulaAIBackendProviderAdapter({
    providerId: 'provider:openai', backendProviderId: 'openai', baseUrl: 'http://modula-ai-backend:4040',
    issuer: 'https://api.modula.digital', signingKey: 'test-only-greenfield-service-signing-key-000000', maximumTimeoutMs: 30_000, fetch,
  })
}

function providerRequest(): ProviderExecutionRequest {
  return {
    executionId: 'execution-ai-adapter', requestId: 'request-ai-adapter', accountId: 'account-ai-adapter',
    actorId: 'actor-ai-adapter', moduleId: 'digital.modula.vault-ai', installationId: 'installation-ai-adapter',
    modelId: 'greenfield.openai.general', providerModelId: 'gpt-test', messages: [{role: 'user', content: 'test input'}],
    maxInputUnits: 100, maxOutputUnits: 50, timeoutMs: 5_000, structuredOutput: false, stream: false, toolIds: [], metadata: {traceId: 'trace-ai-adapter'},
  }
}

function assertionClaims(token: string | null): Record<string, any> {
  expect(token).toBeTypeOf('string')
  const payload = String(token).split('.')[1]
  return JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8')) as Record<string, any>
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}})
}

function configEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    MODULA_ENVIRONMENT: 'production',
    MODULA_PUBLIC_API_URL: 'https://api.modula.digital',
    MODULA_PUBLIC_WEB_URL: 'https://modula.digital',
    MODULA_DATABASE_URL: 'postgres://unused/greenfield',
    MODULA_ALLOWED_ORIGINS: 'https://modula.digital',
    MODULA_PREVIEW_WRITES_ENABLED: 'false',
    MODULA_ATPROTO_ENABLED: 'false',
    ...overrides,
  }
}
