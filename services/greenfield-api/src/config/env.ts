import {randomBytes} from 'node:crypto'
import {resolve} from 'node:path'
import {z} from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MODULA_API_HOST: z.string().default('127.0.0.1'),
  MODULA_API_PORT: z.coerce.number().int().positive().default(4020),
  MODULA_PUBLIC_API_URL: z.string().url(),
  MODULA_PUBLIC_WEB_URL: z.string().url().optional(),
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
  MODULA_PRODUCTION_WRITES_ENABLED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  MODULA_API_DOCUMENTATION_ENABLED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  MODULA_REQUEST_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(4_194_304),
  MODULA_SEARCH_QUERY_MAX_CHARS: z.coerce.number().int().positive().default(500),
  MODULA_SEARCH_DEFAULT_LIMIT: z.coerce.number().int().positive().default(20),
  MODULA_SEARCH_MAX_LIMIT: z.coerce.number().int().positive().default(100),
  MODULA_SEARCH_MAX_ENTITY_TYPES: z.coerce.number().int().positive().default(10),
  MODULA_SEARCH_MAX_TAGS: z.coerce.number().int().positive().default(20),
  MODULA_SEARCH_TIMEOUT_MS: z.coerce.number().int().positive().default(1500),
  MODULA_SEARCH_RECENT_LIMIT: z.coerce.number().int().positive().default(50),
  MODULA_MEDIA_ROOT: z.string().min(1).optional(),
  MODULA_MEDIA_UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(2_097_152),
  MODULA_SECRETS_SERVICE_URL: z.string().url().optional(),
  MODULA_SECRETS_SERVICE_TIMEOUT_MS: z.coerce.number().int().min(100).max(10_000).default(2_000),
  MODULA_AI_BACKEND_URL: z.string().url().optional(),
  MODULA_AI_BACKEND_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
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
    .transform(v => (v === undefined ? undefined : v !== 'false')),
  MODULA_REGISTRATION_MODE: z.enum(['open', 'invite-only', 'closed']).optional(),
  MODULA_REGISTRATION_INVITE_CODES: z.string().optional(),
  MODULA_ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  MODULA_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  MODULA_EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  MODULA_APPLE_AUTH_ENABLED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  MODULA_APPLE_CLIENT_IDS: z.string().optional(),
  MODULA_SUPPORT_EMAIL: z.string().email().default('support@modula.digital'),
  MODULA_CHECKPOINT_SIGNING_KEY: z.string().optional(),
  MODULA_SESSION_PEPPER: z.string().optional(),
  MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY: z.string().min(1).optional(),
  MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY_PREVIOUS: z.string().min(1).optional(),
  MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY: z.string().min(1).optional(),
  MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY_PREVIOUS: z.string().min(1).optional(),
  MODULA_AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY: z.string().min(1).optional(),
  MODULA_AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY_PREVIOUS: z.string().min(1).optional(),
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
  GREENFIELD_AI_GATEWAY_ENABLED: z
    .string()
    .optional()
    .transform(v => v !== 'false'),
  /** Comma-separated handles granted admin:* capabilities on preview session mint. Preview/dev only. */
  MODULA_ADMIN_HANDLES: z.string().optional(),
})

export type EncryptionKeyMaterial = {
  version: number
  key: Buffer
}

export type RegistrationMode = 'open' | 'invite-only' | 'closed'

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production'
  host: string
  port: number
  publicApiUrl: string
  publicWebUrl: string
  databaseUrl: string
  migratorDatabaseUrl: string
  allowedOrigins: string[]
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'
  trustProxy: boolean
  rateLimitEnabled: boolean
  previewWritesEnabled: boolean
  productionWritesEnabled: boolean
  apiDocumentationEnabled: boolean
  requestBodyLimitBytes: number
  searchQueryMaxChars: number
  searchDefaultLimit: number
  searchMaxLimit: number
  searchMaxEntityTypes: number
  searchMaxTags: number
  searchTimeoutMs: number
  searchRecentLimit: number
  mediaRoot: string
  mediaUploadMaxBytes: number
  secretsServiceUrl: string | null
  secretsServiceTimeoutMs: number
  aiBackendUrl: string | null
  aiBackendTimeoutMs: number
  environment: 'development' | 'preview' | 'production'
  minimumClientVersion: string
  /** Derived: true when the explicit write gate for the current environment is enabled. */
  mutationsEnabled: boolean
  sessionTtlHours: number
  atprotoEnabled: boolean
  registrationMode: RegistrationMode
  inviteOnly: boolean
  registrationInviteCodes: string[]
  accessTokenTtlMinutes: number
  refreshTokenTtlDays: number
  emailVerificationTtlHours: number
  appleAuthEnabled: boolean
  appleClientIds: string[]
  mailSupportEmail: string
  checkpointSigningKey?: string
  sessionPepper?: string
  /** Current (highest version) key used to encrypt new AT Protocol OAuth session material. */
  atprotoOAuthEncryptionKey: EncryptionKeyMaterial
  /** Older keys kept only for decrypting previously encrypted material during rotation. */
  atprotoOAuthEncryptionKeysByVersion: Map<number, Buffer>
  atprotoOAuthEncryptionKeyIsEphemeral: boolean
  /** Current key used to encrypt connector credential envelopes. */
  connectorCredentialEncryptionKey: EncryptionKeyMaterial
  /** Older connector credential keys kept only for decrypting during rotation. */
  connectorCredentialEncryptionKeysByVersion: Map<number, Buffer>
  connectorCredentialEncryptionKeyIsEphemeral: boolean
  /** Current key used to encrypt AI provider credential envelopes. */
  aiProviderCredentialEncryptionKey: EncryptionKeyMaterial
  /** Older AI provider credential keys kept only for decrypting during rotation. */
  aiProviderCredentialEncryptionKeysByVersion: Map<number, Buffer>
  aiProviderCredentialEncryptionKeyIsEphemeral: boolean
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
  aiGatewayEnabled: boolean
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

function deterministicTestKey(label: string): Buffer {
  return Buffer.from(label.padEnd(32, '#').slice(0, 32), 'utf8')
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
  const publicWebUrl =
    raw.MODULA_PUBLIC_WEB_URL ?? (raw.MODULA_ENVIRONMENT === 'development' ? 'http://localhost:8081' : 'https://modula.digital')
  if (
    (raw.NODE_ENV === 'production' || raw.MODULA_ENVIRONMENT === 'production' || raw.MODULA_ENVIRONMENT === 'preview') &&
    !publicWebUrl.startsWith('https://')
  ) {
    refuse('public web URL must be HTTPS outside local development')
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
  if (raw.MODULA_MEDIA_UPLOAD_MAX_BYTES >= raw.MODULA_REQUEST_BODY_LIMIT_BYTES) {
    refuse('media upload limit must be smaller than request body limit')
  }
  if (raw.MODULA_SEARCH_DEFAULT_LIMIT > raw.MODULA_SEARCH_MAX_LIMIT) {
    refuse('MODULA_SEARCH_DEFAULT_LIMIT must be less than or equal to MODULA_SEARCH_MAX_LIMIT')
  }
  const secretsServiceUrl = validateSecretsServiceUrl(raw.MODULA_SECRETS_SERVICE_URL, raw.MODULA_ENVIRONMENT)
  const aiBackendUrl = validateAIBackendUrl(raw.MODULA_AI_BACKEND_URL, raw.MODULA_ENVIRONMENT)

  const environment = raw.MODULA_ENVIRONMENT
  const mediaRoot = raw.MODULA_MEDIA_ROOT ?? (raw.NODE_ENV === 'test' ? '/tmp/modula-greenfield-test-media' : '.data/greenfield-media')
  const isEphemeralEligible = environment === 'development' || raw.NODE_ENV === 'test'
  const registrationMode: RegistrationMode =
    raw.MODULA_REGISTRATION_MODE ??
    (raw.MODULA_INVITE_ONLY === true
      ? 'invite-only'
      : raw.MODULA_INVITE_ONLY === false
        ? 'open'
        : environment === 'production'
          ? 'invite-only'
          : 'open')
  const productionWritesEnabled = Boolean(raw.MODULA_PRODUCTION_WRITES_ENABLED)
  if (environment === 'production' && registrationMode === 'open' && !productionWritesEnabled) {
    refuse('open production registration requires MODULA_PRODUCTION_WRITES_ENABLED=true')
  }
  const appleClientIds = Array.from(
    new Set(
      (raw.MODULA_APPLE_CLIENT_IDS ?? '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean),
    ),
  )
  if (appleClientIds.some(value => !/^[A-Za-z0-9][A-Za-z0-9.-]{1,254}$/.test(value))) {
    refuse('MODULA_APPLE_CLIENT_IDS contains an invalid client identifier')
  }
  if (raw.MODULA_APPLE_AUTH_ENABLED === true && appleClientIds.length === 0) {
    refuse('MODULA_APPLE_CLIENT_IDS is required when MODULA_APPLE_AUTH_ENABLED=true')
  }

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

  let connectorCredentialKey: EncryptionKeyMaterial
  let connectorCredentialKeyIsEphemeral = false
  const connectorCredentialKeysByVersion = new Map<number, Buffer>()
  if (raw.MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY) {
    const key = decodeBase64Key(
      'MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY',
      raw.MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY,
    )
    connectorCredentialKey = {version: 1, key}
    connectorCredentialKeysByVersion.set(1, key)
    if (raw.MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY_PREVIOUS) {
      const previous = decodeBase64Key(
        'MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY_PREVIOUS',
        raw.MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY_PREVIOUS,
      )
      connectorCredentialKeysByVersion.set(0, previous)
    }
  } else if (raw.NODE_ENV === 'test') {
    const key = deterministicTestKey('modula-connector-credential-tests')
    connectorCredentialKey = {version: 1, key}
    connectorCredentialKeysByVersion.set(1, key)
  } else if (environment === 'development') {
    const key = randomBytes(32)
    connectorCredentialKey = {version: 1, key}
    connectorCredentialKeysByVersion.set(1, key)
    connectorCredentialKeyIsEphemeral = true
  } else {
    refuse(
      'MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY is required outside development/test (base64-encoded 32 bytes)',
    )
  }

  let aiProviderCredentialKey: EncryptionKeyMaterial
  let aiProviderCredentialKeyIsEphemeral = false
  const aiProviderCredentialKeysByVersion = new Map<number, Buffer>()
  if (raw.MODULA_AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY) {
    const key = decodeBase64Key(
      'MODULA_AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY',
      raw.MODULA_AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY,
    )
    aiProviderCredentialKey = {version: 1, key}
    aiProviderCredentialKeysByVersion.set(1, key)
    if (raw.MODULA_AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY_PREVIOUS) {
      const previous = decodeBase64Key(
        'MODULA_AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY_PREVIOUS',
        raw.MODULA_AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY_PREVIOUS,
      )
      aiProviderCredentialKeysByVersion.set(0, previous)
    }
  } else if (raw.NODE_ENV === 'test') {
    const key = deterministicTestKey('modula-ai-provider-credential-test')
    aiProviderCredentialKey = {version: 1, key}
    aiProviderCredentialKeysByVersion.set(1, key)
  } else if (environment === 'development') {
    const key = randomBytes(32)
    aiProviderCredentialKey = {version: 1, key}
    aiProviderCredentialKeysByVersion.set(1, key)
    aiProviderCredentialKeyIsEphemeral = true
  } else {
    refuse(
      'MODULA_AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY is required outside development/test (base64-encoded 32 bytes)',
    )
  }

  const mutationsEnabled =
    environment === 'production' ? productionWritesEnabled : raw.MODULA_PREVIEW_WRITES_ENABLED

  return {
    nodeEnv: raw.NODE_ENV,
    host: raw.MODULA_API_HOST,
    port: raw.MODULA_API_PORT,
    publicApiUrl: raw.MODULA_PUBLIC_API_URL,
    publicWebUrl,
    databaseUrl: raw.MODULA_DATABASE_URL,
    migratorDatabaseUrl: raw.MODULA_DATABASE_MIGRATOR_URL ?? raw.MODULA_DATABASE_URL,
    allowedOrigins,
    logLevel: raw.MODULA_LOG_LEVEL,
    trustProxy: Boolean(raw.MODULA_TRUST_PROXY),
    rateLimitEnabled: raw.MODULA_RATE_LIMIT_ENABLED !== false,
    previewWritesEnabled: Boolean(raw.MODULA_PREVIEW_WRITES_ENABLED),
    productionWritesEnabled,
    apiDocumentationEnabled: Boolean(raw.MODULA_API_DOCUMENTATION_ENABLED),
    requestBodyLimitBytes: raw.MODULA_REQUEST_BODY_LIMIT_BYTES,
    searchQueryMaxChars: raw.MODULA_SEARCH_QUERY_MAX_CHARS,
    searchDefaultLimit: raw.MODULA_SEARCH_DEFAULT_LIMIT,
    searchMaxLimit: raw.MODULA_SEARCH_MAX_LIMIT,
    searchMaxEntityTypes: raw.MODULA_SEARCH_MAX_ENTITY_TYPES,
    searchMaxTags: raw.MODULA_SEARCH_MAX_TAGS,
    searchTimeoutMs: raw.MODULA_SEARCH_TIMEOUT_MS,
    searchRecentLimit: raw.MODULA_SEARCH_RECENT_LIMIT,
    mediaRoot: resolve(mediaRoot),
    mediaUploadMaxBytes: raw.MODULA_MEDIA_UPLOAD_MAX_BYTES,
    secretsServiceUrl,
    secretsServiceTimeoutMs: raw.MODULA_SECRETS_SERVICE_TIMEOUT_MS,
    aiBackendUrl,
    aiBackendTimeoutMs: raw.MODULA_AI_BACKEND_TIMEOUT_MS,
    environment,
    minimumClientVersion: raw.MODULA_MINIMUM_CLIENT_VERSION,
    mutationsEnabled,
    sessionTtlHours: raw.MODULA_SESSION_TTL_HOURS,
    atprotoEnabled: raw.MODULA_ATPROTO_ENABLED === true,
    registrationMode,
    inviteOnly: registrationMode === 'invite-only',
    registrationInviteCodes: (raw.MODULA_REGISTRATION_INVITE_CODES ?? '').split(',').map(code => code.trim()).filter(Boolean),
    accessTokenTtlMinutes: raw.MODULA_ACCESS_TOKEN_TTL_MINUTES,
    refreshTokenTtlDays: raw.MODULA_REFRESH_TOKEN_TTL_DAYS,
    emailVerificationTtlHours: raw.MODULA_EMAIL_VERIFICATION_TTL_HOURS,
    appleAuthEnabled: raw.MODULA_APPLE_AUTH_ENABLED === true,
    appleClientIds,
    mailSupportEmail: raw.MODULA_SUPPORT_EMAIL,
    checkpointSigningKey: raw.MODULA_CHECKPOINT_SIGNING_KEY,
    sessionPepper: raw.MODULA_SESSION_PEPPER,
    atprotoOAuthEncryptionKey: currentKey,
    atprotoOAuthEncryptionKeysByVersion: keysByVersion,
    atprotoOAuthEncryptionKeyIsEphemeral: isEphemeral,
    connectorCredentialEncryptionKey: connectorCredentialKey,
    connectorCredentialEncryptionKeysByVersion: connectorCredentialKeysByVersion,
    connectorCredentialEncryptionKeyIsEphemeral: connectorCredentialKeyIsEphemeral,
    aiProviderCredentialEncryptionKey: aiProviderCredentialKey,
    aiProviderCredentialEncryptionKeysByVersion: aiProviderCredentialKeysByVersion,
    aiProviderCredentialEncryptionKeyIsEphemeral: aiProviderCredentialKeyIsEphemeral,
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
    aiGatewayEnabled: raw.GREENFIELD_AI_GATEWAY_ENABLED !== false,
    adminHandles: (raw.MODULA_ADMIN_HANDLES ?? '')
      .split(',')
      .map(h => h.trim().toLowerCase())
      .filter(Boolean),
  }
}

function validateSecretsServiceUrl(value: string | undefined, environment: 'development' | 'preview' | 'production'): string | null {
  if (!value) return null
  const target = new URL(value)
  if (target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
    refuse('secrets service URL must be an origin without credentials, path, query or fragment')
  }
  if (target.protocol !== 'https:' && !(target.protocol === 'http:' && (environment === 'development' || target.hostname === 'modula-secrets-service'))) {
    refuse('secrets service URL must use HTTPS or the approved private service identity')
  }
  return target.origin
}

function validateAIBackendUrl(value: string | undefined, environment: 'development' | 'preview' | 'production'): string | null {
  if (!value) return null
  const target = new URL(value)
  if (target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
    refuse('AI backend URL must be an origin without credentials, path, query or fragment')
  }
  if (target.protocol !== 'https:' && !(target.protocol === 'http:' && (environment === 'development' || target.hostname === 'modula-ai-backend'))) {
    refuse('AI backend URL must use HTTPS or the approved private service identity')
  }
  if (environment === 'production' && target.origin !== 'http://modula-ai-backend:4040') {
    refuse('Production AI backend URL must use the approved private service identity and port')
  }
  return target.origin
}
