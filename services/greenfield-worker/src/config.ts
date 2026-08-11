import {z} from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MODULA_ENVIRONMENT: z.enum(['development', 'preview', 'production']).default('development'),
  MODULA_WORKER_ID: z.string().min(1).default(`worker-${process.pid}`),
  MODULA_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  MODULA_DATABASE_URL: z.string().min(1),
  MODULA_WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1_000),
  MODULA_WORKER_EMPTY_POLL_BACKOFF_MS: z.coerce.number().int().positive().default(5_000),
  MODULA_WORKER_LEASE_DURATION_MS: z.coerce.number().int().positive().default(60_000),
  MODULA_WORKER_LEASE_REAP_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  MODULA_WORKER_OUTBOX_DRAIN_INTERVAL_MS: z.coerce.number().int().positive().default(2_000),
  MODULA_WORKER_OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(50),
  MODULA_WORKER_EVENT_SUBSCRIBER_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  MODULA_WORKER_INGEST_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  MODULA_WORKER_INGEST_ENABLED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  MODULA_MAIL_TRANSPORT: z.enum(['disabled', 'log', 'smtp']).optional(),
  MODULA_MAIL_PROVISIONER_MODE: z.enum(['disabled', 'dry-run', 'hestia']).optional(),
  MODULA_MAIL_DOMAIN: z.string().min(1).default('modula.digital'),
  MODULA_MAIL_HESTIA_USER: z.string().min(1).optional(),
  MODULA_MAIL_PROVISIONER_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  MODULA_MAIL_DEFAULT_QUOTA_BYTES: z.coerce.number().int().positive().default(1_073_741_824),
  MODULA_MAIL_REQUIRED: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  MODULA_MAIL_FROM: z.string().min(1).optional(),
  MODULA_SMTP_HOST: z.string().min(1).optional(),
  MODULA_SMTP_PORT: z.coerce.number().int().positive().optional(),
  MODULA_SMTP_USER: z.string().min(1).optional(),
  MODULA_SMTP_PASSWORD: z.string().min(1).optional(),
  MODULA_SMTP_SECURE: z
    .string()
    .optional()
    .transform(v => (v === undefined ? undefined : v === 'true')),
  MODULA_SMTP_REQUIRE_TLS: z
    .string()
    .optional()
    .transform(v => v !== 'false'),
  MODULA_SMTP_TLS_REJECT_UNAUTHORIZED: z
    .string()
    .optional()
    .transform(v => v !== 'false'),
  // Same key material / env var names as services/api (see security/crypto.ts there) so a
  // single secret can be shared across /etc/modula/api.env and /etc/modula/worker.env.
  MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY: z.string().min(1).optional(),
  MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY_PREVIOUS: z.string().min(1).optional(),
  MODULA_ATPROTO_SSRF_ALLOW_PRIVATE_NETWORKS: z
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
})

export type WorkerConfig = {
  nodeEnv: 'development' | 'test' | 'production'
  environment: 'development' | 'preview' | 'production'
  workerId: string
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'
  databaseUrl: string
  pollIntervalMs: number
  emptyPollBackoffMs: number
  leaseDurationMs: number
  leaseReapIntervalMs: number
  outboxDrainIntervalMs: number
  outboxBatchSize: number
  eventSubscriberTimeoutMs: number
  ingestIntervalMs: number
  ingestEnabled: boolean
  mailTransport: 'disabled' | 'log' | 'smtp'
  mailProvisionerMode: 'disabled' | 'dry-run' | 'hestia'
  mailDomain: string
  mailHestiaUser?: string
  mailProvisionerCommandTimeoutMs: number
  mailDefaultQuotaBytes: number
  mailRequired: boolean
  mailFrom: string
  smtpHost?: string
  smtpPort: number
  smtpUser?: string
  smtpPassword?: string
  smtpSecure: boolean
  smtpRequireTls: boolean
  smtpTlsRejectUnauthorized: boolean
  /** version -> 32-byte key. Version 1 is "current"; version 0 is the previous key kept for rotation. */
  encryptionKeysByVersion: Map<number, Buffer>
  encryptionKeyIsEphemeral: boolean
  ssrfAllowPrivateNetworks: boolean
  moduleRemoteFunctionsEnabled: boolean
  moduleCommunityExecutionEnabled: boolean
  moduleGithubSyncEnabled: boolean
}

function refuse(message: string): never {
  throw new Error(`Invalid Modula worker configuration: ${message}`)
}

function decodeBase64Key(label: string, value: string): Buffer {
  const buffer = Buffer.from(value, 'base64')
  if (buffer.length !== 32) {
    refuse(`${label} must decode from base64 to exactly 32 bytes (AES-256)`)
  }
  return buffer
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) {
    refuse(parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '))
  }
  const raw = parsed.data

  if (raw.MODULA_DATABASE_URL.includes('placeholder') || raw.MODULA_DATABASE_URL.includes('change-me')) {
    if (raw.NODE_ENV === 'production' || raw.MODULA_ENVIRONMENT === 'production' || raw.MODULA_ENVIRONMENT === 'preview') {
      refuse('placeholder database credentials are not allowed')
    }
  }

  const environment = raw.MODULA_ENVIRONMENT
  const mailTransport = raw.MODULA_MAIL_TRANSPORT ?? (environment === 'production' ? 'smtp' : 'disabled')
  const mailProvisionerMode = raw.MODULA_MAIL_PROVISIONER_MODE ?? (environment === 'production' ? 'disabled' : 'dry-run')
  const mailRequired = raw.MODULA_MAIL_REQUIRED === true || environment === 'production'
  const smtpPort = raw.MODULA_SMTP_PORT ?? 587
  const smtpSecure = raw.MODULA_SMTP_SECURE ?? smtpPort === 465
  if (mailRequired && mailTransport !== 'smtp') {
    refuse('MODULA_MAIL_TRANSPORT=smtp is required when mail is required')
  }
  if (mailTransport === 'smtp') {
    if (!raw.MODULA_SMTP_HOST) refuse('MODULA_SMTP_HOST is required when MODULA_MAIL_TRANSPORT=smtp')
    if (!raw.MODULA_MAIL_FROM) refuse('MODULA_MAIL_FROM is required when MODULA_MAIL_TRANSPORT=smtp')
    if (!raw.MODULA_SMTP_USER || !raw.MODULA_SMTP_PASSWORD) {
      refuse('MODULA_SMTP_USER and MODULA_SMTP_PASSWORD are required for authenticated SMTP relay delivery')
    }
  }
  if (mailProvisionerMode === 'hestia' && !raw.MODULA_MAIL_HESTIA_USER) {
    refuse('MODULA_MAIL_HESTIA_USER is required when MODULA_MAIL_PROVISIONER_MODE=hestia')
  }
  const isEphemeralEligible = environment === 'development' || raw.NODE_ENV === 'test'
  const encryptionKeysByVersion = new Map<number, Buffer>()
  let isEphemeral = false

  if (raw.MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY) {
    encryptionKeysByVersion.set(1, decodeBase64Key('MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY', raw.MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY))
    if (raw.MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY_PREVIOUS) {
      encryptionKeysByVersion.set(
        0,
        decodeBase64Key('MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY_PREVIOUS', raw.MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY_PREVIOUS),
      )
    }
  } else if (isEphemeralEligible) {
    // Ephemeral dev-only key. AT publish jobs that need to decrypt a real session
    // will simply fail with OAUTH_SESSION_UNAVAILABLE rather than crash the worker —
    // Modula posts must never be blocked on AT Protocol configuration.
    encryptionKeysByVersion.set(1, Buffer.alloc(32, 7))
    isEphemeral = true
  } else {
    refuse('MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY is required outside development/test (base64-encoded 32 bytes)')
  }

  return {
    nodeEnv: raw.NODE_ENV,
    environment,
    workerId: raw.MODULA_WORKER_ID,
    logLevel: raw.MODULA_LOG_LEVEL,
    databaseUrl: raw.MODULA_DATABASE_URL,
    pollIntervalMs: raw.MODULA_WORKER_POLL_INTERVAL_MS,
    emptyPollBackoffMs: raw.MODULA_WORKER_EMPTY_POLL_BACKOFF_MS,
    leaseDurationMs: raw.MODULA_WORKER_LEASE_DURATION_MS,
    leaseReapIntervalMs: raw.MODULA_WORKER_LEASE_REAP_INTERVAL_MS,
    outboxDrainIntervalMs: raw.MODULA_WORKER_OUTBOX_DRAIN_INTERVAL_MS,
    outboxBatchSize: raw.MODULA_WORKER_OUTBOX_BATCH_SIZE,
    eventSubscriberTimeoutMs: raw.MODULA_WORKER_EVENT_SUBSCRIBER_TIMEOUT_MS,
    ingestIntervalMs: raw.MODULA_WORKER_INGEST_INTERVAL_MS,
    ingestEnabled: Boolean(raw.MODULA_WORKER_INGEST_ENABLED),
    mailTransport,
    mailProvisionerMode,
    mailDomain: raw.MODULA_MAIL_DOMAIN,
    mailHestiaUser: raw.MODULA_MAIL_HESTIA_USER,
    mailProvisionerCommandTimeoutMs: raw.MODULA_MAIL_PROVISIONER_COMMAND_TIMEOUT_MS,
    mailDefaultQuotaBytes: raw.MODULA_MAIL_DEFAULT_QUOTA_BYTES,
    mailRequired,
    mailFrom: raw.MODULA_MAIL_FROM ?? 'Modula <no-reply@modula.digital>',
    smtpHost: raw.MODULA_SMTP_HOST,
    smtpPort,
    smtpUser: raw.MODULA_SMTP_USER,
    smtpPassword: raw.MODULA_SMTP_PASSWORD,
    smtpSecure,
    smtpRequireTls: raw.MODULA_SMTP_REQUIRE_TLS !== false,
    smtpTlsRejectUnauthorized: raw.MODULA_SMTP_TLS_REJECT_UNAUTHORIZED !== false,
    encryptionKeysByVersion,
    encryptionKeyIsEphemeral: isEphemeral,
    ssrfAllowPrivateNetworks: Boolean(raw.MODULA_ATPROTO_SSRF_ALLOW_PRIVATE_NETWORKS),
    moduleRemoteFunctionsEnabled: Boolean(raw.GREENFIELD_MODULE_REMOTE_FUNCTIONS_ENABLED),
    moduleCommunityExecutionEnabled: Boolean(raw.GREENFIELD_MODULE_COMMUNITY_EXECUTION_ENABLED),
    moduleGithubSyncEnabled: Boolean(raw.GREENFIELD_MODULE_GITHUB_SYNC_ENABLED),
  }
}
