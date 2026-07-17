import {randomBytes} from 'node:crypto'
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
    .transform(v => v !== 'false'),
  MODULA_API_DOCUMENTATION_ENABLED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  MODULA_ENVIRONMENT: z.enum(['development', 'preview', 'production']).default('development'),
  MODULA_MINIMUM_CLIENT_VERSION: z.string().default('0.1.0'),
  MODULA_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(720),
  MODULA_ATPROTO_ENABLED: z
    .string()
    .optional()
    .transform(v => v !== 'false'),
  MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY: z.string().min(1).optional(),
  MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY_PREVIOUS: z.string().min(1).optional(),
  MODULA_PDS_PILOT_ENABLED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
})

export type EncryptionKeyMaterial = {
  version: number
  key: Buffer
}

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
  /** Derived: true unless environment is production and previewWritesEnabled is false. */
  mutationsEnabled: boolean
  sessionTtlHours: number
  atprotoEnabled: boolean
  /** Current (highest version) key used to encrypt new AT Protocol OAuth session material. */
  atprotoOAuthEncryptionKey: EncryptionKeyMaterial
  /** Older keys kept only for decrypting previously encrypted material during rotation. */
  atprotoOAuthEncryptionKeysByVersion: Map<number, Buffer>
  atprotoOAuthEncryptionKeyIsEphemeral: boolean
  pdsPilotEnabled: boolean
}

function refuse(message: string): never {
  throw new Error(`Invalid Modula API configuration: ${message}`)
}

function decodeBase64Key(label: string, value: string): Buffer {
  const buffer = Buffer.from(value, 'base64')
  if (buffer.length !== 32) {
    refuse(`${label} must decode from base64 to exactly 32 bytes (AES-256)`)
  }
  return buffer
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

  const environment = raw.MODULA_ENVIRONMENT
  const isEphemeralEligible = environment === 'development' || raw.NODE_ENV === 'test'

  let currentKey: EncryptionKeyMaterial
  let isEphemeral = false
  const keysByVersion = new Map<number, Buffer>()

  if (raw.MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY) {
    const key = decodeBase64Key('MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY', raw.MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY)
    currentKey = {version: 1, key}
    keysByVersion.set(1, key)
    if (raw.MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY_PREVIOUS) {
      const previous = decodeBase64Key(
        'MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY_PREVIOUS',
        raw.MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY_PREVIOUS,
      )
      keysByVersion.set(0, previous)
    }
  } else if (isEphemeralEligible) {
    const key = randomBytes(32)
    currentKey = {version: 1, key}
    keysByVersion.set(1, key)
    isEphemeral = true
  } else {
    refuse(
      'MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY is required outside development/test (base64-encoded 32 bytes)',
    )
  }

  const mutationsEnabled = environment !== 'production' && raw.MODULA_PREVIEW_WRITES_ENABLED

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
    environment,
    minimumClientVersion: raw.MODULA_MINIMUM_CLIENT_VERSION,
    mutationsEnabled,
    sessionTtlHours: raw.MODULA_SESSION_TTL_HOURS,
    atprotoEnabled: raw.MODULA_ATPROTO_ENABLED !== false,
    atprotoOAuthEncryptionKey: currentKey,
    atprotoOAuthEncryptionKeysByVersion: keysByVersion,
    atprotoOAuthEncryptionKeyIsEphemeral: isEphemeral,
    pdsPilotEnabled: Boolean(raw.MODULA_PDS_PILOT_ENABLED),
  }
}
