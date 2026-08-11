import {createHash} from 'node:crypto'
import type {Kysely, Transaction} from 'kysely'
import {sql} from 'kysely'
import type {AppConfig} from '../config/index.js'
import type {Database} from '../database/types.js'
import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'
import type {MailMessage, QueuedMailJob} from './contract.js'
import {isMailTemplateId} from './contract.js'
import {mailValidationError} from './errors.js'
import {renderMailTemplate} from './templates.js'

type MailWriteDb = Kysely<Database> | Transaction<Database>

const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`

export class MailService {
  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
  ) {}

  verificationUrl(_email: string, token: string): string {
    const url = new URL(this.config.publicWebUrl)
    url.pathname = '/verify-email'
    url.search = ''
    url.searchParams.set('t', token)
    return url.toString()
  }

  passwordResetUrl(token: string): string {
    const url = new URL(this.config.publicWebUrl)
    url.pathname = '/reset-password'
    url.search = ''
    url.searchParams.set('t', token)
    return url.toString()
  }

  accountUrl(): string {
    const url = new URL(this.config.publicWebUrl)
    url.pathname = '/settings/account'
    return url.toString()
  }

  securityUrl(): string {
    const url = new URL(this.config.publicWebUrl)
    url.pathname = '/settings/security'
    return url.toString()
  }

  signInUrl(): string {
    const url = new URL(this.config.publicWebUrl)
    url.pathname = '/sign-in'
    return url.toString()
  }

  modulaMailUrl(): string {
    const url = new URL(this.config.publicWebUrl)
    url.pathname = '/settings/account/modula-mail'
    return url.toString()
  }

  async queue(message: MailMessage): Promise<QueuedMailJob> {
    return this.db.transaction().execute(trx => this.queueInTransaction(trx, message))
  }

  async queueInTransaction(db: Transaction<Database>, message: MailMessage): Promise<QueuedMailJob> {
    return insertMailJob(db, this.config, message)
  }

  async queueVerification(
    db: Transaction<Database>,
    input: {
      accountId: string
      email: string
      displayName: string
      handle?: string
      code: string
      expiresAt: Date
      correlationId?: string
    },
  ): Promise<QueuedMailJob> {
    return this.queueInTransaction(db, {
      templateId: 'verification-code',
      recipientAccountId: input.accountId,
      to: input.email,
      locale: 'en',
      correlationId: input.correlationId,
      variables: {
        displayName: input.displayName,
        handle: input.handle ?? '',
        actionUrl: this.signInUrl(),
        code: input.code,
        expiresIn: expiresIn(input.expiresAt),
      },
    })
  }

  async queuePasswordlessLogin(
    db: Transaction<Database>,
    input: {
      accountId: string
      email: string
      displayName: string
      handle?: string
      code: string
      expiresAt: Date
      correlationId?: string
    },
  ): Promise<QueuedMailJob> {
    return this.queueInTransaction(db, {
      templateId: 'passwordless-login',
      recipientAccountId: input.accountId,
      to: input.email,
      locale: 'en',
      correlationId: input.correlationId,
      variables: {
        displayName: input.displayName,
        handle: input.handle ?? '',
        actionUrl: this.signInUrl(),
        code: input.code,
        expiresIn: expiresIn(input.expiresAt),
      },
    })
  }

  async queuePasswordReset(
    db: Transaction<Database>,
    input: {
      accountId: string
      email: string
      displayName: string
      handle?: string
      token: string
      expiresAt: Date
      correlationId?: string
    },
  ): Promise<QueuedMailJob> {
    return this.queueInTransaction(db, {
      templateId: 'password-reset',
      recipientAccountId: input.accountId,
      to: input.email,
      locale: 'en',
      correlationId: input.correlationId,
      variables: {
        displayName: input.displayName,
        handle: input.handle ?? '',
        actionUrl: this.passwordResetUrl(input.token),
        expiresIn: expiresIn(input.expiresAt),
      },
    })
  }

  async queuePasswordChanged(
    db: Transaction<Database>,
    input: {accountId: string; email: string; displayName: string; correlationId?: string},
  ): Promise<QueuedMailJob> {
    return this.queueInTransaction(db, {
      templateId: 'password-changed',
      recipientAccountId: input.accountId,
      to: input.email,
      locale: 'en',
      correlationId: input.correlationId,
      variables: {
        displayName: input.displayName,
        actionUrl: this.securityUrl(),
      },
    })
  }

  async queuePasskeyAdded(
    input: {accountId: string; email: string; displayName: string; handle?: string; correlationId?: string},
  ): Promise<QueuedMailJob> {
    return this.queueSecurityAlert('passkey-added', input, this.securityUrl())
  }

  async queuePasskeyRemoved(
    input: {accountId: string; email: string; displayName: string; handle?: string; correlationId?: string},
  ): Promise<QueuedMailJob> {
    return this.queueSecurityAlert('passkey-removed', input, this.securityUrl())
  }

  async queueRecoveryUsed(
    input: {accountId: string; email: string; displayName: string; handle?: string; correlationId?: string},
  ): Promise<QueuedMailJob> {
    return this.queueSecurityAlert('recovery-code-used', input, this.securityUrl())
  }

  async queueSessionsRevoked(
    input: {accountId: string; email: string; displayName: string; handle?: string; correlationId?: string},
  ): Promise<QueuedMailJob> {
    return this.queueSecurityAlert('sessions-revoked', input, this.securityUrl())
  }

  async queueMailForwardingChanged(
    input: {accountId: string; email: string; displayName: string; handle?: string; correlationId?: string},
  ): Promise<QueuedMailJob> {
    return this.queueSecurityAlert('forwarding-changed', input, this.modulaMailUrl())
  }

  async queueAuthenticatorEnabled(
    input: {accountId: string; email: string; displayName: string; handle?: string; correlationId?: string},
  ): Promise<QueuedMailJob> {
    return this.queueSecurityAlert('authenticator-enabled', input, this.securityUrl())
  }

  async queueAuthenticatorDisabled(
    input: {accountId: string; email: string; displayName: string; handle?: string; correlationId?: string},
  ): Promise<QueuedMailJob> {
    return this.queueSecurityAlert('authenticator-disabled', input, this.securityUrl())
  }

  async queueModulaMailActivated(
    input: {
      accountId: string
      email: string
      displayName: string
      handle?: string
      mailAddress: string
      correlationId?: string
    },
  ): Promise<QueuedMailJob> {
    return this.queue({
      templateId: 'modula-mail-activated',
      recipientAccountId: input.accountId,
      to: input.email,
      locale: 'en',
      correlationId: input.correlationId,
      variables: {
        displayName: input.displayName,
        handle: input.handle ?? '',
        mailAddress: input.mailAddress,
        actionUrl: this.modulaMailUrl(),
      },
    })
  }

  async queueNewSignIn(
    input: {accountId: string; email: string; displayName: string; correlationId?: string},
  ): Promise<QueuedMailJob> {
    return this.queue({
      templateId: 'new-sign-in',
      recipientAccountId: input.accountId,
      to: input.email,
      locale: 'en',
      correlationId: input.correlationId,
      variables: {
        displayName: input.displayName,
        actionUrl: this.securityUrl(),
      },
    })
  }

  async queueEmailChanged(
    db: Transaction<Database>,
    input: {accountId: string; email: string; displayName: string; correlationId?: string},
  ): Promise<QueuedMailJob> {
    return this.queueInTransaction(db, {
      templateId: 'contact-email-changed',
      recipientAccountId: input.accountId,
      to: input.email,
      locale: 'en',
      correlationId: input.correlationId,
      variables: {
        displayName: input.displayName,
        actionUrl: this.accountUrl(),
      },
    })
  }

  async queueInvite(
    db: Transaction<Database>,
    input: {
      email: string
      displayName?: string
      actionUrl: string
      expiresAt: Date
      explanation?: string
      correlationId?: string
    },
  ): Promise<QueuedMailJob> {
    return this.queueInTransaction(db, {
      templateId: 'invite',
      to: input.email,
      locale: 'en',
      correlationId: input.correlationId,
      variables: {
        displayName: input.displayName ?? 'there',
        actionUrl: input.actionUrl,
        expiresIn: expiresIn(input.expiresAt),
        explanation: input.explanation ?? 'A Modula invitation was issued for this email address.',
      },
    })
  }

  async queueAccountDeletion(
    db: Transaction<Database>,
    input: {
      accountId: string
      email: string
      displayName: string
      title: string
      explanation: string
      correlationId?: string
    },
  ): Promise<QueuedMailJob> {
    return this.queueInTransaction(db, {
      templateId: 'account-deletion-requested',
      recipientAccountId: input.accountId,
      to: input.email,
      locale: 'en',
      correlationId: input.correlationId,
      variables: {
        displayName: input.displayName,
        title: input.title,
        explanation: input.explanation,
        actionUrl: this.accountUrl(),
      },
    })
  }

  async summary(): Promise<{
    queued: number
    sending: number
    sent: number
    failed: number
    retrying: number
    deadLetter: number
  }> {
    const rows = await this.db
      .selectFrom('greenfield_mail_jobs')
      .select(['status', sql<string>`count(*)`.as('count')])
      .groupBy('status')
      .execute()
    const counts = new Map(rows.map(row => [row.status, Number(row.count)]))
    return {
      queued: counts.get('queued') ?? 0,
      sending: counts.get('sending') ?? 0,
      sent: counts.get('sent') ?? 0,
      failed: counts.get('failed') ?? 0,
      retrying: counts.get('retrying') ?? 0,
      deadLetter: counts.get('dead-letter') ?? 0,
    }
  }

  private async queueSecurityAlert(
    templateId: Extract<
      MailMessage['templateId'],
      | 'passkey-added'
      | 'passkey-removed'
      | 'authenticator-enabled'
      | 'authenticator-disabled'
      | 'recovery-code-used'
      | 'sessions-revoked'
      | 'forwarding-changed'
    >,
    input: {accountId: string; email: string; displayName: string; handle?: string; correlationId?: string},
    actionUrl: string,
  ): Promise<QueuedMailJob> {
    return this.queue({
      templateId,
      recipientAccountId: input.accountId,
      to: input.email,
      locale: 'en',
      correlationId: input.correlationId,
      variables: {
        displayName: input.displayName,
        handle: input.handle ?? '',
        actionUrl,
      },
    })
  }
}

async function insertMailJob(db: MailWriteDb, config: AppConfig, message: MailMessage): Promise<QueuedMailJob> {
  const to = normalizeEmail(message.to)
  if (!to) throw mailValidationError('Valid mail recipient required')
  if (!isMailTemplateId(message.templateId)) throw mailValidationError('Known mail template required')
  const now = new Date()
  const mailJobId = `mail-${uuidv7()}`
  const rendered = renderMailTemplate(message, {
    supportEmail: config.mailSupportEmail,
    publicWebUrl: config.publicWebUrl,
  })
  const recipientDomain = to.split('@')[1] ?? 'unknown'
  const recipientSafe = maskRecipient(to)

  await db
    .insertInto('greenfield_mail_jobs')
    .values({
      mail_job_id: mailJobId,
      template_id: message.templateId,
      recipient_account_id: message.recipientAccountId ?? null,
      recipient_address: to,
      recipient_hash: hashRecipient(to),
      recipient_domain: recipientDomain,
      recipient_safe: recipientSafe,
      locale: message.locale || 'en',
      variables: jsonb(message.variables),
      subject: rendered.subject,
      text_body: rendered.textBody,
      html_body: rendered.htmlBody,
      status: 'queued',
      attempt_count: 0,
      maximum_attempts: 4,
      provider_message_id: null,
      failure_category: null,
      failure_message: null,
      correlation_id: message.correlationId ?? null,
      available_at: now,
      queued_at: now,
      sending_at: null,
      sent_at: null,
      failed_at: null,
      dead_lettered_at: null,
      created_at: now,
      updated_at: now,
    })
    .execute()

  await db
    .insertInto('background_jobs')
    .values({
      id: `job-${mailJobId}`,
      job_type: 'mail.deliver',
      payload: jsonb({mailJobId, templateId: message.templateId, correlationId: message.correlationId ?? null}),
      status: 'pending',
      priority: 20,
      available_at: now,
      lease_owner: null,
      lease_expires_at: null,
      attempt_count: 0,
      maximum_attempts: 4,
      last_error: null,
      created_at: now,
      updated_at: now,
      completed_at: null,
    })
    .execute()

  return {
    mailJobId,
    templateId: message.templateId,
    recipientSafe,
    recipientDomain,
    status: 'queued',
  }
}

function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  if (email.length > 320) return null
  return email
}

function hashRecipient(email: string): string {
  return createHash('sha256').update(email).digest('hex')
}

function maskRecipient(email: string): string {
  const [local = '', domain = 'unknown'] = email.split('@')
  const prefix = local.slice(0, 2)
  return `${prefix}${local.length > 2 ? '***' : '*'}@${domain}`
}

function expiresIn(expiresAt: Date): string {
  const millis = Math.max(0, expiresAt.getTime() - Date.now())
  if (millis <= 90 * 60_000) {
    const minutes = Math.max(1, Math.ceil(millis / 60_000))
    return minutes === 1 ? 'This code expires in 1 minute.' : `This code expires in ${minutes} minutes.`
  }
  const hours = Math.max(1, Math.ceil(millis / 3_600_000))
  return hours === 1 ? 'This link expires in 1 hour.' : `This link expires in ${hours} hours.`
}

export function displayNameFromIdentityMetadata(metadata: unknown, fallback: string): string {
  if (metadata && typeof metadata === 'object' && 'displayName' in metadata) {
    const displayName = (metadata as {displayName?: unknown}).displayName
    if (typeof displayName === 'string' && displayName.trim()) return displayName.trim()
  }
  return fallback
}
