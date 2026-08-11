import nodemailer from 'nodemailer'
import type {WorkerConfig} from '../config.js'

export type MailTransportInput = {
  to: string
  subject: string
  text: string
  html: string
}

export type MailTransportResult = {
  providerMessageId: string
}

export type MailDeliveryFailureCategory =
  | 'temporary'
  | 'permanent'
  | 'authentication'
  | 'rate-limit'
  | 'DNS'
  | 'TLS'
  | 'invalid-recipient'

export class MailDeliveryError extends Error {
  constructor(
    readonly category: MailDeliveryFailureCategory,
    message: string,
    readonly permanent: boolean,
  ) {
    super(message)
    this.name = 'MailDeliveryError'
  }
}

export async function sendTransactionalMail(
  config: WorkerConfig,
  input: MailTransportInput,
): Promise<MailTransportResult> {
  if (config.mailTransport === 'disabled') {
    throw new MailDeliveryError('authentication', 'Transactional mail transport is disabled', true)
  }
  if (config.mailTransport === 'log') {
    return {providerMessageId: `log:${Date.now()}`}
  }

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    requireTLS: config.smtpRequireTls,
    tls: {
      rejectUnauthorized: config.smtpTlsRejectUnauthorized,
    },
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword,
    },
  })

  try {
    const result = await transporter.sendMail({
      from: config.mailFrom,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    })
    return {providerMessageId: String(result.messageId ?? `smtp:${Date.now()}`)}
  } catch (error) {
    throw classifySmtpError(error)
  }
}

function classifySmtpError(error: unknown): MailDeliveryError {
  const record = error && typeof error === 'object' ? (error as Record<string, unknown>) : {}
  const code = typeof record.code === 'string' ? record.code : ''
  const responseCode = typeof record.responseCode === 'number' ? record.responseCode : undefined
  const message = sanitizeFailureMessage(error instanceof Error ? error.message : String(error))

  if (code === 'EAUTH' || /auth|credential|login/i.test(message)) {
    return new MailDeliveryError('authentication', message, true)
  }
  if (code === 'ETIMEDOUT' || code === 'ECONNECTION' || code === 'ECONNRESET') {
    return new MailDeliveryError('temporary', message, false)
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return new MailDeliveryError('DNS', message, false)
  }
  if (code === 'ESOCKET' || /tls|certificate|ssl/i.test(message)) {
    return new MailDeliveryError('TLS', message, false)
  }
  if (responseCode === 421 || responseCode === 450 || responseCode === 451 || responseCode === 452) {
    return new MailDeliveryError('temporary', message, false)
  }
  if (responseCode === 429 || responseCode === 454 || responseCode === 471) {
    return new MailDeliveryError('rate-limit', message, false)
  }
  if (responseCode === 550 || responseCode === 551 || responseCode === 553) {
    return new MailDeliveryError('invalid-recipient', message, true)
  }
  if (responseCode && responseCode >= 500) {
    return new MailDeliveryError('permanent', message, true)
  }
  return new MailDeliveryError('temporary', message, false)
}

export function sanitizeFailureMessage(message: string): string {
  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/([?&](?:token|code|verificationToken|recoveryToken)=)[^&\s]+/gi, '$1[redacted]')
    .slice(0, 300)
}
