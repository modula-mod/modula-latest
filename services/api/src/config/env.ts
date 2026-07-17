import {z} from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MODULA_API_HOST: z.string().default('127.0.0.1'),
  MODULA_API_PORT: z.coerce.number().int().positive().default(4020),
  MODULA_PUBLIC_API_URL: z.string().url(),
  MODULA_DATABASE_URL: z.string().min(1),
  MODULA_DATABASE_MIGRATOR_URL: z.string().min(1).optional(),
  MODULA_ALLOWED_ORIGINS: z.string().min(1),
  MODULA_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  MODULA_TRUST_PROXY: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  MODULA_RATE_LIMIT_ENABLED: z
    .string()
    .optional()
    .transform(v => v !== 'false'),
  MODULA_PREVIEW_WRITES_ENABLED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  MODULA_API_DOCUMENTATION_ENABLED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  MODULA_ENVIRONMENT: z.enum(['development', 'preview', 'production']).default('development'),
  MODULA_MINIMUM_CLIENT_VERSION: z.string().default('0.1.0'),
})

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production'
  host: string
  port: number
  publicApiUrl: string
  databaseUrl: string
  migratorDatabaseUrl: string
  allowedOrigins: string[]
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'
  trustProxy: boolean
  rateLimitEnabled: boolean
  previewWritesEnabled: boolean
  apiDocumentationEnabled: boolean
  environment: 'development' | 'preview' | 'production'
  minimumClientVersion: string
}

function refuse(message: string): never {
  throw new Error(`Invalid Modula API configuration: ${message}`)
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) {
    refuse(parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '))
  }
  const raw = parsed.data
  const allowedOrigins = raw.MODULA_ALLOWED_ORIGINS.split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (allowedOrigins.includes('*')) {
    refuse('origin list must not contain *')
  }
  if (raw.MODULA_DATABASE_URL.includes('placeholder') || raw.MODULA_DATABASE_URL.includes('change-me')) {
    if (raw.NODE_ENV === 'production' || raw.MODULA_ENVIRONMENT === 'production' || raw.MODULA_ENVIRONMENT === 'preview') {
      refuse('placeholder database credentials are not allowed')
    }
  }
  if (
    (raw.NODE_ENV === 'production' || raw.MODULA_ENVIRONMENT === 'production' || raw.MODULA_ENVIRONMENT === 'preview') &&
    !raw.MODULA_PUBLIC_API_URL.startsWith('https://')
  ) {
    refuse('public API URL must be HTTPS outside local development')
  }
  if (
    (raw.NODE_ENV === 'production' || raw.MODULA_ENVIRONMENT === 'production') &&
    raw.MODULA_PREVIEW_WRITES_ENABLED
  ) {
    refuse('preview writes must be disabled in production')
  }
  if (raw.MODULA_API_HOST === '0.0.0.0' && (raw.NODE_ENV === 'production' || raw.MODULA_ENVIRONMENT === 'preview')) {
    refuse('API host must bind to loopback in preview/production (use 127.0.0.1)')
  }

  return {
    nodeEnv: raw.NODE_ENV,
    host: raw.MODULA_API_HOST,
    port: raw.MODULA_API_PORT,
    publicApiUrl: raw.MODULA_PUBLIC_API_URL,
    databaseUrl: raw.MODULA_DATABASE_URL,
    migratorDatabaseUrl: raw.MODULA_DATABASE_MIGRATOR_URL ?? raw.MODULA_DATABASE_URL,
    allowedOrigins,
    logLevel: raw.MODULA_LOG_LEVEL,
    trustProxy: Boolean(raw.MODULA_TRUST_PROXY),
    rateLimitEnabled: raw.MODULA_RATE_LIMIT_ENABLED !== false,
    previewWritesEnabled: Boolean(raw.MODULA_PREVIEW_WRITES_ENABLED),
    apiDocumentationEnabled: Boolean(raw.MODULA_API_DOCUMENTATION_ENABLED),
    environment: raw.MODULA_ENVIRONMENT,
    minimumClientVersion: raw.MODULA_MINIMUM_CLIENT_VERSION,
  }
}
