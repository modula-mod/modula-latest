import {createPublicKey, generateKeyPairSync, verify} from 'node:crypto'
import {describe, expect, it} from 'vitest'
import {classifyApnsResponse, createProviderToken, loadApnsConfig, parseP8} from '../src/push/apns.js'
import {apnsCategoryFor, buildApnsPayload, deepLinkFor, pushBackoffMs} from '../src/push/dispatch.js'
import {quietHoursEnd} from '../src/push/quiet-hours.js'

const {privateKey} = generateKeyPairSync('ec', {namedCurve: 'prime256v1'})
const pem = privateKey.export({type: 'pkcs8', format: 'pem'}).toString()

describe('APNs token auth', () => {
  it('signs a verifiable ES256 provider token', () => {
    const token = createProviderToken({keyId: 'ABC123DEFG', teamId: 'TEAM123456', privateKey: parseP8(pem)}, 1_700_000_000)
    const [h, c, s] = token.split('.')
    expect(JSON.parse(Buffer.from(h!, 'base64url').toString())).toEqual({alg: 'ES256', kid: 'ABC123DEFG'})
    expect(JSON.parse(Buffer.from(c!, 'base64url').toString())).toEqual({iss: 'TEAM123456', iat: 1_700_000_000})
    const ok = verify('sha256', Buffer.from(`${h}.${c}`), {key: createPublicKey(privateKey), dsaEncoding: 'ieee-p1363'}, Buffer.from(s!, 'base64url'))
    expect(ok).toBe(true)
  })

  it('accepts escaped-newline and base64 .p8 values and disables push when unset', () => {
    expect(() => parseP8(pem.replace(/\n/g, '\\n'))).not.toThrow()
    expect(() => parseP8(Buffer.from(pem).toString('base64'))).not.toThrow()
    expect(loadApnsConfig({})).toBeNull()
    const config = loadApnsConfig({APNS_KEY_ID: 'K', APNS_TEAM_ID: 'T', APNS_KEY_P8: pem, APNS_ENV: 'development'})
    expect(config?.bundleId).toBe('digital.modula.app.native')
    expect(config?.defaultEnvironment).toBe('development')
  })

  it('classifies APNs responses for pruning and retry', () => {
    expect(classifyApnsResponse({status: 200})).toBe('sent')
    expect(classifyApnsResponse({status: 410, reason: 'Unregistered'})).toBe('invalid-token')
    expect(classifyApnsResponse({status: 400, reason: 'BadDeviceToken'})).toBe('invalid-token')
    expect(classifyApnsResponse({status: 400, reason: 'DeviceTokenNotForTopic'})).toBe('invalid-token')
    expect(classifyApnsResponse({status: 403, reason: 'ExpiredProviderToken'})).toBe('auth-error')
    expect(classifyApnsResponse({status: 429, reason: 'TooManyRequests'})).toBe('retry')
    expect(classifyApnsResponse({status: 503})).toBe('retry')
    expect(classifyApnsResponse({status: 0, reason: 'Timeout'})).toBe('retry')
    expect(classifyApnsResponse({status: 400, reason: 'PayloadTooLarge'})).toBe('rejected')
  })

  it('backs off exponentially with a cap', () => {
    expect(pushBackoffMs(1)).toBe(30_000)
    expect(pushBackoffMs(3)).toBe(120_000)
    expect(pushBackoffMs(20)).toBe(3_600_000)
  })
})

describe('quiet hours', () => {
  const base = {enabled: true, start: '22:00', end: '07:00', timezone: 'Europe/London'}
  it('defers inside a window that wraps midnight', () => {
    const resume = quietHoursEnd(new Date('2026-01-10T23:30:00Z'), base)
    expect(resume?.toISOString()).toBe('2026-01-11T07:00:00.000Z')
  })
  it('passes outside the window or when disabled', () => {
    expect(quietHoursEnd(new Date('2026-01-10T12:00:00Z'), base)).toBeNull()
    expect(quietHoursEnd(new Date('2026-01-10T23:30:00Z'), {...base, enabled: false})).toBeNull()
  })
  it('respects the user timezone', () => {
    // 05:30Z is 14:30 in Tokyo: not quiet. 14:00Z is 23:00 in Tokyo: quiet.
    expect(quietHoursEnd(new Date('2026-01-10T05:30:00Z'), {...base, timezone: 'Asia/Tokyo'})).toBeNull()
    expect(quietHoursEnd(new Date('2026-01-10T14:00:00Z'), {...base, timezone: 'Asia/Tokyo'})?.toISOString()).toBe('2026-01-10T22:00:00.000Z')
  })
  it('handles same-day windows', () => {
    expect(quietHoursEnd(new Date('2026-01-10T13:00:00Z'), {...base, start: '12:00', end: '14:00', timezone: 'UTC'})?.toISOString()).toBe('2026-01-10T14:00:00.000Z')
  })
})

describe('payloads, categories and deep links', () => {
  const row = {
    id: 'd1', recipient_actor_id: 'r', category: 'comments', actor_id: 'a1', title: null, body: 'commented on your post',
    deep_link: null, thread_id: 'comments:p1', data: {notificationId: 'n1', resourceType: 'post', resourceId: 'p1'}, attempts: 1,
  }
  it('builds an actionable alert with badge and deep link', () => {
    const payload = buildApnsPayload(row, {title: '@alice', badge: 3}) as any
    expect(payload.aps).toMatchObject({alert: {title: '@alice', body: 'commented on your post'}, badge: 3, category: 'MODULA_COMMENT', sound: 'default'})
    expect(payload.modula).toMatchObject({deliveryId: 'd1', deepLink: 'modula://post/p1/comments', notificationId: 'n1', resourceId: 'p1'})
  })
  it('carries conversation and message ids for message notification actions', () => {
    const message = {...row, category: 'messages', thread_id: 'messages:c1', data: {conversationId: 'c1', messageId: 'm1', type: 'mention'}}
    const payload = buildApnsPayload(message, {title: 'Group', badge: 1}) as any
    expect(payload.aps.category).toBe('MODULA_MESSAGE')
    expect(payload.modula).toMatchObject({conversationId: 'c1', messageId: 'm1', messageType: 'mention'})
  })
  it('maps follow requests to Accept and plain follows to profile', () => {
    const request = {...row, category: 'follows', thread_id: 'follow-request:req-9:v1:requested'}
    expect(apnsCategoryFor(request)).toBe('MODULA_FOLLOW_REQUEST')
    expect(deepLinkFor(request)).toBe('modula://activity/requests')
    expect((buildApnsPayload(request, {title: null, badge: 0}) as any).modula.followRequestId).toBe('req-9')
    const follow = {...row, category: 'follows', thread_id: 'follows:x'}
    expect(apnsCategoryFor(follow)).toBeUndefined()
    expect(deepLinkFor(follow, {actorHandle: 'alice'})).toBe('modula://profile/alice')
    expect(deepLinkFor(follow)).toBe('modula://activity')
  })
  it('maps messages, likes, Moliboo and GUBIC', () => {
    expect(apnsCategoryFor({category: 'messages', thread_id: null})).toBe('MODULA_MESSAGE')
    expect(apnsCategoryFor({category: 'likes', thread_id: null})).toBeUndefined()
    expect(apnsCategoryFor({category: 'gubic_invites', thread_id: null})).toBe('MODULA_GUBIC_INVITE')
    expect(deepLinkFor({...row, category: 'likes'})).toBe('modula://post/p1')
    expect(deepLinkFor({...row, category: 'moliboo_care', data: {notificationId: 'n9'}})).toBe('modula://notifications/n9')
    expect(deepLinkFor({...row, category: 'messages', deep_link: 'modula://messages/c1'})).toBe('modula://messages/c1')
  })
})
