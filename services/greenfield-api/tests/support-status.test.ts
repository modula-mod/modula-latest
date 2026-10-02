import {describe, expect, it} from 'vitest'
import {overallState, queueState, workerState} from '../src/domains/system/status.js'
import {diagnosticsText, sanitizeDiagnostics, supportReference, validateSupportCase} from '../src/support/service.js'
import {renderMailTemplate} from '../src/mail/templates.js'

const now = new Date('2026-10-03T00:00:00.000Z')
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000)

describe('public status', () => {
  it('derives worker state from the real heartbeat age', () => {
    expect(workerState(null, now)).toEqual({state: 'unknown', ageSeconds: null})
    expect(workerState(ago(12), now)).toEqual({state: 'operational', ageSeconds: 12})
    expect(workerState(ago(300), now).state).toBe('degraded')
    expect(workerState(ago(3_600), now).state).toBe('outage')
  })

  it('treats an empty queue as operational and an old backlog as degraded or down', () => {
    expect(queueState(0, null, now)).toEqual({state: 'operational', ageSeconds: 0})
    expect(queueState(3, ago(30), now).state).toBe('operational')
    expect(queueState(3, ago(900), now).state).toBe('degraded')
    expect(queueState(3, ago(7_200), now).state).toBe('outage')
  })

  it('reports outage only when the API or database is down', () => {
    expect(overallState([{id: 'api', state: 'operational'}, {id: 'database', state: 'operational'}, {id: 'worker', state: 'unknown'}])).toBe('operational')
    expect(overallState([{id: 'api', state: 'operational'}, {id: 'database', state: 'operational'}, {id: 'worker', state: 'outage'}])).toBe('degraded')
    expect(overallState([{id: 'api', state: 'operational'}, {id: 'database', state: 'outage'}])).toBe('outage')
  })
})

describe('support cases', () => {
  it('validates category, subject and message', () => {
    expect(() => validateSupportCase({category: 'other', subject: 'Hello', message: 'Something broke here'})).toThrow(/Choose/)
    expect(() => validateSupportCase({category: 'bug', subject: 'Hi', message: 'Something broke here'})).toThrow(/Subject/)
    expect(() => validateSupportCase({category: 'bug', subject: 'Crash', message: 'short'})).toThrow(/Message/)
    const valid = validateSupportCase({category: ' BUG ', subject: '  App   crashes ', message: 'It crashes\r\nwhen I open Vault Notes.\u0007'})
    expect(valid).toEqual({category: 'bug', subject: 'App crashes', message: 'It crashes\nwhen I open Vault Notes.', diagnostics: null})
  })

  it('keeps only allow-listed diagnostic facts', () => {
    const diagnostics = sanitizeDiagnostics({appVersion: '1.0', osVersion: 'iOS 26.1', token: 'secret', reduceMotion: false, deviceModel: {nested: true}, locale: 'x'.repeat(500)})
    expect(diagnostics).toEqual({appVersion: '1.0', osVersion: 'iOS 26.1', reduceMotion: 'false', locale: 'x'.repeat(200)})
    expect(sanitizeDiagnostics(['appVersion'])).toBeNull()
    expect(sanitizeDiagnostics({token: 'secret'})).toBeNull()
    expect(diagnosticsText(null)).toBe('Not attached')
    expect(diagnosticsText({appVersion: '1.0', platform: 'ios'})).toBe('appVersion: 1.0 · platform: ios')
  })

  it('generates readable references', () => {
    expect(supportReference(Buffer.from([0, 1, 2, 3, 4, 5, 6, 31]))).toBe('MOD-0123456Z')
    expect(supportReference()).toMatch(/^MOD-[0-9A-Z]{8}$/)
  })

  it('renders the support mailbox notification with escaped member content and a reply link', () => {
    const rendered = renderMailTemplate(
      {
        templateId: 'support-case',
        to: 'support@modula.digital',
        locale: 'en',
        variables: {reference: 'MOD-0123456Z', category: 'bug', subject: 'Crash <b>now</b>', message: 'Steps: open <script>x</script>', handle: 'andy', accountId: 'acct_1', replyTo: 'andy@example.com', diagnostics: 'appVersion: 1.0'},
      },
      {supportEmail: 'support@modula.digital', publicWebUrl: 'https://modula.digital'},
    )
    expect(rendered.subject).toBe('[MOD-0123456Z] bug: Crash <b>now</b>')
    expect(rendered.htmlBody).not.toContain('<script>')
    expect(rendered.htmlBody).toContain('&lt;script&gt;')
    expect(rendered.htmlBody).toContain('mailto:andy@example.com')
    expect(rendered.textBody).toContain('Diagnostics: appVersion: 1.0')
  })
})
