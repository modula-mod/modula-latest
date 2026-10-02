import type {MailMessage, RenderedMail} from './contract.js'
import {
  MailButton,
  MailCode,
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
  code?: string
  codeLabel?: string
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
  const mailUrl = withPath(context.publicWebUrl, '/settings/account/modula-mail')
  const loginUrl = withPath(context.publicWebUrl, '/sign-in')
  const expiry = valueOr(variables.expiresIn, defaultExpiry)
  const requestedFor = handle ? `@${handle.replace(/^@/, '')}` : displayName
  const code = valueOr(variables.code, '')

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
    'verify-email': {
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
    'verification-code': {
      subject: 'Your Modula verification code',
      preheader: 'Use this code to verify your Modula contact email.',
      eyebrow: 'Account security',
      headline: 'Verify your email',
      body: `Hi ${displayName}. Enter this code in Modula to finish securing your account.`,
      ctaLabel: 'Open Modula',
      actionUrl: valueOr(variables.actionUrl, loginUrl),
      code,
      codeLabel: 'Verification code',
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
    'passwordless-login': {
      subject: 'Your Modula sign-in code',
      preheader: 'Use this one-time code to continue signing in to Modula.',
      eyebrow: 'Sign-in code',
      headline: 'Continue signing in',
      body: `Hi ${displayName}. Enter this code in Modula to finish signing in.`,
      ctaLabel: 'Open Modula',
      actionUrl: valueOr(variables.actionUrl, loginUrl),
      code,
      codeLabel: 'Sign-in code',
      metadata: [
        {label: 'Account', value: requestedFor},
        {label: 'Expires', value: expiry},
      ],
      securityNotice: 'If you did not request this sign-in code, ignore this email and review your security settings.',
    },
    'password-changed': {
      subject: 'Your Modula password changed',
      preheader: 'Your Modula password was changed.',
      eyebrow: 'Security alert',
      headline: 'Your password changed',
      body: `Hi ${displayName}. Your Modula password was changed and active sessions were revoked according to policy.`,
      ctaLabel: 'Review security',
      actionUrl: valueOr(variables.actionUrl, securityUrl),
      metadata: [
        {label: 'Account', value: requestedFor},
        {label: 'Expires', value: valueOr(variables.expiresIn, 'Review immediately.')},
      ],
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
      metadata: [
        {label: 'Account', value: requestedFor},
        {label: 'Expires', value: valueOr(variables.expiresIn, 'Review immediately.')},
      ],
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
      metadata: [
        {label: 'Account', value: requestedFor},
        {label: 'Expires', value: valueOr(variables.expiresIn, 'Review immediately.')},
      ],
      securityNotice: 'If this was not you, contact Modula support immediately.',
    },
    'contact-email-changed': {
      subject: 'Your Modula contact email changed',
      preheader: 'The contact email for your Modula account changed.',
      eyebrow: 'Security alert',
      headline: 'Contact email changed',
      body: `Hi ${displayName}. The verified contact email for your Modula account was changed.`,
      ctaLabel: 'Review account',
      actionUrl: valueOr(variables.actionUrl, accountUrl),
      metadata: [
        {label: 'Account', value: requestedFor},
        {label: 'Expires', value: valueOr(variables.expiresIn, 'Review immediately.')},
      ],
      securityNotice: 'If this was not you, contact Modula support immediately.',
    },
    'passkey-added': securityAlert({
      subject: 'New passkey added to Modula',
      preheader: 'A passkey was added to your Modula account.',
      headline: 'New passkey added',
      body: `Hi ${displayName}. A passkey was added to your Modula account.`,
      actionUrl: valueOr(variables.actionUrl, securityUrl),
      requestedFor,
      expiry,
      notice: 'If this was not you, remove the passkey, revoke unknown sessions, and contact Modula support.',
    }),
    'passkey-removed': securityAlert({
      subject: 'Passkey removed from Modula',
      preheader: 'A passkey was removed from your Modula account.',
      headline: 'Passkey removed',
      body: `Hi ${displayName}. A passkey was removed from your Modula account.`,
      actionUrl: valueOr(variables.actionUrl, securityUrl),
      requestedFor,
      expiry,
      notice: 'If this was not you, review your sign-in methods and contact Modula support.',
    }),
    'authenticator-enabled': securityAlert({
      subject: 'Authenticator enabled for Modula',
      preheader: 'An authenticator app was enabled for your Modula account.',
      headline: 'Authenticator enabled',
      body: `Hi ${displayName}. Authenticator-app MFA was enabled for your Modula account.`,
      actionUrl: valueOr(variables.actionUrl, securityUrl),
      requestedFor,
      expiry,
      notice: 'If this was not you, disable the authenticator, revoke unknown sessions, and contact Modula support.',
    }),
    'authenticator-disabled': securityAlert({
      subject: 'Authenticator disabled for Modula',
      preheader: 'Authenticator-app MFA was disabled for your Modula account.',
      headline: 'Authenticator disabled',
      body: `Hi ${displayName}. Authenticator-app MFA was disabled for your Modula account.`,
      actionUrl: valueOr(variables.actionUrl, securityUrl),
      requestedFor,
      expiry,
      notice: 'If this was not you, secure your account and contact Modula support.',
    }),
    'recovery-used': securityAlert({
      subject: 'Modula recovery was used',
      preheader: 'A recovery method was used on your Modula account.',
      headline: 'Recovery method used',
      body: `Hi ${displayName}. A recovery method was used on your Modula account.`,
      actionUrl: valueOr(variables.actionUrl, securityUrl),
      requestedFor,
      expiry,
      notice: 'If this was not you, review your recovery methods and revoke unknown sessions.',
    }),
    'recovery-code-used': securityAlert({
      subject: 'Modula recovery code used',
      preheader: 'A recovery code was used on your Modula account.',
      headline: 'Recovery code used',
      body: `Hi ${displayName}. A one-time recovery code was used on your Modula account.`,
      actionUrl: valueOr(variables.actionUrl, securityUrl),
      requestedFor,
      expiry,
      notice: 'If this was not you, regenerate recovery codes and revoke unknown sessions.',
    }),
    'sessions-revoked': securityAlert({
      subject: 'Modula sessions were revoked',
      preheader: 'One or more Modula sessions were revoked.',
      headline: 'Sessions revoked',
      body: `Hi ${displayName}. One or more sessions on your Modula account were revoked.`,
      actionUrl: valueOr(variables.actionUrl, securityUrl),
      requestedFor,
      expiry,
      notice: 'If this was not you, reset your password and review your sign-in methods.',
    }),
    'mail-forwarding-changed': securityAlert({
      subject: 'Modula Mail forwarding changed',
      preheader: 'Mail forwarding changed for your Modula Mail address.',
      headline: 'Mail forwarding changed',
      body: `Hi ${displayName}. Forwarding settings for your Modula Mail identity changed.`,
      actionUrl: valueOr(variables.actionUrl, accountUrl),
      requestedFor,
      expiry,
      notice: 'If this was not you, disable forwarding and contact Modula support.',
    }),
    'forwarding-changed': securityAlert({
      subject: 'Modula Mail forwarding changed',
      preheader: 'Mail forwarding changed for your Modula Mail address.',
      headline: 'Mail forwarding changed',
      body: `Hi ${displayName}. Forwarding settings for your Modula Mail identity changed.`,
      actionUrl: valueOr(variables.actionUrl, mailUrl),
      requestedFor,
      expiry,
      notice: 'If this was not you, disable forwarding and contact Modula support.',
    }),
    'modula-mail-activated': {
      subject: 'Modula Mail activated',
      preheader: 'Your Modula Mail identity is active.',
      eyebrow: 'Modula Mail',
      headline: 'Modula Mail activated',
      body: `Hi ${displayName}. Your Modula Mail address is active and ready for account-level settings.`,
      ctaLabel: 'Review Modula Mail',
      actionUrl: valueOr(variables.actionUrl, mailUrl),
      metadata: [
        {label: 'Account', value: requestedFor},
        {label: 'Address', value: valueOr(variables.mailAddress, 'Your Modula Mail address')},
        {label: 'Expires', value: valueOr(variables.expiresIn, 'Review when convenient.')},
      ],
      securityNotice: 'If you did not request this Modula Mail identity, contact Modula support.',
    },
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
      metadata: [
        {label: 'Account', value: requestedFor},
        {label: 'Expires', value: valueOr(variables.expiresIn, 'Review immediately.')},
      ],
      securityNotice: 'If you did not request this, contact Modula support immediately.',
    },
    'account-deletion-requested': {
      subject: 'Modula account deletion requested',
      preheader: 'A Modula account deletion request was received.',
      eyebrow: 'Account notice',
      headline: 'Account deletion requested',
      body: valueOr(
        variables.explanation,
        'A deletion request was received for your Modula account. No irreversible action should proceed without the required review window.',
      ),
      ctaLabel: 'Review account',
      actionUrl: valueOr(variables.actionUrl, accountUrl),
      metadata: [
        {label: 'Account', value: requestedFor},
        {label: 'Expires', value: valueOr(variables.expiresIn, 'This request remains reviewable during the security window.')},
      ],
      securityNotice: 'If you did not request this, contact Modula support immediately.',
    },
    'support-case': {
      subject: `[${valueOr(variables.reference, 'MOD-UNKNOWN')}] ${valueOr(variables.category, 'help')}: ${valueOr(variables.subject, 'Support request')}`,
      preheader: `Support request ${valueOr(variables.reference, '')} from @${valueOr(variables.handle, 'member').replace(/^@/, '')}`,
      eyebrow: 'Support request',
      headline: valueOr(variables.subject, 'Support request'),
      body: valueOr(variables.message, 'No message was provided.'),
      ctaLabel: variables.replyTo?.trim() ? 'Reply to member' : 'Open Modula',
      actionUrl: variables.replyTo?.trim() ? `mailto:${encodeURIComponent(variables.replyTo.trim()).replace(/%40/g, '@')}?subject=${encodeURIComponent(`Re: [${valueOr(variables.reference, '')}] ${valueOr(variables.subject, '')}`)}` : context.publicWebUrl,
      metadata: [
        {label: 'Reference', value: valueOr(variables.reference, 'Unknown')},
        {label: 'Category', value: valueOr(variables.category, 'help')},
        {label: 'Member', value: `@${valueOr(variables.handle, 'unknown').replace(/^@/, '')} (${valueOr(variables.accountId, 'unknown')})`},
        {label: 'Reply to', value: valueOr(variables.replyTo, 'No email on file')},
        {label: 'Diagnostics', value: valueOr(variables.diagnostics, 'Not attached')},
        {label: 'Expires', value: 'Open until answered'},
      ],
      securityNotice: 'Sent from the Modula app by a signed-in member. Never ask members for passwords or codes.',
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
    ...(definition.code ? [`${definition.codeLabel ?? 'Code'}: ${definition.code}`, ''] : []),
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
      definition.code ? MailCode({label: definition.codeLabel ?? 'Code', code: definition.code}) : '',
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
  expiry: string
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
    metadata: [
      {label: 'Account', value: input.requestedFor},
      {label: 'Expires', value: input.expiry || 'Review immediately.'},
    ],
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
