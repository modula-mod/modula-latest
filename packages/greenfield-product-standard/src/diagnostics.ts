export type IngestDiagnostic = {
  code: string
  path: string
  message: string
  severity: 'error' | 'warning'
}

export function ingestError(code: string, path: string, message: string): IngestDiagnostic {
  return {code, path, message, severity: 'error'}
}

export const FORBIDDEN_SECRET_KEYS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'privateKey',
  'private_key',
  'clientSecret',
  'client_secret',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'bearer',
  'credential',
  'credentials',
] as const
