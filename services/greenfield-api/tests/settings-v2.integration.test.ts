import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {hashPassword} from '../src/lib/password.js'
import {GreenfieldSessionService} from '../src/sessions/service.js'
import {CredentialRegistryService} from '../src/auth/credentials/service.js'
import {SettingsV2Service} from '../src/settings-v2/service.js'
import {runDigestPass} from '../../greenfield-worker/src/digests/digests.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().replaceAll('-', '').slice(0, 10)
const accountId = `settings-a-${suffix}`
const fanAccountId = `settings-b-${suffix}`
const actorId = `actor-a-${suffix}`
const fanActorId = `actor-b-${suffix}`
const sessionConfig = {sessionPepper: 'test-pepper', accessTokenTtlMinutes: 15, refreshTokenTtlDays: 30} as any

describeIfDb('settings backend v2 (database)', () => {
  let db: ModulaDb
  let sessions: GreenfieldSessionService
  let service: SettingsV2Service

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    sessions = new GreenfieldSessionService(db, sessionConfig)
    service = new SettingsV2Service(db, sessions)
    const now = new Date()
    await db.insertInto('greenfield_accounts').values([
      {account_id: accountId, primary_handle: `seta${suffix}`, status: 'active', created_at: now, updated_at: now},
      {account_id: fanAccountId, primary_handle: `setb${suffix}`, status: 'active', created_at: now, updated_at: now},
    ]).execute()
    await db.insertInto('greenfield_auth_identities').values({identity_id: `identity-${suffix}`, account_id: accountId, kind: 'email', identifier: `settings-${suffix}@example.test`, verified_at: now, metadata: {}, created_at: now, updated_at: now}).execute()
    await db.insertInto('actors').values([
      {id: actorId, account_id: accountId, kind: 'person', created_at: now, updated_at: now, deleted_at: null, version: 1},
      {id: fanActorId, account_id: fanAccountId, kind: 'person', created_at: now, updated_at: now, deleted_at: null, version: 1},
    ] as any).execute()
    await db.insertInto('follows').values({id: `follow-${suffix}`, follower_actor_id: fanActorId, followed_actor_id: actorId, created_at: now, updated_at: now, deleted_at: null, version: 1} as any).execute()
    await db.insertInto('greenfield_password_credentials').values({account_id: accountId, password_hash: await hashPassword('correct horse battery'), params: JSON.stringify({}) as any, updated_at: now}).execute()
    await new CredentialRegistryService(db).createPasswordMethod({accountId, verifiedAt: now})
  })

  afterAll(async () => db?.destroy())

  it('stores validated preferences and reports digest status', async () => {
    const initial = await service.preferences(accountId)
    expect(initial.version).toBe(0)
    expect(initial.digests.deliveryEmail).toBe(`se***@example.test`)
    const updated = await service.updatePreferences(accountId, {preferences: {'digests.weekly': true, 'digests.morning': true, 'digests.timeZone': 'Europe/London', 'feed.defaultMode': 'modules'}})
    expect(updated.version).toBe(1)
    expect(updated.preferences['feed.defaultMode']).toBe('modules')
    expect(updated.digests.weeklyEnabled).toBe(true)
    await expect(service.updatePreferences(accountId, {'feed.unknown': 1})).rejects.toMatchObject({code: 'VALIDATION_FAILED'})
  })

  it('queues one digest per period and records it', async () => {
    const monday = new Date('2099-01-05T08:30:00Z') // Monday, 08:30 London
    await db.updateTable('follows').set({created_at: new Date('2099-01-04T12:00:00Z')}).where('id', '=', `follow-${suffix}`).execute()
    const first = await runDigestPass(db as any, {now: monday})
    expect(first.queued).toBeGreaterThanOrEqual(2)
    await runDigestPass(db as any, {now: monday})
    const rows = await db.selectFrom('greenfield_digest_deliveries').selectAll().where('account_id', '=', accountId).execute()
    expect(rows.map(row => row.digest_kind).sort()).toEqual(['morning', 'weekly'])
    expect(rows.every(row => row.outcome === 'queued' && row.mail_job_id)).toBe(true)
    const mail = await db.selectFrom('greenfield_mail_jobs').selectAll().where('mail_job_id', '=', rows[0]!.mail_job_id!).executeTakeFirstOrThrow()
    expect(['digest-weekly', 'digest-morning']).toContain(mail.template_id)
    expect(mail.text_body).toContain('1 new follower')
    expect(mail.recipient_safe).toBe('se***@example.test')
    expect((await service.preferences(accountId)).digests.recent.length).toBe(2)
  })

  it('computes insights from real engagement and keeps money at zero', async () => {
    const insights = await service.insights(accountId, '7')
    expect(insights.series).toHaveLength(7)
    expect(insights.totals.followers).toBe(1)
    expect(insights.notTracked).toContain('impressions')
    await expect(service.insights(accountId, '5')).rejects.toMatchObject({code: 'VALIDATION_FAILED'})
    const payouts = await service.payouts(accountId)
    expect(payouts).toMatchObject({provider: null, payoutsEnabled: false, balances: [], entries: []})
    expect((await service.invoices(accountId)).items).toEqual([])
    expect((await service.mutes(accountId)).items).toEqual([])
    expect((await service.blocks(accountId)).items).toEqual([])
  })

  it('steps up with the account password and rate limits guesses', async () => {
    const issued = await sessions.issue(accountId, {authenticationStrength: 'low', recentAuthenticationAt: new Date(0)} as any)
    const auth = {accountId, sessionId: issued.sessionId}
    await expect(service.passwordStepUp(auth, {password: 'wrong'})).rejects.toMatchObject({code: 'VALIDATION_FAILED'})
    const result = await service.passwordStepUp(auth, {password: 'correct horse battery'})
    expect(result.stepUp).toBe(true)
    const resolved = await sessions.resolveAccess(issued.accessToken)
    expect(resolved?.authenticationStrength).toBe('medium')
    expect(Date.now() - resolved!.recentAuthenticationAt!.getTime()).toBeLessThan(5_000)
    for (let index = 0; index < 5; index += 1) await service.passwordStepUp(auth, {password: `nope-${index}`}).catch(() => undefined)
    await expect(service.passwordStepUp(auth, {password: 'correct horse battery'})).rejects.toMatchObject({code: 'RATE_LIMITED'})
    expect((await service.currentDeletion(accountId)).request).toBeNull()
  })
})
