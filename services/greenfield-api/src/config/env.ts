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
    .transform(v => v === 'true'),
  MODULA_INVITE_ONLY: z
    .string()
    .optional()
    .transform(v => v !== 'false'),
  MODULA_REGISTRATION_INVITE_CODES: z.string().optional(),
  MODULA_ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  MODULA_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  MODULA_EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  MODULA_CHECKPOINT_SIGNING_KEY: z.string().optional(),
  MODULA_SESSION_PEPPER: z.string().optional(),
  MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY: z.string().min(1).optional(),
  MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY_PREVIOUS: z.string().min(1).optional(),
  MODULA_PDS_PILOT_ENABLED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  GREENFIELD_MODULE_REGISTRY_ENABLED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  GREENFIELD_MODULE_INSTALLATION_ENABLED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  GREENFIELD_MODULE_DECLARATIVE_CONTRIBUTIONS_ENABLED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  GREENFIELD_MODULE_FIRST_PARTY_EXECUTION_ENABLED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  GREENFIELD_MODULE_REMOTE_FUNCTIONS_ENABLED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  GREENFIELD_MODULE_COMMUNITY_EXECUTION_ENABLED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  GREENFIELD_MODULE_GITHUB_SYNC_ENABLED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  GREENFIELD_VAULT_NOTES_REFERENCE_ENABLED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  GREENFIELD_DIMON_ENABLED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  /** Comma-separated handles granted admin:* capabilities on preview session mint. Preview/dev only. */
  MODULA_ADMIN_HANDLES: z.string().optional(),
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
  inviteOnly: boolean
  registrationInviteCodes: string[]
  accessTokenTtlMinutes: number
  refreshTokenTtlDays: number
  emailVerificationTtlHours: number
  checkpointSigningKey?: string
  sessionPepper?: string
  /** Current (highest version) key used to encrypt new AT Protocol OAuth session material. */
  atprotoOAuthEncryptionKey: EncryptionKeyMaterial
  /** Older keys kept only for decrypting previously encrypted material during rotation. */
  atprotoOAuthEncryptionKeysByVersion: Map<number, Buffer>
  atprotoOAuthEncryptionKeyIsEphemeral: boolean
  pdsPilotEnabled: boolean
  moduleRegistryEnabled: boolean
  moduleInstallationEnabled: boolean
  moduleDeclarativeContributionsEnabled: boolean
  moduleFirstPartyExecutionEnabled: boolean
  moduleRemoteFunctionsEnabled: boolean
  moduleCommunityExecutionEnabled: boolean
  moduleGithubSyncEnabled: boolean
  vaultNotesReferenceEnabled: boolean
  dimonEnabled: boolean
  /** Lower-cased handles granted admin:moderation + admin:ops on preview session mint. */
  adminHandles: string[]
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
  // Preview containers often run with NODE_ENV=production while MODULA_ENVIRONMENT=preview.
  // Authenticated preview writes are allowed in that mode; only true production forbids them.
  if (raw.MODULA_ENVIRONMENT === 'production' && raw.MODULA_PREVIEW_WRITES_ENABLED) {
    refuse('preview writes must be disabled in production')
  }
  // Inside Docker the process must listen on 0.0.0.0 so the published
  // host-loopback mapping (127.0.0.1:4020->4020) can reach it. Host-level
  // exposure remains loopback-only via compose port publishing.
  if (
    raw.MODULA_API_HOST === '0.0.0.0' &&
    raw.MODULA_ENVIRONMENT === 'production' &&
    env.MODULA_ALLOW_DOCKER_BIND !== 'true'
  ) {
    refuse('API host must bind to loopback in production unless MODULA_ALLOW_DOCKER_BIND=true')
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
  } else if (isEphemeralEligible || raw.MODULA_ATPROTO_ENABLED !== true) {
    // Ephemeral material is fine in development/test, and when the optional AT bridge is disabled.
    const key = randomBytes(32)
    currentKey = {version: 1, key}
    keysByVersion.set(1, key)
    isEphemeral = true
  } else {
    refuse(
      'MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY is required when MODULA_ATPROTO_ENABLED=true outside development/test (base64-encoded 32 bytes)',
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
    atprotoEnabled: raw.MODULA_ATPROTO_ENABLED === true,
    inviteOnly: raw.MODULA_INVITE_ONLY !== false,
    registrationInviteCodes: (raw.MODULA_REGISTRATION_INVITE_CODES ?? '').split(',').map(code => code.trim()).filter(Boolean),
    accessTokenTtlMinutes: raw.MODULA_ACCESS_TOKEN_TTL_MINUTES,
    refreshTokenTtlDays: raw.MODULA_REFRESH_TOKEN_TTL_DAYS,
    emailVerificationTtlHours: raw.MODULA_EMAIL_VERIFICATION_TTL_HOURS,
    checkpointSigningKey: raw.MODULA_CHECKPOINT_SIGNING_KEY,
    sessionPepper: raw.MODULA_SESSION_PEPPER,
    atprotoOAuthEncryptionKey: currentKey,
    atprotoOAuthEncryptionKeysByVersion: keysByVersion,
    atprotoOAuthEncryptionKeyIsEphemeral: isEphemeral,
    pdsPilotEnabled: Boolean(raw.MODULA_PDS_PILOT_ENABLED),
    moduleRegistryEnabled: Boolean(raw.GREENFIELD_MODULE_REGISTRY_ENABLED),
    moduleInstallationEnabled: Boolean(raw.GREENFIELD_MODULE_INSTALLATION_ENABLED),
    moduleDeclarativeContributionsEnabled: Boolean(raw.GREENFIELD_MODULE_DECLARATIVE_CONTRIBUTIONS_ENABLED),
    moduleFirstPartyExecutionEnabled: Boolean(raw.GREENFIELD_MODULE_FIRST_PARTY_EXECUTION_ENABLED),
    moduleRemoteFunctionsEnabled: Boolean(raw.GREENFIELD_MODULE_REMOTE_FUNCTIONS_ENABLED),
    moduleCommunityExecutionEnabled: Boolean(raw.GREENFIELD_MODULE_COMMUNITY_EXECUTION_ENABLED),
    moduleGithubSyncEnabled: Boolean(raw.GREENFIELD_MODULE_GITHUB_SYNC_ENABLED),
    vaultNotesReferenceEnabled: Boolean(raw.GREENFIELD_VAULT_NOTES_REFERENCE_ENABLED),
    dimonEnabled: Boolean(raw.GREENFIELD_DIMON_ENABLED),
    adminHandles: (raw.MODULA_ADMIN_HANDLES ?? '')
      .split(',')
      .map(h => h.trim().toLowerCase())
      .filter(Boolean),
  }
}
