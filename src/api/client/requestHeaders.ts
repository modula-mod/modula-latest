import type {AccessToken} from '@/auth/contracts/SessionTokens'

export function createJsonHeaders(input?: {
  accessToken?: AccessToken | null
  requestId?: string
  headers?: Record<string, string>
}): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(input?.requestId ? {'X-Modula-Request-Id': input.requestId} : {}),
    ...(input?.accessToken ? {Authorization: `Bearer ${input.accessToken}`} : {}),
    ...(input?.headers ?? {}),
  }
}
