import type {MailMessage, RenderedMail} from './contract.js'
import {
  MailButton,
  MailFallbackLink,
  MailFooter,
  MailHeader,
  MailHeading,
  MailInfoBox,
  MailLayout,
  MailSecurityNotice,
} from './components.js'

type TemplateContext = {
  supportEmail: string
  publicWebUrl: string
}

type TemplateModel = {
  subject: string
  preheader: string
  eyebrow: string
  headline: string
  body: string
  ctaLabel: string
  actionUrl: string
  metadata: Array<{label: string; value: string}>
  securityNotice: string
}

const defaultExpiry = 'This link may expire for your security.'
const defaultWarning =
  'If you did not request this, ignore this email or contact Modula support.'
const securityEmail = 'security@modula.digital'

export function renderMailTemplate(message: MailMessage, context: TemplateContext): RenderedMail {
  const definition = templateModel(message, context)
  return {
    subject: definition.subject,
    textBody: renderText(definition, context),
    htmlBody: renderHtml(definition, context),
  }
}

function templateModel(message: MailMessage, context: TemplateContext): TemplateModel {
  const variables = message.variables
  const displayName = valueOr(variables.displayName, 'there')
  const handle = valueOr(variables.handle, '')
  const actionUrl = valueOr(variables.actionUrl, context.publicWebUrl)
  const accountUrl = withPath(context.publicWebUrl, '/settings/account')
  const securityUrl = withPath(context.publicWebUrl, '/settings/security')
  const expiry = valueOr(variables.expiresIn, defaultExpiry)
  const requestedFor = handle ? `@${handle.replace(/^@/, '')}` : displayName

  const definitions: Record<MailMessage['templateId'], TemplateModel> = {
    verification: {
      subject: 'Verify your Modula email',
      preheader: 'Confirm your email to finish setting up Modula.',
      eyebrow: 'Account security',
      headline: 'Verify your email',
      body: `Hi ${displayName}. Confirm this email address to finish securing your Modula account.`,
      ctaLabel: 'Verify email',
      actionUrl,
      metadata: [
        {label: 'Requested for', value: requestedFor},
        {label: 'Expires', value: expiry},
      ],
      securityNotice: defaultWarning,
    },
    'password-reset': {
      subject: 'Reset your Modula password',
      preheader: 'Use this secure link to reset your Modula password.',
      eyebrow: 'Account recovery',
      headline: 'Reset your password',
      body: `Hi ${displayName}. Use this secure link to choose a new Modula password.`,
      ctaLabel: 'Reset password',
      actionUrl,
      metadata: [
        {label: 'Account', value: requestedFor},
        {label: 'Expires', value: valueOr(variables.expiresIn, 'This reset link expires in 1 hour.')},
      ],
      securityNotice: 'If you did not request a password reset, ignore this email and your password will stay unchanged.',
    },
    'password-changed': {
      subject: 'Your Modula password changed',
      preheader: 'Your Modula password was changed.',
      eyebrow: 'Security alert',
      headline: 'Your password changed',
      body: `Hi ${displayName}. Your Modula password was changed and active sessions were revoked according to policy.`,
      ctaLabel: 'Review security',
      actionUrl: valueOr(variables.actionUrl, securityUrl),
      metadata: [{label: 'Account', value: requestedFor}],
      securityNotice: 'If this was not you, reset your password immediately and contact Modula support.',
    },
    'new-sign-in': {
      subject: 'New sign-in to Modula',
      preheader: 'A new sign-in to your Modula account succeeded.',
      eyebrow: 'Security alert',
      headline: 'New sign-in detected',
      body: `Hi ${displayName}. A new sign-in to your Modula account just succeeded.`,
      ctaLabel: 'Review sessions',
      actionUrl: valueOr(variables.actionUrl, securityUrl),
      metadata: [{label: 'Account', value: requestedFor}],
      securityNotice: 'If this was not you, revoke unknown sessions and reset your password.',
    },
    'email-changed': {
      subject: 'Your Modula email changed',
      preheader: 'The email address for your Modula account was changed.',
      eyebrow: 'Security alert',
      headline: 'Your email changed',
      body: `Hi ${displayName}. The email address for your Modula account was changed.`,
      ctaLabel: 'Review account',
      actionUrl: valueOr(variables.actionUrl, accountUrl),
      metadata: [{label: 'Account', value: requestedFor}],
      securityNotice: 'If this was not you, contact Modula support immediately.',
    },
    'passkey-added': securityAlert({
      subject: 'New passkey added to Modula',
      preheader: 'A passkey was added to your Modula account.',
      headline: 'New passkey added',
      body: `Hi ${displayName}. A passkey was added to your Modula account.`,
      actionUrl: valueOr(variables.actionUrl, securityUrl),
      requestedFor,
      notice: 'If this was not you, remove the passkey, revoke unknown sessions, and contact Modula support.',
    }),
    'passkey-removed': securityAlert({
      subject: 'Passkey removed from Modula',
      preheader: 'A passkey was removed from your Modula account.',
      headline: 'Passkey removed',
      body: `Hi ${displayName}. A passkey was removed from your Modula account.`,
      actionUrl: valueOr(variables.actionUrl, securityUrl),
      requestedFor,
      notice: 'If this was not you, review your sign-in methods and contact Modula support.',
    }),
    'recovery-used': securityAlert({
      subject: 'Modula recovery was used',
      preheader: 'A recovery method was used on your Modula account.',
      headline: 'Recovery method used',
      body: `Hi ${displayName}. A recovery method was used on your Modula account.`,
      actionUrl: valueOr(variables.actionUrl, securityUrl),
      requestedFor,
      notice: 'If this was not you, review your recovery methods and revoke unknown sessions.',
    }),
    'sessions-revoked': securityAlert({
      subject: 'Modula sessions were revoked',
      preheader: 'One or more Modula sessions were revoked.',
      headline: 'Sessions revoked',
      body: `Hi ${displayName}. One or more sessions on your Modula account were revoked.`,
      actionUrl: valueOr(variables.actionUrl, securityUrl),
      requestedFor,
      notice: 'If this was not you, reset your password and review your sign-in methods.',
    }),
    'mail-forwarding-changed': securityAlert({
      subject: 'Modula Mail forwarding changed',
      preheader: 'Mail forwarding changed for your Modula Mail address.',
      headline: 'Mail forwarding changed',
      body: `Hi ${displayName}. Forwarding settings for your Modula Mail identity changed.`,
      actionUrl: valueOr(variables.actionUrl, accountUrl),
      requestedFor,
      notice: 'If this was not you, disable forwarding and contact Modula support.',
    }),
    invite: {
      subject: 'You are invited to Modula',
      preheader: 'A Modula invitation was issued for this email address.',
      eyebrow: 'Invitation',
      headline: 'You are invited to Modula',
      body: valueOr(
        variables.explanation,
        'A Modula invitation was issued for this email address.',
      ),
      ctaLabel: 'Create account',
      actionUrl,
      metadata: [{label: 'Expires', value: expiry}],
      securityNotice: defaultWarning,
    },
    'account-deletion': {
      subject: valueOr(variables.title, 'Modula account deletion update'),
      preheader: 'There is an update about a Modula account deletion request.',
      eyebrow: 'Account notice',
      headline: valueOr(variables.title, 'Account deletion update'),
      body: valueOr(
        variables.explanation,
        'There is an update about a Modula account deletion request.',
      ),
      ctaLabel: 'Review account',
      actionUrl: valueOr(variables.actionUrl, accountUrl),
      metadata: [{label: 'Account', value: requestedFor}],
      securityNotice: 'If you did not request this, contact Modula support immediately.',
    },
  }

  return definitions[message.templateId]
}

function renderText(definition: TemplateModel, context: TemplateContext): string {
  const metadata = definition.metadata.flatMap(item => [`${item.label}: ${item.value}`])
  return [
    'MODULA',
    '',
    definition.headline,
    '',
    definition.body,
    '',
    `${definition.ctaLabel}: ${definition.actionUrl}`,
    '',
    ...metadata,
    ...(metadata.length ? [''] : []),
    definition.securityNotice,
    '',
    `Support: ${context.supportEmail}`,
    `Security: ${securityEmail}`,
    `Privacy: ${withPath(context.publicWebUrl, '/privacy')}`,
  ].join('\n')
}

function renderHtml(definition: TemplateModel, context: TemplateContext): string {
  return MailLayout({
    title: definition.subject,
    preheader: definition.preheader,
    children: [
      MailHeader({eyebrow: definition.eyebrow}),
      MailHeading({headline: definition.headline, body: definition.body}),
      MailButton({label: definition.ctaLabel, href: definition.actionUrl}),
      MailFallbackLink({label: definition.ctaLabel, href: definition.actionUrl}),
      MailInfoBox({items: definition.metadata}),
      MailSecurityNotice({text: definition.securityNotice}),
      MailFooter({
        supportEmail: context.supportEmail,
        securityEmail,
        privacyUrl: withPath(context.publicWebUrl, '/privacy'),
        accountUrl: withPath(context.publicWebUrl, '/settings/account'),
      }),
    ].join('\n'),
  })
}

function securityAlert(input: {
  subject: string
  preheader: string
  headline: string
  body: string
  actionUrl: string
  requestedFor: string
  notice: string
}): TemplateModel {
  return {
    subject: input.subject,
    preheader: input.preheader,
    eyebrow: 'Security alert',
    headline: input.headline,
    body: input.body,
    ctaLabel: 'Review security',
    actionUrl: input.actionUrl,
    metadata: [{label: 'Account', value: input.requestedFor}],
    securityNotice: input.notice,
  }
}

function valueOr(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : fallback
}

function withPath(base: string, path: string): string {
  const url = new URL(base)
  url.pathname = path
  url.search = ''
  url.hash = ''
  return url.toString()
}
