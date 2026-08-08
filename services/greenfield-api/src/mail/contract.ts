export const MAIL_TEMPLATE_IDS = [
  'verification',
  'password-reset',
  'password-changed',
  'new-sign-in',
  'email-changed',
  'invite',
  'account-deletion',
] as const

export type MailTemplateId = (typeof MAIL_TEMPLATE_IDS)[number]

export type MailJobStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'retrying' | 'dead-letter'

export type MailFailureCategory =
  | 'temporary'
  | 'permanent'
  | 'authentication'
  | 'rate-limit'
  | 'DNS'
  | 'TLS'
  | 'invalid-recipient'

export type MailMessage = {
  templateId: MailTemplateId
  recipientAccountId?: string
  to: string
  locale: string
  variables: Record<string, string>
  correlationId?: string
}

export type RenderedMail = {
  subject: string
  textBody: string
  htmlBody: string
}

export type QueuedMailJob = {
  mailJobId: string
  templateId: MailTemplateId
  recipientSafe: string
  recipientDomain: string
  status: MailJobStatus
}

export function isMailTemplateId(value: string): value is MailTemplateId {
  return (MAIL_TEMPLATE_IDS as readonly string[]).includes(value)
}
