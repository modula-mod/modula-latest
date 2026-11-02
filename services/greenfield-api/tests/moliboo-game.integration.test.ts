import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('MOLIBOO-GAME-SYSTEMS-01 inventory, outfits, skills, buffs and quests', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let suffix = ''

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4031'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4031'
    process.env.MODULA_DATABASE_URL = databaseUrl!
    process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
    process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
    process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
    process.env.MODULA_INVITE_ONLY = 'true'
    process.env.MODULA_REGISTRATION_INVITE_CODES = 'test-invite'
    process.env.MODULA_ATPROTO_ENABLED = 'false'
    process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
    process.env.MODULA_PREMIUM_ENTITLEMENTS_ENABLED = 'false'
    process.env.MODULA_MEDIA_ROOT = `/tmp/modula-moliboo-game-${process.pid}`
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()
    await app.ready()
    suffix = Date.now().toString(36)
  })

  afterAll(async () => {
    await app.close()
    await db.destroy()
  })

  async function user(handle: string) {
    const password = 'secure-pass-word-1'
    const email = `${handle}@example.com`
    const register = await app.inject({method: 'POST', url: '/v1/accounts/register', payload: {email, password, handle, displayName: handle, acceptedTerms: true, inviteCode: 'test-invite'}})
    expect(register.statusCode).toBe(201)
    const verified = await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token: register.json().data.verificationToken}})
    expect(verified.statusCode).toBe(200)
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    return session.json().data.accessToken as string
  }
  const call = (token: string, method: string, url: string, payload?: unknown) =>
    app.inject({method: method as any, url, headers: {authorization: `Bearer ${token}`}, ...(payload === undefined ? {} : {payload})})

  it('requires auth and hides premium items while premium is disabled', async () => {
    expect((await app.inject({method: 'GET', url: '/v1/moliboo/inventory'})).statusCode).toBe(401)
    const token = await user(`mga${suffix}`.slice(0, 20))
    const items = await call(token, 'GET', '/v1/moliboo/catalogue/items')
    expect(items.statusCode).toBe(200)
    const list = items.json().data.items
    expect(list.length).toBeGreaterThanOrEqual(60)
    expect(list.some((i: any) => i.access === 'premium')).toBe(false)
    const sets = await call(token, 'GET', '/v1/moliboo/catalogue/outfits')
    expect(sets.json().data.sets.length).toBe(10)
    const inventory = await call(token, 'GET', '/v1/moliboo/inventory')
    expect(inventory.json().data.counts.owned).toBe(0)
  })

  it('equips free sets, refuses locked items, saves outfits and unlocks the First Outfit achievement', async () => {
    const token = await user(`mgb${suffix}`.slice(0, 20))
    const character = 'moliboo.angels.aura'
    const free = await call(token, 'POST', `/v1/moliboo/characters/${character}/equip`, {setId: 'moliboo.outfit.halo_choir'})
    expect(free.statusCode).toBe(200)
    expect(free.json().data.state.setBonus.setId).toBe('moliboo.outfit.halo_choir')
    expect(free.json().data.state.buffs.some((b: any) => b.source === 'set_bonus')).toBe(true)
    const locked = await call(token, 'POST', `/v1/moliboo/characters/${character}/equip`, {setId: 'moliboo.outfit.sunrise_herald'})
    expect(locked.statusCode).toBe(409)
    const premium = await call(token, 'POST', `/v1/moliboo/characters/${character}/equip`, {setId: 'moliboo.outfit.celestial_guardian'})
    expect(premium.statusCode).toBe(404)
    const twoHats = await call(token, 'POST', '/v1/moliboo/outfits', {name: 'Two hats', itemIds: ['moliboo.item.halo_ring', 'moliboo.item.party_cone']})
    expect(twoHats.statusCode).toBe(400)
    const saved = await call(token, 'POST', '/v1/moliboo/outfits', {name: 'Cosy look', characterId: character, itemIds: ['moliboo.item.party_cone', 'moliboo.item.cloud_pyjamas']})
    expect(saved.statusCode).toBe(201)
    const quests = (await call(token, 'GET', '/v1/moliboo/quests')).json().data.quests
    const first = quests.find((q: any) => q.questId === 'moliboo.quest.ach_first_outfit')
    expect(first.completed).toBe(true)
    const claim = await call(token, 'POST', '/v1/moliboo/quests/moliboo.quest.ach_first_outfit/claim', {})
    expect(claim.statusCode).toBe(200)
    expect(claim.json().data.grant).toEqual({type: 'item', itemId: 'moliboo.item.cloud_curls'})
    const again = await call(token, 'POST', '/v1/moliboo/quests/moliboo.quest.ach_first_outfit/claim', {})
    expect(again.json().data.replayed).toBe(true)
    const inventory = (await call(token, 'GET', '/v1/moliboo/inventory')).json().data
    expect(inventory.entries.find((e: any) => e.item.itemId === 'moliboo.item.cloud_curls').status).toBe('owned')
    const outfitId = saved.json().data.outfit.outfitId
    const renamed = await call(token, 'PATCH', `/v1/moliboo/outfits/${outfitId}`, {name: 'Cosier', revision: 1})
    expect(renamed.json().data.outfit.revision).toBe(2)
    expect((await call(token, 'PATCH', `/v1/moliboo/outfits/${outfitId}`, {name: 'Stale', revision: 1})).statusCode).toBe(409)
    expect((await call(token, 'DELETE', `/v1/moliboo/outfits/${outfitId}`)).statusCode).toBe(200)
  })

  it('applies care buffs idempotently, enforces skill cooldowns and progresses daily quests', async () => {
    const token = await user(`mgc${suffix}`.slice(0, 20))
    const character = 'moliboo.dreamers.somna'
    const feed = await call(token, 'POST', `/v1/moliboo/characters/${character}/care`, {action: 'feed', idempotencyKey: `feed-${suffix}-1`})
    expect(feed.statusCode).toBe(200)
    expect(feed.json().data.counted).toBe(true)
    expect(feed.json().data.buff.buffId).toBe('moliboo.buff.well_fed')
    const replay = await call(token, 'POST', `/v1/moliboo/characters/${character}/care`, {action: 'feed', idempotencyKey: `feed-${suffix}-1`})
    expect(replay.json().data.replayed).toBe(true)
    const spam = await call(token, 'POST', `/v1/moliboo/characters/${character}/care`, {action: 'feed', idempotencyKey: `feed-${suffix}-2`})
    expect(spam.json().data.counted).toBe(false)
    for (const action of ['play', 'play', 'rest']) {
      await call(token, 'POST', `/v1/moliboo/characters/${character}/care`, {action, idempotencyKey: `${action}-${suffix}-${Math.random().toString(36).slice(2, 10)}`})
    }
    const state = (await call(token, 'GET', `/v1/moliboo/characters/${character}/state`)).json().data
    expect(state.buffs.map((b: any) => b.buffId)).toEqual(expect.arrayContaining(['moliboo.buff.well_fed', 'moliboo.buff.playful', 'moliboo.buff.well_rested']))
    expect(state.friendship.bonusPct).toBeLessThanOrEqual(25)
    expect(state.skill.skillId).toBe('moliboo.skill.somna')
    const use = await call(token, 'POST', `/v1/moliboo/characters/${character}/skills/moliboo.skill.somna/use`, {idempotencyKey: `skill-${suffix}-1`})
    expect(use.statusCode).toBe(200)
    expect(use.json().data.buff.buffId).toBe('moliboo.buff.signature_dreamers')
    const cooldown = await call(token, 'POST', `/v1/moliboo/characters/${character}/skills/moliboo.skill.somna/use`, {idempotencyKey: `skill-${suffix}-2`})
    expect(cooldown.statusCode).toBe(409)
    const wrong = await call(token, 'POST', `/v1/moliboo/characters/${character}/skills/moliboo.skill.aura/use`, {idempotencyKey: `skill-${suffix}-3`})
    expect(wrong.statusCode).toBe(404)
    const quests = (await call(token, 'GET', '/v1/moliboo/quests')).json().data
    expect(quests.rules.streaksRequired).toBe(false)
    const trio = quests.quests.find((q: any) => q.questId === 'moliboo.quest.daily_care_trio')
    expect(trio.progress).toBe(3)
    const claim = await call(token, 'POST', '/v1/moliboo/quests/moliboo.quest.daily_care_trio/claim', {characterId: character})
    expect(claim.json().data.grant.friendshipXp).toBeGreaterThanOrEqual(30)
    const activity = await call(token, 'POST', '/v1/moliboo/activities/complete', {activityId: 'bubble_pop', characterId: character, idempotencyKey: `act-${suffix}-1`})
    expect(activity.json().data.counted).toBe(true)
    expect((await call(token, 'POST', '/v1/moliboo/activities/complete', {activityId: 'slots', idempotencyKey: `act-${suffix}-2`})).statusCode).toBe(400)
  })
})
