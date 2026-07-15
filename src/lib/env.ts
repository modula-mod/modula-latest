export type AppEnv = 'development' | 'staging' | 'production'

export type ModulaEnv = {
  appEnv: AppEnv
  apiUrl: string
}

function readAppEnv(value: string | undefined): AppEnv {
  if (value === 'development' || value === 'staging' || value === 'production') {
    return value
  }
  return 'development'
}

function readApiUrl(value: string | undefined): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }
  return 'http://localhost:4010'
}

/**
 * Validates bootstrap environment values without a schema library.
 * Missing values fall back to safe development defaults so the foundation
 * screen can render without an API server.
 */
export function getEnv(): ModulaEnv {
  return {
    appEnv: readAppEnv(process.env.EXPO_PUBLIC_APP_ENV),
    apiUrl: readApiUrl(process.env.EXPO_PUBLIC_API_URL),
  }
}

export const env = getEnv()
