import {randomBytes} from 'node:crypto'
import {sql} from 'kysely'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'
import {MailService} from '../mail/service.js'
import {AuditRepository} from '../domains/audit/repository.js'

export const SUPPORT_CASE_CATEGORIES = ['help', 'bug', 'account', 'privacy', 'safety', 'feedback'] as const
export type SupportCaseCategory = (typeof SUPPORT_CASE_CATEGORIES)[number]

/** Device facts a client may attach. Anything else is dropped, never stored. */
export const SUPPORT_DIAGNOSTIC_KEYS = [
  'appVersion',
  'appBuild',
  'buildConfiguration',
  'platform',
  'osVersion',
  'deviceModel',
  'locale',
  'timeZone',
  'apiHost',
  'networkPath',
  'lowPowerMode',
  'reduceMotion',
  'dynamicType',
  'theme',
  'installedModules',
  'runtimeState',
  'storageFree',
] as const

export const SUPPORT_LIMITS = {subjectMin: 3, subjectMax: 140, messageMin: 10, messageMax: 5_000, diagnosticValueMax: 200, perHour: 5}

export type SupportCaseInput = {
  category: unknown
  subject: unknown
  message: unknown
  diagnostics?: unknown
}

export type ValidSupportCase = {
  category: SupportCaseCategory
  subject: string
  message: string
  diagnostics: Record<string, string> | null
}

const REFERENCE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function supportReference(bytes: Buffer = randomBytes(8)): string {
  let out = ''
  for (let index = 0; index < 8; index += 1) out += REFERENCE_ALPHABET[bytes[index]! % REFERENCE_ALPHABET.length]
  return `MOD-${out}`
}

function clean(value: string): string {
  // Strip control characters except newlines and tabs; normalise line endings.
  return value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
}

export function validateSupportCase(input: SupportCaseInput): ValidSupportCase {
  const category = typeof input.category === 'string' ? input.category.trim().toLowerCase() : ''
  if (!(SUPPORT_CASE_CATEGORIES as readonly string[]).includes(category)) invalid('Choose what the request is about', 'category')
  const subject = typeof input.subject === 'string' ? clean(input.subject).replace(/\s+/g, ' ') : ''
  if (subject.length < SUPPORT_LIMITS.subjectMin || subject.length > SUPPORT_LIMITS.subjectMax) {
    invalid(`Subject must be ${SUPPORT_LIMITS.subjectMin}–${SUPPORT_LIMITS.subjectMax} characters`, 'subject')
  }
  const message = typeof input.message === 'string' ? clean(input.message) : ''
  if (message.length < SUPPORT_LIMITS.messageMin || message.length > SUPPORT_LIMITS.messageMax) {
    invalid(`Message must be ${SUPPORT_LIMITS.messageMin}–${SUPPORT_LIMITS.messageMax} characters`, 'message')
  }
  return {category: category as SupportCaseCategory, subject, message, diagnostics: sanitizeDiagnostics(input.diagnostics)}
}

export function sanitizeDiagnostics(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const out: Record<string, string> = {}
  for (const key of SUPPORT_DIAGNOSTIC_KEYS) {
    const raw = (value as Record<string, unknown>)[key]
    if (raw === undefined || raw === null) continue
    const text = typeof raw === 'string' ? raw : typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : null
    if (text === null) continue
    const trimmed = clean(text).replace(/\s+/g, ' ').slice(0, SUPPORT_LIMITS.diagnosticValueMax)
    if (trimmed) out[key] = trimmed
  }
  return Object.keys(out).length ? out : null
}

export function diagnosticsText(diagnostics: Record<string, string> | null): string {
  if (!diagnostics) return 'Not attached'
  return Object.entries(diagnostics).map(([key, value]) => `${key}: ${value}`).join(' · ')
}

export class GreenfieldSupportService {
  private readonly mail: MailService

  constructor(private readonly db: ModulaDb, private readonly config: AppConfig) {
    this.mail = new MailService(db, config)
  }

  contact() {
    return {
      supportEmail: this.config.mailSupportEmail,
      categories: SUPPORT_CASE_CATEGORIES,
      inAppCases: this.config.mutationsEnabled,
      limits: {subjectMax: SUPPORT_LIMITS.subjectMax, messageMax: SUPPORT_LIMITS.messageMax, perHour: SUPPORT_LIMITS.perHour},
      diagnosticKeys: SUPPORT_DIAGNOSTIC_KEYS,
    }
  }

  async list(accountId: string) {
    const rows = await this.db
      .selectFrom('greenfield_support_cases')
      .select(['case_id', 'reference', 'category', 'subject', 'state', 'created_at', 'updated_at'])
      .where('account_id', '=', accountId)
      .orderBy('created_at', 'desc')
      .limit(20)
      .execute()
    return {items: rows.map(caseView), supportEmail: this.config.mailSupportEmail}
  }

  async open(accountId: string, idempotencyKey: string, input: SupportCaseInput) {
    if (!idempotencyKey || idempotencyKey.length > 200) invalid('Idempotency key is required', 'idempotencyKey')
    const existing = await this.db
      .selectFrom('greenfield_support_cases')
      .select(['case_id', 'reference', 'category', 'subject', 'state', 'created_at', 'updated_at'])
      .where('account_id', '=', accountId)
      .where('idempotency_key', '=', idempotencyKey)
      .executeTakeFirst()
    if (existing) return {...caseView(existing), supportEmail: this.config.mailSupportEmail}

    const valid = validateSupportCase(input)
    const recent = await this.db
      .selectFrom('greenfield_support_cases')
      .select(sql<string>`count(*)`.as('count'))
      .where('account_id', '=', accountId)
      .where('created_at', '>', new Date(Date.now() - 3_600_000))
      .executeTakeFirst()
    if (Number(recent?.count ?? 0) >= SUPPORT_LIMITS.perHour) {
      throw Object.assign(new Error('Too many support requests. Try again later or email support.'), {code: 'RATE_LIMITED'})
    }

    const account = await this.db
      .selectFrom('greenfield_accounts')
      .select(['account_id', 'primary_handle', 'status'])
      .where('account_id', '=', accountId)
      .executeTakeFirst()
    if (!account || account.status === 'deleted') throw Object.assign(new Error('Active account not found'), {code: 'NOT_FOUND'})
    const email = await this.db
      .selectFrom('greenfield_auth_identities')
      .select('identifier')
      .where('account_id', '=', accountId)
      .where('kind', '=', 'email')
      .orderBy('verified_at', 'desc')
      .executeTakeFirst()

    const now = new Date()
    const caseId = uuidv7()
    const reference = supportReference()
    const row = await this.db.transaction().execute(async trx => {
      const queued = await this.mail.queueInTransaction(trx, {
        templateId: 'support-case',
        to: this.config.mailSupportEmail,
        locale: 'en',
        correlationId: `support:${caseId}`,
        variables: {
          reference,
          category: valid.category,
          subject: valid.subject,
          message: valid.message,
          handle: account.primary_handle,
          accountId,
          replyTo: email?.identifier ?? '',
          diagnostics: diagnosticsText(valid.diagnostics),
        },
      })
      return trx
        .insertInto('greenfield_support_cases')
        .values({
          case_id: caseId,
          reference,
          account_id: accountId,
          category: valid.category,
          subject: valid.subject,
          message: valid.message,
          diagnostics: valid.diagnostics ? JSON.stringify(valid.diagnostics) : null,
          state: 'OPEN',
          idempotency_key: idempotencyKey,
          mail_job_id: queued.mailJobId,
          created_at: now,
          updated_at: now,
        })
        .returning(['case_id', 'reference', 'category', 'subject', 'state', 'created_at', 'updated_at'])
        .executeTakeFirstOrThrow()
    })
    await new AuditRepository(this.db).append(
      'support.case.opened',
      {category: valid.category, diagnosticsAttached: valid.diagnostics !== null},
      {type: 'supportCase', id: caseId},
      {accountId},
    )
    return {...caseView(row), supportEmail: this.config.mailSupportEmail}
  }
}

function caseView(row: {case_id: string; reference: string; category: string; subject: string; state: string; created_at: Date; updated_at: Date}) {
  return {
    caseId: row.case_id,
    reference: row.reference,
    category: row.category,
    subject: row.subject,
    state: row.state,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function invalid(message: string, field: string): never {
  throw Object.assign(new Error(message), {code: 'VALIDATION_FAILED', field})
}
