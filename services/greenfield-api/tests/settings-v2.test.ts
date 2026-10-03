import {describe, expect, it} from 'vitest'
import {defaultAppPreferences, isValidTimeZone, resolveAppPreferences, validateAppPreferencePatch} from '../src/settings-v2/preferences.js'
import {maskEmail} from '../src/settings-v2/service.js'
import {duePeriod, inQuietHours, isoWeekKey, isQuiet, localClock, renderDigest} from '../../greenfield-worker/src/digests/digests.js'

describe('app preferences', () => {
  it('has defaults for every synced key', () => {
    const defaults = defaultAppPreferences()
    expect(defaults['feed.defaultMode']).toBe('following')
    expect(defaults['digests.weekly']).toBe(false)
    expect(defaults['digests.timeZone']).toBe('UTC')
  })

  it('accepts valid patches, with or without a preferences wrapper', () => {
    expect(validateAppPreferencePatch({'digests.weekly': true, 'digests.timeZone': 'Europe/London'})).toEqual({'digests.weekly': true, 'digests.timeZone': 'Europe/London'})
    expect(validateAppPreferencePatch({preferences: {'feed.defaultMode': 'modules'}})).toEqual({'feed.defaultMode': 'modules'})
  })

  it('rejects unknown keys, wrong types and bad zones', () => {
    expect(() => validateAppPreferencePatch({'feed.secret': true})).toThrow(/Unknown preference/)
    expect(() => validateAppPreferencePatch({'digests.weekly': 'yes'})).toThrow(/true or false/)
    expect(() => validateAppPreferencePatch({'feed.defaultMode': 'random'})).toThrow(/one of/)
    expect(() => validateAppPreferencePatch({'digests.timeZone': 'Mars/Olympus'})).toThrow(/time zone/)
    expect(() => validateAppPreferencePatch({})).toThrow(/Nothing/)
    expect(isValidTimeZone('America/New_York')).toBe(true)
    expect(isValidTimeZone('../etc')).toBe(false)
  })

  it('falls back to defaults for stale stored values', () => {
    const resolved = resolveAppPreferences({'feed.defaultMode': 'gone', 'digests.morning': true, junk: 1})
    expect(resolved['feed.defaultMode']).toBe('following')
    expect(resolved['digests.morning']).toBe(true)
    expect('junk' in resolved).toBe(false)
  })

  it('masks digest addresses', () => {
    expect(maskEmail('andy@example.com')).toBe('an***@example.com')
  })
})

describe('digest schedule', () => {
  it('computes local clocks and ISO weeks', () => {
    const clock = localClock(new Date('2026-10-05T07:30:00Z'), 'Europe/London')
    expect(clock).toMatchObject({date: '2026-10-05', hour: 8, weekday: 1})
    expect(isoWeekKey('2026-10-05')).toBe('2026-W41')
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53')
    expect(localClock(new Date('2026-10-05T07:30:00Z'), 'Not/AZone').hour).toBe(7)
  })

  it('is due only inside the delivery windows', () => {
    const mondayMorning = localClock(new Date('2026-10-05T07:30:00Z'), 'Europe/London')
    expect(duePeriod('morning', mondayMorning)).toBe('2026-10-05')
    expect(duePeriod('weekly', mondayMorning)).toBe('2026-W41')
    const tuesdayEvening = localClock(new Date('2026-10-06T19:00:00Z'), 'Europe/London')
    expect(duePeriod('morning', tuesdayEvening)).toBeNull()
    expect(duePeriod('weekly', tuesdayEvening)).toBeNull()
  })

  it('skips quiet periods and renders escaped mail', () => {
    expect(isQuiet({likes: 0, reactions: 0, comments: 0, newFollowers: 0, mentions: 0, unreadNotifications: 0})).toBe(true)
    const mail = renderDigest('weekly', {displayName: '<Andy>', summary: {likes: 2, reactions: 1, comments: 1, newFollowers: 1, mentions: 0, unreadNotifications: 4}, webUrl: 'https://modula.digital', periodLabel: '2026-W41'})
    expect(mail.subject).toContain('2026-W41')
    expect(mail.textBody).toContain('1 new follower')
    expect(mail.textBody).toContain('3 likes and reactions on your posts')
    expect(mail.textBody).not.toContain('mention')
    expect(mail.htmlBody).toContain('&lt;Andy&gt;')
    expect(mail.htmlBody).not.toContain('<Andy>')
  })

  it('holds digests during quiet hours, including windows across midnight', () => {
    const at = new Date('2026-10-05T07:30:00Z') // 08:30 London
    expect(inQuietHours({enabled: true, start: '22:00', end: '09:00', timezone: 'Europe/London'}, at)).toBe(true)
    expect(inQuietHours({enabled: true, start: '22:00', end: '08:00', timezone: 'Europe/London'}, at)).toBe(false)
    expect(inQuietHours({enabled: false, start: '00:00', end: '23:59', timezone: 'Europe/London'}, at)).toBe(false)
    expect(inQuietHours({enabled: true, start: '07:00', end: '08:00', timezone: 'Bad/Zone'}, at)).toBe(true)
    expect(inQuietHours(null, at)).toBe(false)
  })
})
