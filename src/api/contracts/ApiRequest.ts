export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type ApiRequest = {
  method: ApiMethod
  path: string
  headers?: Record<string, string>
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
}

export type ApiTransportResponse = {
  status: number
  headers: Record<string, string>
  body: unknown
}
