import {sql} from 'kysely'
import type {WorkerConfig} from '../config.js'
import type {MailFailureCategory, ModulaWorkerDb} from '../database.js'
import {PermanentJobError, TransientJobError} from '../jobs/errors.js'
import {sendTransactionalMail, MailDeliveryError, sanitizeFailureMessage} from './transport.js'

type MailDeliverPayload = {
  mailJobId?: unknown
}

export async function handleMailDeliver(
  db: ModulaWorkerDb,
  config: WorkerConfig,
  payload: unknown,
): Promise<void> {
  const mailJobId = (payload as MailDeliverPayload | null)?.mailJobId
  if (typeof mailJobId !== 'string' || !mailJobId) {
    throw new PermanentJobError('VALIDATION_FAILED', 'mail.deliver payload missing mailJobId')
  }

  const now = new Date()
  const claimed = await sql<{
    mail_job_id: string
    recipient_address: string
    subject: string
    text_body: string
    html_body: string
    attempt_count: number
    maximum_attempts: number
  }>`
    UPDATE greenfield_mail_jobs
    SET
      status = 'sending',
      sending_at = ${now},
      attempt_count = attempt_count + 1,
      updated_at = ${now}
    WHERE mail_job_id = ${mailJobId}
      AND status IN ('queued', 'failed', 'retrying')
    RETURNING mail_job_id, recipient_address, subject, text_body, html_body, attempt_count, maximum_attempts
  `.execute(db)
  const job = claimed.rows[0]
  if (!job) {
    const existing = await db
      .selectFrom('greenfield_mail_jobs')
      .select(['status'])
      .where('mail_job_id', '=', mailJobId)
      .executeTakeFirst()
    if (!existing) throw new PermanentJobError('VALIDATION_FAILED', 'mail job not found')
    return
  }

  try {
    const result = await sendTransactionalMail(config, {
      to: job.recipient_address,
      subject: job.subject,
      text: job.text_body,
      html: job.html_body,
    })
    await db
      .updateTable('greenfield_mail_jobs')
      .set({
        status: 'sent',
        provider_message_id: result.providerMessageId,
        failure_category: null,
        failure_message: null,
        sent_at: new Date(),
        updated_at: new Date(),
      })
      .where('mail_job_id', '=', mailJobId)
      .execute()
  } catch (error) {
    const classified =
      error instanceof MailDeliveryError
        ? error
        : new MailDeliveryError('temporary', sanitizeFailureMessage(error instanceof Error ? error.message : String(error)), false)
    const exhausted = classified.permanent || job.attempt_count >= job.maximum_attempts
    const failedAt = new Date()
    await db
      .updateTable('greenfield_mail_jobs')
      .set({
        status: exhausted ? 'dead-letter' : 'retrying',
        failure_category: classified.category as MailFailureCategory,
        failure_message: classified.message,
        failed_at: failedAt,
        dead_lettered_at: exhausted ? failedAt : null,
        updated_at: failedAt,
      })
      .where('mail_job_id', '=', mailJobId)
      .execute()

    if (exhausted) {
      throw new PermanentJobError(mailPermanentCode(classified.category), classified.message)
    }
    throw new TransientJobError(mailTransientCode(classified.category), classified.message)
  }
}

function mailPermanentCode(category: MailFailureCategory): 'SMTP_AUTHENTICATION_FAILED' | 'SMTP_INVALID_RECIPIENT' | 'SMTP_PERMANENT_FAILURE' {
  if (category === 'authentication') return 'SMTP_AUTHENTICATION_FAILED'
  if (category === 'invalid-recipient') return 'SMTP_INVALID_RECIPIENT'
  return 'SMTP_PERMANENT_FAILURE'
}

function mailTransientCode(category: MailFailureCategory): string {
  if (category === 'rate-limit') return 'SMTP_RATE_LIMITED'
  if (category === 'DNS') return 'SMTP_DNS_FAILURE'
  if (category === 'TLS') return 'SMTP_TLS_FAILURE'
  return 'SMTP_TEMPORARY_FAILURE'
}
