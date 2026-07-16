import {ModulaApiError, isAuthenticationError} from '@/api/contracts/ApiError'
import type {ApiMethod} from '@/api/contracts/ApiRequest'
import type {ApiTransport} from '@/api/transport/ApiTransport'
import {decodeApiEnvelope} from '@/api/decoding/decodeApiEnvelope'
import {createJsonHeaders} from '@/api/client/requestHeaders'
import {createRequestId} from '@/api/client/requestId'
import type {AccessToken} from '@/auth/contracts/SessionTokens'

type ApiClientInput = {
  transport: ApiTransport
  getAccessToken?: () => AccessToken | null
  onSessionExpired?: () => Promise<AccessToken | null>
  log?: (input: {
    method: ApiMethod
    path: string
    status: number
    durationMs: number
    requestId: string
    retry: number
  }) => void
}

type RequestInput = {
  path: string
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
  signal?: AbortSignal
  authenticated?: boolean
}

export class ApiClient {
  constructor(private readonly input: ApiClientInput) {}

  get<T>(request: RequestInput, decode: (data: unknown) => T): Promise<T> {
    return this.request('GET', request, decode)
  }

  post<T>(request: RequestInput, decode: (data: unknown) => T): Promise<T> {
    return this.request('POST', request, decode)
  }

  patch<T>(request: RequestInput, decode: (data: unknown) => T): Promise<T> {
    return this.request('PATCH', request, decode)
  }

  delete<T>(request: RequestInput, decode: (data: unknown) => T): Promise<T> {
    return this.request('DELETE', request, decode)
  }

  private async request<T>(
    method: ApiMethod,
    request: RequestInput,
    decode: (data: unknown) => T,
    retry = 0,
  ): Promise<T> {
    const started = Date.now()
    const requestId = createRequestId()
    const accessToken = request.authenticated ? this.input.getAccessToken?.() ?? null : null
    const response = await this.input.transport.send({
      method,
      path: request.path,
      query: request.query,
      body: request.body,
      signal: request.signal,
      headers: createJsonHeaders({accessToken, requestId}),
    })
    this.input.log?.({
      method,
      path: request.path,
      status: response.status,
      durationMs: Date.now() - started,
      requestId,
      retry,
    })

    const envelope = decodeApiEnvelope(response.body, decode)
    if (envelope.ok) return envelope.data

    const error = new ModulaApiError({
      message: envelope.error.message,
      code: envelope.error.code,
      status: response.status,
      requestId: envelope.meta.requestId,
      retryable: envelope.error.retryable,
      fieldErrors: envelope.error.fieldErrors,
    })

    if (request.authenticated && retry === 0 && isAuthenticationError(error) && this.input.onSessionExpired) {
      const nextToken = await this.input.onSessionExpired()
      if (nextToken) {
        return this.request(method, request, decode, 1)
      }
    }

    throw error
  }
}
