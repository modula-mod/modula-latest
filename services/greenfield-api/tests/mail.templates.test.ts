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
      code: '284731',
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
  it('renders every template as branded HTML and text without localhost URLs or missing security basics', () => {
    for (const templateId of MAIL_TEMPLATE_IDS) {
      const rendered = renderMailTemplate(message(templateId), context)
      expect(rendered.subject).toBeTruthy()
      expect(rendered.subject).not.toContain('secret-token')
      expect(rendered.subject).not.toContain('284731')
      expect(rendered.htmlBody).toContain('Modula')
      expect(rendered.htmlBody).toContain('<!doctype html>')
      expect(rendered.htmlBody).toContain('color-scheme')
      expect(rendered.htmlBody).toContain('support@modula.digital')
      expect(rendered.htmlBody).toContain('Expires')
      expect(rendered.textBody).toContain('MODULA')
      expect(rendered.textBody).toContain('Support: support@modula.digital')
      expect(rendered.textBody).toContain('Expires')
      expect(rendered.htmlBody).not.toContain('localhost')
      expect(rendered.textBody).not.toContain('localhost')
      expect(rendered.htmlBody).not.toContain('Plain URL:')
      expect(rendered.textBody).not.toContain('Plain URL:')
      expect(rendered.htmlBody.includes('modula-button') || rendered.htmlBody.includes('284731')).toBe(true)
      const hrefs = Array.from(rendered.htmlBody.matchAll(/href="([^"]+)"/g)).map(match => match[1])
      expect(hrefs.length).toBeGreaterThan(0)
      for (const href of hrefs) {
        expect(() => new URL(href!.startsWith('mailto:') ? href! : href!)).not.toThrow()
      }
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
