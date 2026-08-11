import {describe, expect, it} from 'vitest'
import {MAIL_TEMPLATE_IDS, type MailMessage} from '../src/mail/contract.js'
import {MailService} from '../src/mail/service.js'
import {renderMailTemplate} from '../src/mail/templates.js'

const context = {
  publicWebUrl: 'https://modula.digital',
  supportEmail: 'support@modula.digital',
}

function message(templateId: MailMessage['templateId'], actionUrl = 'https://modula.digital/security?t=secret-token'): MailMessage {
  return {
    templateId,
    to: 'user@example.com',
    locale: 'en',
    variables: {
      displayName: 'Modula User',
      handle: 'modula_org',
      actionUrl,
      expiresIn: 'This link expires in 24 hours.',
    },
  }
}

function visibleText(html: string): string {
  return html
    .replace(/href="[^"]+"/g, 'href=""')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

describe('Modula transactional mail templates', () => {
  it('renders every template as branded HTML and text without localhost URLs', () => {
    for (const templateId of MAIL_TEMPLATE_IDS) {
      const rendered = renderMailTemplate(message(templateId), context)
      expect(rendered.subject).toBeTruthy()
      expect(rendered.htmlBody).toContain('Modula')
      expect(rendered.htmlBody).toContain('<!doctype html>')
      expect(rendered.htmlBody).toContain('color-scheme')
      expect(rendered.textBody).toContain('MODULA')
      expect(rendered.htmlBody).not.toContain('localhost')
      expect(rendered.textBody).not.toContain('localhost')
      expect(rendered.htmlBody).not.toContain('Plain URL:')
      expect(rendered.textBody).not.toContain('Plain URL:')
    }
  })

  it('keeps opaque action tokens out of visible HTML copy while retaining the CTA href', () => {
    const actionUrl = 'https://modula.digital/verify-email?t=visible-secret-token'
    const rendered = renderMailTemplate(message('verification', actionUrl), context)

    expect(rendered.htmlBody).toContain(`href="${actionUrl}"`)
    expect(visibleText(rendered.htmlBody)).not.toContain('visible-secret-token')
    expect(rendered.textBody).toContain(actionUrl)
  })

  it('builds token-only auth links for verification and password reset', () => {
    const mail = new MailService({} as never, {
      publicWebUrl: 'https://modula.digital',
    } as never)

    expect(mail.verificationUrl('user@example.com', 'verification-token')).toBe(
      'https://modula.digital/verify-email?t=verification-token',
    )
    expect(mail.passwordResetUrl('reset-token')).toBe(
      'https://modula.digital/reset-password?t=reset-token',
    )
  })
})
