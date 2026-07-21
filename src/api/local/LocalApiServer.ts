import {
  ModulaApiError,
  isModulaApiError,
  type ApiEnvelope,
  type ApiRequest,
  type ApiTransportResponse,
} from '@/api/contracts'
import {createRequestId} from '@/api/client/requestId'
import type {LocalApiDatabase} from '@/api/local/LocalApiDatabase'
import {LocalApiRouter} from '@/api/local/LocalApiRouter'
import type {MutableLocalApiConfiguration} from '@/api/local/LocalApiConfiguration'

function statusToCode(status: number): ModulaApiError['code'] {
  if (status === 400) return 'BAD_REQUEST'
  if (status === 401) return 'UNAUTHENTICATED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  if (status === 429) return 'RATE_LIMITED'
  if (status >= 500) return 'SERVER_ERROR'
  return 'UNKNOWN'
}

function latencyForMode(mode: string): number {
  const seed = Date.now() % 97
  if (mode === 'instant') return seed % 10
  if (mode === 'slow') return 1200 + (seed % 800)
  return 180 + (seed % 270)
}

function shouldFail(input: {
  method: string
  path: string
  failureMode: string
}) {
  if (input.failureMode === 'none') return false
  if (input.failureMode === 'allRequests') return true
  if (input.failureMode === 'authentication') {
    return (
      input.path.startsWith('/v1/auth') ||
      input.path.startsWith('/v1/sessions') ||
      input.path.startsWith('/v1/accounts')
    )
  }
  if (input.failureMode === 'feed') return input.path.startsWith('/v1/feed')
  if (input.failureMode === 'mutations') return input.method !== 'GET'
  if (input.failureMode === 'nextRequest') return true
  return false
}

export class LocalApiServer {
  private router: LocalApiRouter

  constructor(
    private readonly database: LocalApiDatabase,
    private readonly configuration: MutableLocalApiConfiguration,
  ) {
    this.router = new LocalApiRouter(database, configuration)
  }

  resetRouter() {
    this.router = new LocalApiRouter(this.database, this.configuration)
  }

  async handle(request: ApiRequest): Promise<ApiTransportResponse> {
    const config = this.configuration.get()
    const waitMs = latencyForMode(config.latencyMode)
    if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs))

    const requestId = request.headers?.['X-Modula-Request-Id'] ?? createRequestId()
    const serverTime = new Date().toISOString()

    try {
      if (request.signal?.aborted) {
        throw new ModulaApiError({
          message: 'Request cancelled.',
          code: 'CANCELLED',
          status: 0,
          retryable: false,
        })
      }
      if (config.forcedStatus || shouldFail({method: request.method, path: request.path, failureMode: config.failureMode})) {
        if (config.failureMode === 'nextRequest') {
          this.configuration.update({failureMode: 'none'})
        }
        const status = config.forcedStatus ?? 500
        throw new ModulaApiError({
          message: 'Local API failure simulation.',
          code: statusToCode(status),
          status,
          retryable: status >= 500 || status === 429,
        })
      }

      const data = await this.router.handle(request)
      const body: ApiEnvelope<unknown> = {
        ok: true,
        data,
        meta: {requestId, serverTime},
      }
      return {status: 200, headers: {'content-type': 'application/json'}, body}
    } catch (error) {
      const apiError = isModulaApiError(error)
        ? error
        : new ModulaApiError({
            message: error instanceof Error && error.message === 'Route not found.'
              ? 'Route not found.'
              : 'Local API failed.',
            code: error instanceof Error && error.message === 'Route not found.'
              ? 'NOT_FOUND'
              : 'SERVER_ERROR',
            status: error instanceof Error && error.message === 'Route not found.' ? 404 : 500,
            retryable: true,
          })
      const body: ApiEnvelope<never> = {
        ok: false,
        error: {
          code: apiError.code,
          message: apiError.message,
          fieldErrors: apiError.fieldErrors,
          retryable: apiError.retryable,
        },
        meta: {requestId, serverTime},
      }
      return {
        status: apiError.status || 500,
        headers: {'content-type': 'application/json'},
        body,
      }
    }
  }
}
