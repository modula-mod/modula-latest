import type {MailMessage, RenderedMail} from './contract.js'

type TemplateContext = {
  supportEmail: string
  publicWebUrl: string
}

type TemplateDefinition = {
  title: string
  explanation: string
  ctaLabel: string
  actionUrl: string
  expiry: string
  warning: string
}

const defaultExpiry = 'This link may expire for your security.'
const defaultWarning =
  'If you did not request this, ignore this email or contact Modula support.'

export function renderMailTemplate(message: MailMessage, context: TemplateContext): RenderedMail {
  const variables = message.variables
  const displayName = valueOr(variables.displayName, 'there')
  const actionUrl = valueOr(variables.actionUrl, context.publicWebUrl)
  const accountUrl = withPath(context.publicWebUrl, '/settings/account')
  const securityUrl = withPath(context.publicWebUrl, '/settings/security')

  const definitions: Record<MailMessage['templateId'], TemplateDefinition> = {
    verification: {
      title: 'Verify your Modula email',
      explanation: `Hi ${displayName}. Confirm this email address to activate your Modula account.`,
      ctaLabel: 'Verify email',
      actionUrl,
      expiry: valueOr(variables.expiresIn, defaultExpiry),
      warning: defaultWarning,
    },
    'password-reset': {
      title: 'Reset your Modula password',
      explanation: `Hi ${displayName}. Use this secure link to choose a new Modula password.`,
      ctaLabel: 'Reset password',
      actionUrl,
      expiry: valueOr(variables.expiresIn, 'This reset link expires in 1 hour.'),
      warning: 'If you did not request a password reset, ignore this email and your password will stay unchanged.',
    },
    'password-changed': {
      title: 'Your Modula password changed',
      explanation: `Hi ${displayName}. Your Modula password was changed and active sessions were revoked according to policy.`,
      ctaLabel: 'Review security',
      actionUrl: valueOr(variables.actionUrl, securityUrl),
      expiry: defaultExpiry,
      warning: 'If this was not you, reset your password immediately and contact Modula support.',
    },
    'new-sign-in': {
      title: 'New sign-in to Modula',
      explanation: `Hi ${displayName}. A new sign-in to your Modula account just succeeded.`,
      ctaLabel: 'Review sessions',
      actionUrl: valueOr(variables.actionUrl, securityUrl),
      expiry: defaultExpiry,
      warning: 'If this was not you, revoke unknown sessions and reset your password.',
    },
    'email-changed': {
      title: 'Your Modula email changed',
      explanation: `Hi ${displayName}. The email address for your Modula account was changed.`,
      ctaLabel: 'Review account',
      actionUrl: valueOr(variables.actionUrl, accountUrl),
      expiry: defaultExpiry,
      warning: 'If this was not you, contact Modula support immediately.',
    },
    invite: {
      title: 'You are invited to Modula',
      explanation: valueOr(
        variables.explanation,
        'A Modula invitation was issued for this email address.',
      ),
      ctaLabel: 'Create account',
      actionUrl,
      expiry: valueOr(variables.expiresIn, defaultExpiry),
      warning: defaultWarning,
    },
    'account-deletion': {
      title: valueOr(variables.title, 'Modula account deletion update'),
      explanation: valueOr(
        variables.explanation,
        'There is an update about a Modula account deletion request.',
      ),
      ctaLabel: 'Review account',
      actionUrl: valueOr(variables.actionUrl, accountUrl),
      expiry: defaultExpiry,
      warning: 'If you did not request this, contact Modula support immediately.',
    },
  }

  const definition = definitions[message.templateId]
  return {
    subject: definition.title,
    textBody: renderText(definition, context),
    htmlBody: renderHtml(definition, context),
  }
}

function renderText(definition: TemplateDefinition, context: TemplateContext): string {
  return [
    'Modula',
    '',
    definition.title,
    '',
    definition.explanation,
    '',
    `${definition.ctaLabel}: ${definition.actionUrl}`,
    '',
    `Plain URL: ${definition.actionUrl}`,
    '',
    definition.expiry,
    definition.warning,
    '',
    `Support: ${context.supportEmail}`,
  ].join('\n')
}

function renderHtml(definition: TemplateDefinition, context: TemplateContext): string {
  const title = escapeHtml(definition.title)
  const explanation = escapeHtml(definition.explanation)
  const ctaLabel = escapeHtml(definition.ctaLabel)
  const actionUrl = escapeHtml(definition.actionUrl)
  const expiry = escapeHtml(definition.expiry)
  const warning = escapeHtml(definition.warning)
  const supportEmail = escapeHtml(context.supportEmail)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;">
    <main style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <p style="margin:0 0 24px;font-size:14px;letter-spacing:0;text-transform:uppercase;">Modula</p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;letter-spacing:0;">${title}</h1>
      <p style="margin:0 0 24px;font-size:16px;">${explanation}</p>
      <p style="margin:0 0 24px;">
        <a href="${actionUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;text-decoration:none;border:1px solid currentColor;">${ctaLabel}</a>
      </p>
      <p style="margin:0 0 16px;font-size:14px;">Plain URL: <a href="${actionUrl}">${actionUrl}</a></p>
      <p style="margin:0 0 12px;font-size:14px;">${expiry}</p>
      <p style="margin:0 0 24px;font-size:14px;">${warning}</p>
      <p style="margin:0;font-size:14px;">Support: <a href="mailto:${supportEmail}">${supportEmail}</a></p>
    </main>
  </body>
</html>`
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
