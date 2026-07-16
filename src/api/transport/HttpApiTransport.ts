import {fetch} from 'expo/fetch'

import {ModulaApiError} from '@/api/contracts/ApiError'
import type {ApiRequest, ApiTransportResponse} from '@/api/contracts/ApiRequest'
import {createTimeoutSignal} from '@/api/client/requestTimeout'
import type {ApiTransport} from '@/api/transport/ApiTransport'

export class HttpApiTransport implements ApiTransport {
  constructor(private readonly baseUrl: string) {}

  async send(request: ApiRequest): Promise<ApiTransportResponse> {
    const {url, cleanup, signal} = this.prepareRequest(request)
    const startedAt = Date.now()
    try {
      const response = await fetch(url, {
        method: request.method,
        headers: request.headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        signal,
      })
      const contentType = response.headers.get('content-type') ?? ''
      const body = contentType.includes('application/json')
        ? await response.json()
        : await response.text()
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body,
      }
    } catch {
      if (signal.aborted) {
        throw new ModulaApiError({
          message: Date.now() - startedAt >= (request.timeoutMs ?? 15_000)
            ? 'Request timed out.'
            : 'Request cancelled.',
          code: Date.now() - startedAt >= (request.timeoutMs ?? 15_000) ? 'TIMEOUT' : 'CANCELLED',
          status: 0,
          retryable: Date.now() - startedAt >= (request.timeoutMs ?? 15_000),
        })
      }
      throw new ModulaApiError({
        message: 'Network request failed.',
        code: 'OFFLINE',
        status: 0,
        retryable: true,
      })
    } finally {
      cleanup()
    }
  }

  private prepareRequest(request: ApiRequest) {
    const url = new URL(request.path, this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`)
    for (const [key, value] of Object.entries(request.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
    const timeout = createTimeoutSignal(request.signal, request.timeoutMs)
    return {url: url.toString(), ...timeout}
  }
}
