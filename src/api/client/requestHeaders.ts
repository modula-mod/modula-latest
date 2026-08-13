import type {AccessToken} from '@/auth/contracts/SessionTokens'

export function createJsonHeaders(input?: {
  accessToken?: AccessToken | null
  requestId?: string
  hasBody?: boolean
  headers?: Record<string, string>
}): Record<string, string> {
  return {
    Accept: 'application/json',
    ...(input?.hasBody ? {'Content-Type': 'application/json'} : {}),
    ...(input?.requestId ? {'X-Modula-Request-Id': input.requestId} : {}),
    ...(input?.accessToken ? {Authorization: `Bearer ${input.accessToken}`} : {}),
    ...(input?.headers ?? {}),
  }
}
