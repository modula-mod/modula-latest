import {randomUUID} from 'node:crypto'
import Fastify, {type FastifyInstance} from 'fastify'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {hashPassword} from '../src/lib/password.js'
import {GreenfieldSessionService} from '../src/sessions/service.js'
import {CredentialRegistryService} from '../src/auth/credentials/service.js'
import {SettingsV2Service} from '../src/settings-v2/service.js'
import {registerSettingsV2Routes} from '../src/settings-v2/routes.js'
import {runDigestPass} from '../../greenfield-worker/src/digests/digests.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const workerDatabaseUrl = process.env.MODULA_TEST_WORKER_DATABASE_URL
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
  let app: FastifyInstance
  let workerDb: ModulaDb | undefined

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    workerDb = workerDatabaseUrl ? createDb(workerDatabaseUrl) : undefined
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
    await db.insertInto('profiles').values([
      {id: `profile-a-${suffix}`, actor_id: actorId, handle: `seta${suffix}`, display_name: 'Settings A', kind: 'person', bio: '', avatar_url: null, cover_url: null, cover_colour: null, pronouns: null, location_label: null, location_visibility: null, website_label: null, website_url: null, website_domain: null, website_visibility: null, focus_status_id: 'available', focus_status_label: 'Available', focus_status_message: '', focus_status_updated_at: now, visibility: 'private', module_count: 0, featured_module_ids: [], identity_claims: [], joined_at: now, created_at: now, updated_at: now, deleted_at: null, version: 1},
      {id: `profile-b-${suffix}`, actor_id: fanActorId, handle: `setb${suffix}`, display_name: 'Settings B', kind: 'person', bio: '', avatar_url: null, cover_url: null, cover_colour: null, pronouns: null, location_label: null, location_visibility: null, website_label: null, website_url: null, website_domain: null, website_visibility: null, focus_status_id: 'available', focus_status_label: 'Available', focus_status_message: '', focus_status_updated_at: now, visibility: 'private', module_count: 0, featured_module_ids: [], identity_claims: [], joined_at: now, created_at: now, updated_at: now, deleted_at: null, version: 1},
    ] as any).execute()
    await db.insertInto('follows').values({id: `follow-${suffix}`, follower_actor_id: fanActorId, followed_actor_id: actorId, created_at: now, updated_at: now, deleted_at: null, version: 1} as any).execute()
    await db.insertInto('greenfield_password_credentials').values([
      {account_id: accountId, password_hash: await hashPassword('correct horse battery'), params: JSON.stringify({}) as any, updated_at: now},
      {account_id: fanAccountId, password_hash: await hashPassword('another correct horse'), params: JSON.stringify({}) as any, updated_at: now},
    ]).execute()
    const credentials = new CredentialRegistryService(db)
    await credentials.createPasswordMethod({accountId, verifiedAt: now})
    await credentials.createPasswordMethod({accountId: fanAccountId, verifiedAt: now})
    app = Fastify({bodyLimit: 1_048_576})
    await registerSettingsV2Routes(app, db, {mutationsEnabled: true} as any, sessions, {profileConfig: {}, writeConfig: {}})
    await app.ready()
  })

  afterAll(async () => {
    await app?.close()
    await workerDb?.destroy()
    await db?.destroy()
  })

  it('stores validated preferences and reports digest status', async () => {
    const initial = await service.preferences(accountId)
    expect(initial.version).toBe(0)
    expect(initial.digests.deliveryEmail).toBe(`se***@example.test`)
    const updated = await service.updatePreferences(accountId, {preferences: {'digests.weekly': true, 'digests.morning': true, 'digests.timeZone': 'Europe/London', 'feed.defaultMode': 'modules'}})
    expect(updated.version).toBe(1)
    expect(updated.preferences['feed.defaultMode']).toBe('modules')
    expect(updated.digests.weeklyEnabled).toBe(true)
    const other = await service.updatePreferences(fanAccountId, {preferences: {'feed.defaultMode': 'for-you', 'digests.weekly': false}})
    expect(other.preferences['feed.defaultMode']).toBe('for-you')
    expect((await service.preferences(accountId)).preferences['feed.defaultMode']).toBe('modules')
    await expect(service.updatePreferences(accountId, {'feed.unknown': 1})).rejects.toMatchObject({code: 'VALIDATION_FAILED'})
    await expect(service.updatePreferences(accountId, {preferences: {'feed.defaultMode': 'following'}, accountId: fanAccountId})).rejects.toMatchObject({code: 'VALIDATION_FAILED', field: 'accountId'})
  })

  it('queues one digest per period and records it', async () => {
    const monday = new Date('2099-01-05T08:30:00Z') // Monday, 08:30 London
    await db.updateTable('follows').set({created_at: new Date('2099-01-04T12:00:00Z')}).where('id', '=', `follow-${suffix}`).execute()
    const digestDb = workerDb ?? db
    const first = await runDigestPass(digestDb as any, {now: monday})
    expect(first.queued).toBeGreaterThanOrEqual(2)
    await runDigestPass(digestDb as any, {now: monday})
    const rows = await db.selectFrom('greenfield_digest_deliveries').selectAll().where('account_id', '=', accountId).execute()
    expect(rows.map(row => row.digest_kind).sort()).toEqual(['morning', 'weekly'])
    expect(rows.every(row => row.outcome === 'queued' && row.mail_job_id)).toBe(true)
    const mail = await db.selectFrom('greenfield_mail_jobs').selectAll().where('mail_job_id', '=', rows[0]!.mail_job_id!).executeTakeFirstOrThrow()
    expect(['digest-weekly', 'digest-morning']).toContain(mail.template_id)
    expect(mail.text_body).toContain('1 new follower')
    expect(mail.recipient_safe).toBe('se***@example.test')
    expect((await service.preferences(accountId)).digests.recent.length).toBe(2)
  })

  it('registers all nine authenticated routes and rejects target-account injection', async () => {
    const routes = [
      ['GET', '/v1/accounts/me/app-preferences'],
      ['PATCH', '/v1/accounts/me/app-preferences'],
      ['GET', '/v1/accounts/me/mutes'],
      ['GET', '/v1/accounts/me/blocks'],
      ['GET', '/v1/creator/insights'],
      ['GET', '/v1/creator/payouts'],
      ['GET', '/v1/commerce/invoices'],
      ['POST', '/v1/auth/step-up/password'],
      ['GET', '/v1/account/deletion-requests/current'],
    ] as const
    for (const [method, url] of routes) {
      const response = await app.inject({method, url, payload: method === 'GET' ? undefined : {}})
      expect(response.statusCode, `${method} ${url}`).toBe(401)
    }

    const issuedA = await sessions.issue(accountId, {authenticationStrength: 'low', recentAuthenticationAt: new Date(0)} as any)
    const issuedB = await sessions.issue(fanAccountId, {authenticationStrength: 'low', recentAuthenticationAt: new Date(0)} as any)
    const authorizationA = {authorization: `Bearer ${issuedA.accessToken}`}
    const authorizationB = {authorization: `Bearer ${issuedB.accessToken}`}
    expect((await app.inject({method: 'PATCH', url: '/v1/accounts/me/app-preferences', headers: authorizationA, payload: {'feed.defaultMode': 'modules'}})).statusCode).toBe(200)
    expect((await app.inject({method: 'PATCH', url: '/v1/accounts/me/app-preferences', headers: authorizationB, payload: {'feed.defaultMode': 'for-you'}})).statusCode).toBe(200)
    const injected = await app.inject({method: 'GET', url: `/v1/accounts/me/app-preferences?accountId=${fanAccountId}`, headers: authorizationA})
    expect(injected.statusCode).toBe(200)
    expect(injected.json().data.preferences['feed.defaultMode']).toBe('modules')
    const rejected = await app.inject({method: 'PATCH', url: '/v1/accounts/me/app-preferences', headers: authorizationA, payload: {preferences: {'feed.defaultMode': 'following'}, accountId: fanAccountId}})
    expect(rejected.statusCode).toBe(400)
    expect(rejected.json().error).toMatchObject({code: 'VALIDATION_FAILED', fieldErrors: {accountId: expect.any(String)}})
    expect((await app.inject({method: 'GET', url: `/v1/accounts/${fanAccountId}/app-preferences`, headers: authorizationA})).statusCode).toBe(404)
    const stepUpInjection = await app.inject({method: 'POST', url: '/v1/auth/step-up/password', headers: authorizationA, payload: {password: 'correct horse battery', accountId: fanAccountId}})
    expect(stepUpInjection.statusCode).toBe(400)
    expect(stepUpInjection.json().error.code).toBe('VALIDATION_FAILED')
  })

  it('computes insights and account-scopes relations, payouts and invoices', async () => {
    const insights = await service.insights(accountId, '7')
    expect(insights.series).toHaveLength(7)
    expect(insights.totals.followers).toBe(1)
    expect(insights.notTracked).toContain('impressions')
    await expect(service.insights(accountId, '5')).rejects.toMatchObject({code: 'VALIDATION_FAILED'})
    const now = new Date()
    await db.insertInto('greenfield_creator_ledger_entries').values([
      {entry_id: `ledger-a-${suffix}`, account_id: accountId, entry_kind: 'earning', amount_minor: 125, currency: 'GBP', description: 'A only', source: 'settings-test', source_reference: `a-${suffix}`, occurred_at: now, created_at: now},
      {entry_id: `ledger-b-${suffix}`, account_id: fanAccountId, entry_kind: 'earning', amount_minor: 900, currency: 'USD', description: 'B only', source: 'settings-test', source_reference: `b-${suffix}`, occurred_at: now, created_at: now},
    ]).execute()
    await db.insertInto('greenfield_commerce_invoices').values([
      {invoice_id: `invoice-a-${suffix}`, account_id: accountId, invoice_number: `A-${suffix}`, state: 'open', description: 'A only', total_minor: 125, currency: 'GBP', provider: 'none', provider_reference: null, issued_at: now, paid_at: null, created_at: now},
      {invoice_id: `invoice-b-${suffix}`, account_id: fanAccountId, invoice_number: `B-${suffix}`, state: 'open', description: 'B only', total_minor: 900, currency: 'USD', provider: 'none', provider_reference: null, issued_at: now, paid_at: null, created_at: now},
    ]).execute()
    await db.insertInto('mutes').values({id: `mute-a-${suffix}`, muter_actor_id: actorId, muted_actor_id: fanActorId, created_at: now, updated_at: now, deleted_at: null, version: 1}).execute()
    await db.insertInto('blocks').values({id: `block-b-${suffix}`, blocker_actor_id: fanActorId, blocked_actor_id: actorId, created_at: now, updated_at: now, deleted_at: null, version: 1}).execute()

    const payoutsA = await service.payouts(accountId)
    const payoutsB = await service.payouts(fanAccountId)
    expect(payoutsA).toMatchObject({provider: null, payoutsEnabled: false, entries: [{entryId: `ledger-a-${suffix}`}]})
    expect(payoutsB).toMatchObject({provider: null, payoutsEnabled: false, entries: [{entryId: `ledger-b-${suffix}`}]})
    expect((await service.invoices(accountId)).items.map(item => item.invoiceId)).toEqual([`invoice-a-${suffix}`])
    expect((await service.invoices(fanAccountId)).items.map(item => item.invoiceId)).toEqual([`invoice-b-${suffix}`])
    expect((await service.mutes(accountId)).items.map(item => item.actorId)).toEqual([fanActorId])
    expect((await service.mutes(fanAccountId)).items).toEqual([])
    expect((await service.blocks(fanAccountId)).items.map(item => item.actorId)).toEqual([actorId])
    expect((await service.blocks(accountId)).items).toEqual([])
  })

  it('steps up with the account password and rate limits guesses', async () => {
    const issued = await sessions.issue(accountId, {authenticationStrength: 'low', recentAuthenticationAt: new Date(0)} as any)
    const auth = {accountId, sessionId: issued.sessionId}
    await expect(service.passwordStepUp(auth, {password: 'correct horse battery', accountId: fanAccountId})).rejects.toMatchObject({code: 'VALIDATION_FAILED', field: 'accountId'})
    await expect(service.passwordStepUp(auth, {password: 'wrong'})).rejects.toMatchObject({code: 'VALIDATION_FAILED'})
    const result = await service.passwordStepUp(auth, {password: 'correct horse battery'})
    expect(result.stepUp).toBe(true)
    const resolved = await sessions.resolveAccess(issued.accessToken)
    expect(resolved?.authenticationStrength).toBe('medium')
    expect(Date.now() - resolved!.recentAuthenticationAt!.getTime()).toBeLessThan(5_000)
    const issuedB = await sessions.issue(fanAccountId, {authenticationStrength: 'low', recentAuthenticationAt: new Date(0)} as any)
    await expect(service.passwordStepUp({accountId: fanAccountId, sessionId: issuedB.sessionId}, {password: 'another correct horse'})).resolves.toMatchObject({stepUp: true})
    for (let index = 0; index < 5; index += 1) await service.passwordStepUp(auth, {password: `nope-${index}`}).catch(() => undefined)
    await expect(service.passwordStepUp(auth, {password: 'correct horse battery'})).rejects.toMatchObject({code: 'RATE_LIMITED'})
    expect((await service.currentDeletion(accountId)).request).toBeNull()
  })
})
